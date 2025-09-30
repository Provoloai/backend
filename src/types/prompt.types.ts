export interface PromptLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
}

export interface UserPromptLimit {
  userId: string;
  promptCount: number;
  lastPromptAt: Date;
}
