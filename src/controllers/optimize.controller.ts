import type { Request, Response } from "express";
import {
  optimizerPrompt,
  optimizerSystemInstruction,
  linkedinOptimizerPrompt,
  linkedinOptimizerSystemInstruction,
  proposalPrompt,
  proposalSystemInstruction,
} from "../utils/prompt.utils.ts";
import { updateUserQuota, checkUserQuota } from "../utils/quota.utils.ts";
import { callGemini } from "../utils/geminiClient.ts";
import { newErrorResponse, newSuccessResponse } from "../utils/apiResponse.ts";
import type { ProposalReq, ProposalResponse } from "../types/proposal.types.ts";

interface PromptReq {
  full_name: string;
  professional_title: string;
  profile: string;
}

export async function optimizeProfile(req: Request, res: Response) {
  try {
    // 1. Get user ID from auth middleware
    const userId = req.userID as string;
    if (!userId) {
      return res.status(401).json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    // 2. Check quota
    let quotaResult;
    try {
      quotaResult = await checkUserQuota(userId, "upwork_profile_optimizer");
      console.log("Quota result for user", userId, ":", quotaResult);
    } catch (err: any) {
      console.error("[optimizeProfile] Quota check error:", err);
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Internal Server Error",
            "An error occurred. Please try again or contact support."
          )
        );
    }
    if (!quotaResult.allowed) {
      return res
        .status(429)
        .json(
          newErrorResponse(
            "Quota Exceeded",
            `Quota limit exceeded for profile optimizer. Current usage: ${quotaResult.count}/${quotaResult.limit}. Try again in the next period.`
          )
        );
    }

    // 3. Validate input
    const { full_name, professional_title, profile } = req.body as PromptReq;
    if (!full_name || !professional_title || !profile) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Missing required fields: full_name, professional_title, profile"
          )
        );
    }
    if (full_name.length > 100 || professional_title.length > 200 || profile.length > 5000) {
      return res
        .status(400)
        .json(newErrorResponse("Validation Error", "Input fields exceed allowed length."));
    }

    // 4. Sanitize input (simple trim)
    const sanitizedFullName = full_name.trim();
    const sanitizedTitle = professional_title.trim();
    const sanitizedProfile = profile.trim();

    const inputContent = `Freelancer Name: ${sanitizedFullName}\nTitle: ${sanitizedTitle}\n\n Profile Description:\n${sanitizedProfile}`;
    const content = optimizerPrompt(inputContent);

    // 5. Call AI model (replace with your actual AI call)
    let aiResponseText = "";
    try {
      aiResponseText = await callGemini(content, optimizerSystemInstruction());
    } catch (err: any) {
      console.error("[optimizeProfile] AI service call failed:", err);
      return res
        .status(500)
        .json(
          newErrorResponse(
            "AI Service Error",
            "An error occurred. Please try again or contact support."
          )
        );
    }

    // 6. Parse AI response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponseText);
    } catch (err) {
      console.error(
        "[optimizeProfile] Failed to parse AI response:",
        err,
        "Response text:",
        aiResponseText
      );
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Processing Error",
            "An error occurred. Please try again or contact support."
          )
        );
    }

    // 7. Update quota after success
    // Only increment quota if the tier is limited
    if (quotaResult.limit !== -1) {
      try {
        await updateUserQuota(userId, "upwork_profile_optimizer");
      } catch (err) {
        // Log but do not fail the request
        console.warn("Warning: Failed to update quota for user", userId, err);
      }
    }

    // 8. Return success
    return res
      .status(200)
      .json(
        newSuccessResponse(
          "Optimization Successful",
          "Profile optimized successfully",
          parsedResponse
        )
      );
  } catch (err) {
    // Top-level catch for any unexpected errors
    console.error("[optimizeProfile] Unhandled error:", err);
    return res
      .status(500)
      .json(
        newErrorResponse(
          "Internal Server Error",
          "An error occurred. Please try again or contact support."
        )
      );
  }
}

