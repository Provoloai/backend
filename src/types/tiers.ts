export type RecurringInterval = "daily" | "weekly" | "monthly";
export type PlanRecurringInterval = "monthly";
export type FeatureSlug =
  | "upwork_profile_optimizer"
  | "linkedin_profile_optimizer"
  | "ai_proposals"
  | "resume_generator"
  | "advanced_ai_insights"
  | "comunity_access"
  | "newsletters";

export interface Feature {
  name: string;
  description: string;
  slug: FeatureSlug;
  limited: boolean;
  maxQuota: number;
  recurringInterval: RecurringInterval | "";
}

export interface Tier {
  name: string;
  slug: string;
  polarRefId: string;
  price: number;
  description: string;
  recurringInterval: PlanRecurringInterval;
  features: Feature[];
  createdAt: Date;
  updatedAt: Date;
}
