import type { Feature } from "./tiers.ts";

export interface QuotaFeature extends Feature {
  usageCount: number;
  lastUsed: Date | null;
}

export interface QuotaHistory {
  userId: string;
  tierId: string;
  lastSubscriptionDate: Date;
  features: QuotaFeature[];
  createdAt: Date;
  updatedAt: Date;
}
