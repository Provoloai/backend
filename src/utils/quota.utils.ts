import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseApp, closeFirebaseApp } from "./getFirebaseApp.ts";
import type { QuotaFeature, QuotaHistory } from "../types/quotas.ts";
import type { Tier, FeatureSlug } from "../types/tiers.ts";

// Reset usage count if a new interval has started
export function resetIfNewInterval(feature: QuotaFeature, now: Date): number {
  if (!feature.lastUsed) return feature.usageCount;
  // Firestore Timestamp or Date
  let last: Date;
  if (feature.lastUsed instanceof Date) {
    last = feature.lastUsed;
  } else if (
    typeof feature.lastUsed === "object" &&
    typeof (feature.lastUsed as any).toDate === "function"
  ) {
    last = (feature.lastUsed as any).toDate();
  } else {
    last = new Date(feature.lastUsed);
  }
  switch (feature.recurringInterval) {
    case "daily":
      if (
        last.getUTCFullYear() !== now.getUTCFullYear() ||
        last.getUTCMonth() !== now.getUTCMonth() ||
        last.getUTCDate() !== now.getUTCDate()
      ) {
        return 0;
      }
      break;
    case "weekly": {
      const getWeek = (d: Date) => {
        const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      };
      if (last.getUTCFullYear() !== now.getUTCFullYear() || getWeek(last) !== getWeek(now)) {
        return 0;
      }
      break;
    }
    case "monthly":
      if (
        last.getUTCFullYear() !== now.getUTCFullYear() ||
        last.getUTCMonth() !== now.getUTCMonth()
      ) {
        return 0;
      }
      break;
  }
  return feature.usageCount;
}

// Check if user has quota for a feature
export async function checkUserQuota(userId: string, slug: FeatureSlug) {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  try {
    const quotaDoc = await db.collection("quota_history").doc(userId).get();
    if (!quotaDoc.exists) {
      // Seed quota history from tier
      return await createQuotaHistoryFromTier(userId, slug);
    }
    const quotaHistory = quotaDoc.data() as QuotaHistory;
    const feature = quotaHistory.features.find((f: QuotaFeature) => f.slug === slug);
    if (!feature) {
      throw new Error(`Feature ${slug} not found in quota history for user ${userId}`);
    }
    const now = new Date();
    const currentCount = resetIfNewInterval(feature, now);
    return {
      allowed: currentCount < feature.maxQuota,
      count: currentCount,
      limit: feature.maxQuota,
    };
  } finally {
    closeFirebaseApp();
  }
}

// Seed quota history for a user from their tier
export async function createQuotaHistoryFromTier(
  userId: string,
  slug: FeatureSlug,
  closeApp: boolean = true
) {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  try {
    // Get user doc by querying userId field (not document ID)
    const userQuery = db.collection("users").where("userId", "==", userId).limit(1);
    const userSnap = await userQuery.get();

    if (userSnap.empty) throw new Error(`User not found: ${userId}`);

    const userDoc = userSnap.docs[0];
    if (!userDoc) throw new Error(`User document not found: ${userId}`);

    const user = userDoc.data();
    const tierId = user.tierId || process.env.DEFAULT_TIER_ID || "starter";
    // Get tier doc
    const tierSnap = await db.collection("tiers").doc(tierId).get();
    if (!tierSnap.exists) throw new Error(`Tier not found: ${tierId}`);
    const tier = tierSnap.data() as Tier;
    // Build features
    const features = (tier.features || []).map((f: any) => ({
      ...f,
      usageCount: 0,
      lastUsed: null,
    }));
    const now = new Date();
    const quotaHistory: QuotaHistory = {
      userId,
      tierId,
      lastSubscriptionDate: now,
      features,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("quota_history").doc(userId).set(quotaHistory);
    const target = features.find((f: QuotaFeature) => f.slug === slug);
    return {
      allowed: true,
      count: 0,
      limit: target?.maxQuota ?? 0,
    };
  } finally {
    if (closeApp) {
      closeFirebaseApp();
    }
  }
}

// Increment quota usage for a feature
export async function updateUserQuota(userId: string, slug: FeatureSlug) {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  try {
    const quotaDoc = await db.collection("quota_history").doc(userId).get();
    if (!quotaDoc.exists) throw new Error(`No quota history for user ${userId}`);
    const quotaHistory = quotaDoc.data() as QuotaHistory;
    const now = new Date();
    const features = quotaHistory.features.map((f: QuotaFeature) => {
      if (f.slug === slug) {
        const resetCount = resetIfNewInterval(f, now);
        return {
          ...f,
          usageCount: resetCount + 1,
          lastUsed: now,
        };
      }
      return f;
    });
    await db.collection("quota_history").doc(userId).set(
      {
        features,
        updatedAt: now,
      },
      { merge: true }
    );
    return true;
  } finally {
    closeFirebaseApp();
  }
}

// Check and update quota in one call
export async function checkAndUpdateQuota(userId: string, slug: FeatureSlug) {
  const result = await checkUserQuota(userId, slug);
  if (!result.allowed) return result;
  await updateUserQuota(userId, slug);
  return { ...result, count: result.count + 1 };
}