export async function optimizeLinkedIn(req: Request, res: Response) {
  try {
    // 1. Get user ID from auth middleware
    const userId = req.userID as string;
    if (!userId) {
      return res.status(401).json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    // 2. Check quota
    let quotaResult;
    try {
      quotaResult = await checkUserQuota(userId, "linkedin_profile_optimizer");
      console.log("Quota result for user", userId, ":", quotaResult);
    } catch (err: any) {
      console.error("[optimizeLinkedIn] Quota check error:", err);
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Internal Server Error",
            "An error occurred. Please try again or contact support."
          )
        );
    }
    if (!quotaResult.allowed) {
      return res
        .status(429)
        .json(
          newErrorResponse(
            "Quota Exceeded",
            `Quota limit exceeded for profile optimizer. Current usage: ${quotaResult.count}/${quotaResult.limit}. Try again in the next period.`
          )
        );
    }

    // 3. Validate input
    const { full_name, professional_title, profile } = req.body as PromptReq;
    if (!full_name || !professional_title || !profile) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Missing required fields: full_name, professional_title, profile"
          )
        );
    }
    if (full_name.length > 100 || professional_title.length > 200 || profile.length > 5000) {
      return res
        .status(400)
        .json(newErrorResponse("Validation Error", "Input fields exceed allowed length."));
    }

    // 4. Sanitize input (simple trim)
    const sanitizedFullName = full_name.trim();
    const sanitizedTitle = professional_title.trim();
    const sanitizedProfile = profile.trim();

    const inputContent = `Professional Name: ${sanitizedFullName}\nTitle: ${sanitizedTitle}\n\n Profile Description:\n${sanitizedProfile}`;
    const content = linkedinOptimizerPrompt(inputContent);

    // 5. Call AI model (replace with your actual AI call)
    let aiResponseText = "";
    try {
      aiResponseText = await callGemini(content, linkedinOptimizerSystemInstruction());
    } catch (err: any) {
      console.error("[optimizeLinkedIn] AI service call failed:", err);
      return res
        .status(500)
        .json(
          newErrorResponse(
            "AI Service Error",
            "An error occurred. Please try again or contact support."
          )
        );
    }

    // 6. Parse AI response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponseText);
    } catch (err) {
      console.error(
        "[optimizeLinkedIn] Failed to parse AI response:",
        err,
        "Response text:",
        aiResponseText
      );
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Processing Error",
            "An error occurred. Please try again or contact support."
          )
        );
    }

    // 7. Update quota after success
    // Only increment quota if the tier is limited
    if (quotaResult.limit !== -1) {
      try {
        await updateUserQuota(userId, "linkedin_profile_optimizer");
      } catch (err) {
        // Log but do not fail the request
        console.warn("Warning: Failed to update quota for user", userId, err);
      }
    }

    // 8. Return success
    return res
      .status(200)
      .json(
        newSuccessResponse(
          "Optimization Successful",
          "LinkedIn profile optimized successfully",
          parsedResponse
        )
      );
  } catch (err) {
    // Top-level catch for any unexpected errors
    console.error("[optimizeLinkedIn] Unhandled error:", err);
    return res
      .status(500)
      .json(
        newErrorResponse(
          "Internal Server Error",
          "An error occurred. Please try again or contact support."
        )
      );
  }
}

export async function generateProposal(req: Request, res: Response) {
  try {
    // 1. Get user ID from auth middleware
    const userId = req.userID as string;
    if (!userId) {
      return res.status(401).json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    // 2. Check quota
    let quotaResult;
    try {
      quotaResult = await checkUserQuota(userId, "ai_proposals");
      console.log("Quota result for user", userId, ":", quotaResult);
    } catch (err: any) {
      console.error("[generateProposal] Quota check error:", err);
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Internal Server Error",
            "An error occurred. Please try again or contact support."
          )
        );
    }
    if (!quotaResult.allowed) {
      return res
        .status(429)
        .json(
          newErrorResponse(
            "Quota Exceeded",
            `Quota limit exceeded for AI proposals. Current usage: ${quotaResult.count}/${quotaResult.limit}. Try again in the next period.`
          )
        );
    }

    // 3. Validate input
    const { client_name, proposal_tone, job_summary } = req.body as ProposalReq;
    if (!client_name || !proposal_tone || !job_summary) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Missing required fields: client_name, proposal_tone, job_summary"
          )
        );
    }
    if (client_name.length > 100 || job_summary.length > 2000) {
      return res
        .status(400)
        .json(newErrorResponse("Validation Error", "Input fields exceed allowed length."));
    }
    const validTones = ["professional", "conversational", "confident", "calm"];
    if (!validTones.includes(proposal_tone)) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Validation Error",
            "Invalid proposal tone. Must be one of: professional, conversational, confident, calm"
          )
        );
    }

    // 4. Sanitize input (simple trim)
    const sanitizedClientName = client_name.trim();
    const sanitizedJobSummary = job_summary.trim();

    const inputContent = `Client Name: ${sanitizedClientName}\nProposal Tone: ${proposal_tone}\n\nJob Summary:\n${sanitizedJobSummary}`;
    const content = proposalPrompt(inputContent);

    // 5. Call AI model
    let aiResponseText = "";
    try {
      aiResponseText = await callGemini(content, proposalSystemInstruction());
    } catch (err: any) {
      console.error("[generateProposal] AI service call failed:", err);
      return res
        .status(500)
        .json(
          newErrorResponse(
            "AI Service Error",
            "An error occurred. Please try again or contact support."
          )
        );
    }

    // 6. Parse AI response
    let parsedResponse: ProposalResponse;
    try {
      parsedResponse = JSON.parse(aiResponseText);
    } catch (err) {
      console.error(
        "[generateProposal] Failed to parse AI response:",
        err,
        "Response text:",
        aiResponseText
      );
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Processing Error",
            "An error occurred. Please try again or contact support."
          )
        );
    }

    // 6.5. Combine components into MDX
    const mdxContent = `${parsedResponse.hook}

${parsedResponse.solution}

${parsedResponse.keyPoints.map((point) => `• ${point}`).join("\n")}

${parsedResponse.portfolioLink ? `Portfolio: ${parsedResponse.portfolioLink}` : ""}

${parsedResponse.availability}

${parsedResponse.support}

${parsedResponse.closing}`;

    parsedResponse.mdx = mdxContent.trim();

    // 7. Update quota after success
    // Only increment quota if the tier is limited
    if (quotaResult.limit !== -1) {
      try {
        await updateUserQuota(userId, "ai_proposals");
      } catch (err) {
        // Log but do not fail the request
        console.warn("Warning: Failed to update quota for user", userId, err);
      }
    }

    // 8. Return success
    return res
      .status(200)
      .json(
        newSuccessResponse(
          "Proposal Generated",
          "AI proposal generated successfully",
          parsedResponse
        )
      );
  } catch (err) {
    // Top-level catch for any unexpected errors
    console.error("[generateProposal] Unhandled error:", err);
    return res
      .status(500)
      .json(
        newErrorResponse(
          "Internal Server Error",
          "An error occurred. Please try again or contact support."
        )
      );
  }
}
