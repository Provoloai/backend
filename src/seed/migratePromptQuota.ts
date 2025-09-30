import "dotenv/config";
import { getFirebaseApp } from "../utils/getFirebaseApp.ts";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { DocumentData } from "@google-cloud/firestore";
import type { Feature, FeatureSlug, RecurringInterval } from "../types/tiers.ts";
import type { QuotaFeature, QuotaHistory } from "../types/quotas.ts";

export async function migratePromptQuota() {
  const defaultTierId = process.env.STARTER_TIER_ID || process.env.DEFAULT_TIER_ID;
  if (!defaultTierId) {
    console.error("DEFAULT/STARTER TIER ID not set in env (STARTER_TIER_ID or DEFAULT_TIER_ID)");
    process.exit(1);
  }

  const app = getFirebaseApp();
  const db = getFirestore(app);

  console.log("Starting prompt quota migration...");

  const snapshot = await db.collection("user_prompt_limits").get();

  let migrated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as { userId?: string; promptCount?: number; lastPromptAt?: Timestamp };
    const userId = data.userId || data["userId"] || doc.id;
    const promptCount = data.promptCount ?? 0;
    const lastPromptAt = data.lastPromptAt ? data.lastPromptAt.toDate() : null;

    if (!userId) {
      console.warn(`Skipping document ${doc.id}: missing userId`);
      skipped++;
      continue;
    }

    // Resolve tier for user (fallback to default)
    let tierId = defaultTierId;
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const t = (userDoc.data() as DocumentData)?.tierId;
        if (typeof t === "string" && t.length > 0) tierId = t;
      }
    } catch (e) {
      // ignore, fallback to default
    }

    // Build features from tier document
    const features: QuotaFeature[] = [];
    try {
      const tierDoc = await db.collection("tiers").doc(tierId).get();
      if (tierDoc.exists) {
        const feats = (tierDoc.data() as DocumentData)?.features as DocumentData[] | undefined;
        if (Array.isArray(feats)) {
          for (const fmap of feats) {
            // Normalize fields defensively
            const slugStr = String(fmap["slug"] ?? "");
            const recurringStr = String(fmap["recurringInterval"] ?? "");
            const feature: Feature = {
              name: String(fmap["name"] ?? ""),
              description: String(fmap["description"] ?? ""),
              slug: slugStr as FeatureSlug,
              limited: Boolean(fmap["limited"] ?? false),
              maxQuota: Number(fmap["maxQuota"] ?? 0),
              recurringInterval: recurringStr as "" | RecurringInterval,
            };
            features.push({ ...feature, usageCount: 0, lastUsed: null });
          }
        }
      }
    } catch (e) {
      // If tier is missing, features stay empty
    }

    // Apply old prompt usage to the correct feature slug
    for (const f of features) {
      if (f.slug === "upwork_profile_optimizer") {
        f.usageCount = promptCount;
        f.lastUsed = lastPromptAt;
      }
    }

    const quotaDocRef = db.collection("quota_history").doc(userId);

    // Preserve createdAt if exists
    let createdAt: Date = new Date();
    try {
      const existing = await quotaDocRef.get();
      if (existing.exists) {
        const existingData = existing.data() as Partial<QuotaHistory> | undefined;
        if (existingData?.createdAt instanceof Timestamp) {
          createdAt = existingData.createdAt.toDate();
        } else if (existingData?.createdAt instanceof Date) {
          createdAt = existingData.createdAt;
        }
      }
    } catch {}

    const quotaHistory: QuotaHistory = {
      userId,
      tierId,
      lastSubscriptionDate: new Date(),
      features,
      createdAt,
      updatedAt: new Date(),
    };

    try {
      await quotaDocRef.set(quotaHistory);
      migrated++;
      console.log(`Upserted quota_history for user ${userId}`);
    } catch (e) {
      console.error(`Failed to upsert quota_history for user ${userId}:`, e);
      skipped++;
      continue;
    }
  }

  console.log(`Migration completed ✔️ Migrated: ${migrated}, Skipped: ${skipped}`);
}
