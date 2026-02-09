/**
 * Script to downgrade users who have premium access but payment is still pending on Polar.
 *
 * This script:
 * 1. Connects to Polar API to get all pending orders
 * 2. For each pending order, finds the corresponding user
 * 3. Downgrades them to starter tier if they currently have a premium tier
 * 4. Logs all actions for audit purposes
 *
 * Usage: npx tsx src/scripts/downgrade-pending-users.ts
 * Or with dry-run: npx tsx src/scripts/downgrade-pending-users.ts --dry-run
 */

import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseApp, closeFirebaseApp } from "../utils/getFirebaseApp.ts";
import { createPolar } from "../utils/polarClient.ts";
import { createQuotaHistoryFromTier } from "../utils/quota.utils.ts";

const DEFAULT_TIER_ID = process.env.DEFAULT_TIER_ID || "starter";
const PREMIUM_TIERS = ["plus", "plusAnnual"];

interface DowngradeResult {
  userId: string;
  email: string;
  previousTier: string;
  orderId: string;
  status: "downgraded" | "skipped" | "error";
  reason?: string;
}

async function downgradePendingUsers(dryRun: boolean = false) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Downgrade Pending Users Script`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE"}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}\n`);

  const app = getFirebaseApp();
  const db = getFirestore(app);
  const polar = createPolar();

  const results: DowngradeResult[] = [];
  let page = 1;
  let hasMore = true;

  try {
    // Fetch all orders with pending status from Polar
    console.log("Fetching pending orders from Polar...\n");

    while (hasMore) {
      const response = await polar.orders.list({
        organizationId: process.env.POLAR_ORG_ID,
        page,
        limit: 100,
      });

      const orders = response.result?.items || [];

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      for (const order of orders) {
        // Only process pending orders
        if (order.status !== "pending") continue;

        const orderId = order.id;
        const customerEmail = order.customer?.email;
        const customerId = order.customerId;
        const metadata = order.metadata as Record<string, any> | null;
        const userId = metadata?.user_id;

        console.log(`Processing order ${orderId} (status: pending)`);
        console.log(`  Customer: ${customerEmail || "unknown"}`);

        // Find user in Firebase
        let userDoc = null;
        let userDocRef = null;

        if (userId) {
          const userQuery = db
            .collection("users")
            .where("userId", "==", userId)
            .limit(1);
          const userDocs = await userQuery.get();
          if (!userDocs.empty && userDocs.docs[0]) {
            userDoc = userDocs.docs[0];
            userDocRef = userDoc.ref;
          }
        }

        // Fallback: search by email
        if (!userDoc && customerEmail) {
          const userQuery = db
            .collection("users")
            .where("email", "==", customerEmail)
            .limit(1);
          const userDocs = await userQuery.get();
          if (!userDocs.empty && userDocs.docs[0]) {
            userDoc = userDocs.docs[0];
            userDocRef = userDoc.ref;
          }
        }

        // Fallback: search by polarId
        if (!userDoc && customerId) {
          const userQuery = db
            .collection("users")
            .where("polarId", "==", customerId)
            .limit(1);
          const userDocs = await userQuery.get();
          if (!userDocs.empty && userDocs.docs[0]) {
            userDoc = userDocs.docs[0];
            userDocRef = userDoc.ref;
          }
        }

        if (!userDoc) {
          console.log(`  ⚠️  User not found, skipping\n`);
          results.push({
            userId: userId || "unknown",
            email: customerEmail || "unknown",
            previousTier: "unknown",
            orderId,
            status: "skipped",
            reason: "User not found in database",
          });
          continue;
        }

        const userData = userDoc.data();
        const currentTier = userData?.tierId;
        const actualUserId = userData?.userId;

        // Check if user has premium tier
        if (!PREMIUM_TIERS.includes(currentTier)) {
          console.log(`  ℹ️  User already on ${currentTier} tier, skipping\n`);
          results.push({
            userId: actualUserId,
            email: customerEmail || userData?.email || "unknown",
            previousTier: currentTier,
            orderId,
            status: "skipped",
            reason: `Already on non-premium tier: ${currentTier}`,
          });
          continue;
        }

        // Downgrade user
        console.log(
          `  🔻 Downgrading from ${currentTier} to ${DEFAULT_TIER_ID}`,
        );

        if (!dryRun) {
          try {
            // Update user tier
            await userDocRef!.update({
              tierId: DEFAULT_TIER_ID,
              updatedAt: new Date(),
            });

            // Archive and recreate quota history
            await createQuotaHistoryFromTier(
              actualUserId,
              DEFAULT_TIER_ID,
              false,
            );

            console.log(`  ✅ Successfully downgraded\n`);
            results.push({
              userId: actualUserId,
              email: customerEmail || userData?.email || "unknown",
              previousTier: currentTier,
              orderId,
              status: "downgraded",
            });
          } catch (err: any) {
            console.log(`  ❌ Error: ${err.message}\n`);
            results.push({
              userId: actualUserId,
              email: customerEmail || userData?.email || "unknown",
              previousTier: currentTier,
              orderId,
              status: "error",
              reason: err.message,
            });
          }
        } else {
          console.log(`  [DRY RUN] Would downgrade user\n`);
          results.push({
            userId: actualUserId,
            email: customerEmail || userData?.email || "unknown",
            previousTier: currentTier,
            orderId,
            status: "downgraded",
            reason: "DRY RUN - no changes made",
          });
        }
      }

      // Check pagination
      if (response.result?.pagination?.maxPage) {
        hasMore = page < response.result.pagination.maxPage;
        page++;
      } else {
        hasMore = orders.length === 100;
        page++;
      }
    }

    // Print summary
    console.log(`\n${"=".repeat(60)}`);
    console.log("SUMMARY");
    console.log(`${"=".repeat(60)}`);

    const downgraded = results.filter((r) => r.status === "downgraded");
    const skipped = results.filter((r) => r.status === "skipped");
    const errors = results.filter((r) => r.status === "error");

    console.log(`Total pending orders processed: ${results.length}`);
    console.log(`Users downgraded: ${downgraded.length}`);
    console.log(`Users skipped: ${skipped.length}`);
    console.log(`Errors: ${errors.length}`);

    if (downgraded.length > 0) {
      console.log(`\nDowngraded users:`);
      for (const r of downgraded) {
        console.log(`  - ${r.email} (${r.previousTier} → ${DEFAULT_TIER_ID})`);
      }
    }

    if (errors.length > 0) {
      console.log(`\nErrors:`);
      for (const r of errors) {
        console.log(`  - ${r.email}: ${r.reason}`);
      }
    }

    console.log(`\nCompleted at: ${new Date().toISOString()}`);
    console.log(
      `${dryRun ? "\n⚠️  This was a DRY RUN - no changes were made!" : ""}`,
    );
  } catch (err: any) {
    console.error("Fatal error:", err);
    throw err;
  } finally {
    closeFirebaseApp();
  }

  return results;
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

downgradePendingUsers(dryRun)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  });
