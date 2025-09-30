import "dotenv/config";
import { getFirebaseApp, closeFirebaseApp } from "../utils/getFirebaseApp.ts";
import { getFirestore } from "firebase-admin/firestore";
import type { Feature, Tier } from "../types/tiers.ts";

const tiers: Tier[] = [
  {
    name: "Starter (Freemium)",
    slug: "starter",
    description: "Perfect for new freelancers and those exploring the platform.",
    recurringInterval: "monthly",
    price: 0,
    polarRefId: "d1173db4-8051-47a6-a3de-ba6296b2fb17",
    features: [
      {
        name: "Upwork Profile Optimizer",
        description: "Limited access to the Upwork Profile Optimizer feature.",
        slug: "upwork_profile_optimizer",
        limited: true,
        recurringInterval: "daily",
        maxQuota: 2,
      },
      {
        name: "Comunity Access",
        description: "Community Access.",
        slug: "comunity_access",
        limited: false,
        recurringInterval: "",
        maxQuota: 0,
      },
      {
        name: "Newsletters",
        description: "Newsletters.",
        slug: "newsletters",
        limited: false,
        recurringInterval: "",
        maxQuota: 0,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Pro",
    slug: "pro",
    description: "For freelancers actively applying for jobs and serious about getting clients.",
    recurringInterval: "monthly",
    price: 399,
    polarRefId: "503fe6a4-b148-41bb-b779-60334594794e",
    features: [
      {
        name: "Upwork Profile Optimizer",
        description: "Full access to the Upwork Profile Optimizer feature.",
        slug: "upwork_profile_optimizer",
        limited: false,
        recurringInterval: "",
        maxQuota: 0,
      },
      {
        name: "LinkedIn Profile Optimizer",
        description: "Access to the upcoming LinkedIn Profile Optimizer feature.",
        slug: "linkedin_profile_optimizer",
        limited: false,
        recurringInterval: "",
        maxQuota: 0,
      },
      {
        name: "AI Proposals",
        description: "Unlimited AI Proposals per month.",
        slug: "ai_proposals",
        limited: false,
        recurringInterval: "",
        maxQuota: 0,
      },
      {
        name: "Comunity Access",
        description: "Community Access.",
        slug: "comunity_access",
        limited: false,
        recurringInterval: "",
        maxQuota: 0,
      },
      {
        name: "Newsletters",
        description: "Newsletters.",
        slug: "newsletters",
        limited: false,
        recurringInterval: "",
        maxQuota: 0,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function validateFeatures(features: Feature[]): string | null {
  for (const f of features) {
    if (f.limited) {
      if (f.maxQuota <= 0) return `feature ${f.slug} is limited but maxQuota is not set`;
      if (!f.recurringInterval)
        return `feature ${f.slug} is limited but recurringInterval is not set`;
    } else {
      if (f.maxQuota !== 0 || f.recurringInterval !== "") {
        return `feature ${f.slug} is not limited but maxQuota/recurringInterval set`;
      }
    }
  }
  return null;
}

export async function seedTiers() {
  const app = getFirebaseApp();
  const db = getFirestore(app);

  for (const tier of tiers) {
    const error = validateFeatures(tier.features);
    if (error) {
      console.error(`Validation failed for tier ${tier.slug}: ${error}`);
      continue;
    }
    tier.createdAt = new Date();
    tier.updatedAt = new Date();

    try {
      await db.collection("tiers").doc(tier.slug).set(tier);
      console.log(`Seeded tier: ${tier.slug}`);
    } catch (err) {
      console.error(`Error seeding tier ${tier.slug}:`, err);
    }
  }
  closeFirebaseApp();
  console.log("Seeding completed ✅");
}
