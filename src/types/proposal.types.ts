export interface ProposalReq {
  client_name: string;
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
  mdx: string; // Combined markdown version of all components
}
