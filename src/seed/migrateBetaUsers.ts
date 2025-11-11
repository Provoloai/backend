import "dotenv/config";
import { getFirebaseApp, closeFirebaseApp } from "../utils/getFirebaseApp.ts";
import { getFirestore, FieldValue, WriteBatch } from "firebase-admin/firestore";
import { createPolarCustomer } from "../utils/polarClient.ts";
import { subscribeUser } from "../services/mailerlite.service.ts";

/**
 * Migration script to migrate beta testing users to the new user structure
 * 
 * Old structure:
 * - userId, email, displayName, subscribed (boolean), createdAt, updatedAt
 * 
 * New structure:
 * - userId, email, displayName, tierId, mailerliteId, polarId, portfolioLink,
 *   professionalTitle, emailVerified, otp, otpExpires, createdAt, updatedAt
 * 
 * Migration actions:
 * 1. Set tierId to free/starter tier
 * 2. Set emailVerified to false
 * 3. Add missing fields (mailerliteId, polarId, portfolioLink, professionalTitle, otp, otpExpires)
 * 4. Remove subscribed field
 * 5. Create Polar IDs for all users (optional - can be skipped with SKIP_POLAR_CREATION=true)
 * 6. Subscribe all users to MailerLite
 * 
 * Note: Quota history is created automatically on first use by checkUserQuota()
 * Note: Polar IDs are only needed for payment webhook processing. They can be created lazily
 *       during signup or when processing webhooks. Set SKIP_POLAR_CREATION=true to skip
 *       during migration to avoid rate limiting.
 * 
 * API Rate Limits:
 * - Polar: 300 requests/minute (5 req/sec) - Using 1 request per 5 seconds (0.2 req/sec) for safety
 * - MailerLite: 120 requests/minute (2 req/sec) - Using 1 request per second (1 req/sec) for safety
 * 
 * The script processes requests sequentially (one at a time) to avoid rate limiting.
 * For 500 accounts: ~42 minutes for Polar, ~8 minutes for MailerLite (run in parallel)
 * 
 * Uses Firestore batch writes (up to 500 operations per batch) for optimization
 * 
 * SECURITY: Requires MIGRATION_SECRET_TOKEN environment variable to prevent unauthorized execution
 */
