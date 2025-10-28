export interface ProposalReq {
  client_name: string;
  job_title: string;
  proposal_tone: "professional" | "conversational" | "confident" | "calm";
  job_summary: string;
}

export interface ProposalResponse {
  hook: string;
  solution: string;
  keyPoints: string[];
  portfolioLink: string;
  availability: string;
  support: string;
  closing: string;
  mdx: string;
}

export interface AIErrorResponse {
  error: true;
  message: string;
  code: "OUT_OF_SCOPE" | "INVALID_INPUT" | "CONTENT_TOO_LONG" | "GENERAL_ERROR";
}

export interface ProposalHistory {
  id: string;
  userId: string;
  clientName: string;
  jobTitle: string;
  proposalTone: "professional" | "conversational" | "confident" | "calm";
  jobSummary: string;
  proposalResponse: ProposalResponse;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProposalHistoryReq {
  page?: number;
  limit?: number;
  search?: string;
}
