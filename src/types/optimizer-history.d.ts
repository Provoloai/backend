export type OptimizerType = "upwork" | "linkedin";

export interface OptimizerResponseSections {
  weaknessesAndOptimization: string;
  optimizedProfileOverview: string;
  suggestedProjectTitles: string;
  recommendedVisuals: string;
  beforeAfterComparison: string;
}

export interface OptimizerHistoryRecord {
  id: string;
  userId: string;
  optimizerType: OptimizerType;
  originalInput: string; // raw submitted profile content
  response: OptimizerResponseSections; // AI generated sections
  createdAt: Date;
  updatedAt: Date;
}

export interface OptimizerHistoryCreate {
  userId: string;
  optimizerType: OptimizerType;
  originalInput: string;
  response: OptimizerResponseSections;
}

export interface OptimizerHistoryPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