export async function migrateBetaUsers(providedToken?: string) {
  console.log("Starting beta users migration...");

  // Security check: Require secret token
  const requiredToken = process.env.MIGRATION_SECRET_TOKEN;
  const token = providedToken || process.env.MIGRATION_SECRET_TOKEN;

  if (!requiredToken) {
    console.error("❌ SECURITY ERROR: MIGRATION_SECRET_TOKEN not set in environment variables");
    console.error("   This script requires a secret token to prevent unauthorized execution.");
    console.error("   Please set MIGRATION_SECRET_TOKEN in your .env file.");
    process.exit(1);
  }

  if (!token || token !== requiredToken) {
    console.error("❌ SECURITY ERROR: Invalid or missing migration token");
    console.error("   This script requires a valid MIGRATION_SECRET_TOKEN to execute.");
    process.exit(1);
  }

  console.log("✓ Security token validated");

  const starterTierId = process.env.STARTER_TIER_ID || process.env.DEFAULT_TIER_ID;
  if (!starterTierId) {
    console.error("STARTER_TIER_ID or DEFAULT_TIER_ID not set in environment variables");
    process.exit(1);
  }

  const app = getFirebaseApp();
  const db = getFirestore(app);

  // Firestore batch limit is 500 operations
  const BATCH_LIMIT = 500;

  try {
    const usersCol = db.collection("users");
    
    // Get all users
    console.log("Fetching all users...");
    const allUsersSnap = await usersCol.get();
    
    if (allUsersSnap.empty) {
      console.log("No users found to migrate.");
      return;
    }

    console.log(`Found ${allUsersSnap.size} users to check for migration...`);

    // Step 1: Identify users that need migration
    interface UserMigrationData {
      docId: string;
      userId: string;
      email: string;
      displayName: string | null;
      needsMigration: boolean;
      needsPolarId: boolean;
      needsMailerLite: boolean;
      polarId?: string;
      mailerliteId?: string;
    }

    const usersToMigrate: UserMigrationData[] = [];

    for (const doc of allUsersSnap.docs) {
      const data = doc.data();
      const userId = data.userId;

      if (!userId) {
        console.warn(`Skipping document ${doc.id}: missing userId`);
        continue;
      }

      const hasSubscribed = Object.prototype.hasOwnProperty.call(data, "subscribed");
      const hasTierId = Object.prototype.hasOwnProperty.call(data, "tierId");
      const hasEmailVerified = Object.prototype.hasOwnProperty.call(data, "emailVerified");
      const hasPolarId = data.polarId && data.polarId !== null && data.polarId !== "";
      const hasMailerLiteId = data.mailerliteId && data.mailerliteId !== null && data.mailerliteId !== "";

      // Check if already migrated
      if (hasTierId && hasEmailVerified && !hasSubscribed && hasPolarId && hasMailerLiteId) {
        continue; // Skip fully migrated users
      }

      usersToMigrate.push({
        docId: doc.id,
        userId,
        email: data.email || "",
        displayName: data.displayName || null,
        needsMigration: !hasTierId || !hasEmailVerified || hasSubscribed,
        needsPolarId: !hasPolarId,
        needsMailerLite: !hasMailerLiteId,
      });
    }

    console.log(`\nFound ${usersToMigrate.length} users that need migration...`);

    if (usersToMigrate.length === 0) {
      console.log("All users are already migrated!");
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    let polarCreated = 0;
    let mailerliteSubscribed = 0;

    // Helper function to format time duration
    function formatDuration(seconds: number): string {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    }

    // Helper function for sequential processing with rate limiting and progress tracking
    async function processSequentially<T, R>(
      items: T[],
      processor: (item: T, index: number, total: number) => Promise<R>,
      delayMs: number,
      label: string
    ): Promise<R[]> {
      const results: R[] = [];
      const startTime = Date.now();
      const total = items.length;
      
      console.log(`\n  Starting ${label} for ${total} items...`);
      console.log(`  Rate limit: 1 request per ${delayMs / 1000} seconds`);
      console.log(`  Estimated time: ${formatDuration((total * delayMs) / 1000)}`);
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue; // Skip if item is undefined
        
        const current = i + 1;
        const percentage = ((current / total) * 100).toFixed(1);
        
        // Calculate ETA
        const elapsed = (Date.now() - startTime) / 1000;
        const avgTimePerItem = elapsed / current;
        const remaining = total - current;
        const etaSeconds = remaining * avgTimePerItem;
        
        try {
          const result = await processor(item, i, total);
          results.push(result);
          
          // Show progress every 10 items or on last item
          if (current % 10 === 0 || current === total) {
            console.log(
              `  [${label}] Progress: ${current}/${total} (${percentage}%) | ` +
              `Elapsed: ${formatDuration(elapsed)} | ` +
              `ETA: ${formatDuration(etaSeconds)}`
            );
          }
        } catch (err: any) {
          // Log error but continue processing
          if (err?.status === 429 || err?.message?.includes("rate limit")) {
            console.warn(`  ⚠ [${label}] Rate limited for item ${current}/${total}, will be created later`);
          } else {
            console.error(`  ✗ [${label}] Failed for item ${current}/${total}:`, err?.message || err);
          }
        }
        
        // Delay after each request (except the last one)
        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`  ✓ [${label}] Completed ${results.length}/${total} in ${formatDuration(totalTime)}`);
      
      return results;
    }

    // Step 2 & 3: Create Polar IDs (optional) and subscribe to MailerLite
    console.log("\n=== Step 1: Creating Polar IDs (optional) and MailerLite subscriptions ===");
    
    // Check if Polar ID creation should be skipped (to avoid rate limiting)
    const skipPolarCreation = process.env.SKIP_POLAR_CREATION === "true";
    
    const usersNeedingPolarId = skipPolarCreation 
      ? [] 
      : usersToMigrate.filter((u) => u.needsPolarId && u.email);
    const usersNeedingMailerLite = usersToMigrate.filter(
      (u) => u.needsMailerLite && u.email
    );

    // Run Polar ID creation (if enabled) and MailerLite subscription in parallel
    // Both use sequential processing with conservative rate limits
    const promises: Promise<any>[] = [];
    
    // Only add Polar ID creation if not skipped
    if (!skipPolarCreation && usersNeedingPolarId.length > 0) {
      promises.push(
        // Create Polar IDs sequentially: 1 request per 5 seconds (0.2 req/sec)
        // Polar API limit: 300 req/min (5 req/sec) - using 0.2 req/sec for maximum safety
        processSequentially(
          usersNeedingPolarId,
          async (user, index, total) => {
            try {
              const polarResult = await createPolarCustomer({
                userId: user.userId,
                email: user.email,
                name: user.displayName || user.email,
              });
              user.polarId = polarResult.id;
              polarCreated++;
              return polarResult;
            } catch (err: any) {
              // If rate limited (429), log and continue - Polar ID will be created lazily later
              if (err?.status === 429 || err?.message?.includes("rate limit")) {
                console.warn(`  ⚠ Rate limited for user ${user.userId}, will be created later`);
                throw err; // Re-throw to be handled by processSequentially
              }
              throw err;
            }
          },
          5000, // 5 seconds delay between requests (1 req per 5 sec = 0.2 req/sec)
          "Polar ID creation"
        )
      );
    } else if (skipPolarCreation) {
      console.log("  ⚠ Skipping Polar ID creation (SKIP_POLAR_CREATION=true)");
      console.log("     Polar IDs will be created lazily when needed (during signup or webhook processing)");
    }

    // Always add MailerLite subscription
    // MailerLite: 1 request per second (1 req/sec)
    // MailerLite API limit: 120 req/min (2 req/sec) - using 1 req/sec for safety
    promises.push(
      processSequentially(
        usersNeedingMailerLite,
        async (user, index, total) => {
          const subscribeResult = await subscribeUser(
            user.displayName || user.email,
            user.email
          );
          if (subscribeResult.success && subscribeResult.data?.data?.id) {
            user.mailerliteId = subscribeResult.data.data.id;
            mailerliteSubscribed++;
          } else {
            console.warn(`  ⚠ Failed to subscribe user ${user.userId}: ${subscribeResult.message}`);
          }
          return subscribeResult;
        },
        1000, // 1 second delay between requests (1 req/sec)
        "MailerLite subscription"
      )
    );

    await Promise.all(promises);

    if (!skipPolarCreation) {
      console.log(`\n  ✓ Created ${polarCreated} Polar IDs`);
    }
    console.log(`  ✓ Subscribed ${mailerliteSubscribed} users to MailerLite`);

    // Step 4: Batch update user documents
    console.log(`\n=== Step 3: Batch updating user documents ===`);
    let batch: WriteBatch | null = null;
    let batchCount = 0;

    const commitBatch = async () => {
      if (batch && batchCount > 0) {
        await batch.commit();
        console.log(`  ✓ Committed batch with ${batchCount} operations`);
        batchCount = 0;
      }
    };

    for (const user of usersToMigrate) {
      try {
        if (!batch) {
          batch = db.batch();
        }

        const userRef = usersCol.doc(user.docId);
        const updateData: Record<string, any> = {
          updatedAt: FieldValue.serverTimestamp(),
        };

        // Set tierId if needed
        if (user.needsMigration) {
          updateData.tierId = starterTierId;
          updateData.emailVerified = false;
        }

        // Add missing optional fields
        updateData.portfolioLink = null;
        updateData.professionalTitle = null;
        updateData.otp = null;
        updateData.otpExpires = null;

        // Set Polar ID if created
        if (user.polarId) {
          updateData.polarId = user.polarId;
        }

        // Set MailerLite ID if subscribed
        if (user.mailerliteId) {
          updateData.mailerliteId = user.mailerliteId;
        }

        // Remove subscribed field if it exists
        if (user.needsMigration) {
          updateData.subscribed = FieldValue.delete();
        }

        batch.update(userRef, updateData);
        batchCount++;

        // Commit batch if we reach the limit
        if (batchCount >= BATCH_LIMIT) {
          await commitBatch();
          batch = null;
        }

        migrated++;
      } catch (err) {
        console.error(`  ✗ Failed to prepare update for user ${user.docId}:`, err);
        errors++;
      }
    }

    // Commit remaining batch
    await commitBatch();

    console.log("\n=== Migration Summary ===");
    console.log(`Total users checked: ${allUsersSnap.size}`);
    console.log(`Users migrated: ${migrated}`);
    console.log(`Users skipped (already migrated): ${allUsersSnap.size - usersToMigrate.length}`);
    console.log(`Polar IDs created: ${polarCreated}`);
    console.log(`MailerLite subscriptions: ${mailerliteSubscribed}`);
    console.log(`Errors: ${errors}`);
    console.log(`\nNote: Quota history will be created automatically when users first use a feature.`);
    console.log("Migration completed ✔️");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    closeFirebaseApp();
  }
}
