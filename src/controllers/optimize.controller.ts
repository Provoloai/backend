import type { Request, Response } from "express";
import {
  optimizerPrompt,
  optimizerSystemInstruction,
  linkedinOptimizerPrompt,
  linkedinOptimizerSystemInstruction,
  proposalPrompt,
  proposalSystemInstruction,
  storeProposalHistory,
  getUserProposalHistory,
  getProposalById,
  refineProposalPrompt,
  refineProposalSystemInstruction,
  getLatestProposalVersion,
  storeRefinement,
  getProposalVersions,
} from "../utils/prompt.utils.ts";
import { updateUserQuota, checkUserQuota } from "../utils/quota.utils.ts";
import { callGemini } from "../utils/geminiClient.ts";
import { newErrorResponse, newSuccessResponse } from "../utils/apiResponse.ts";
import type {
  ProposalReq,
  ProposalResponse,
  AIErrorResponse,
  ProposalHistoryReq,
  RefineProposalReq,
  RefinementAction,
} from "../types/proposal.types.ts";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseApp } from "../utils/getFirebaseApp.ts";

// Helper function to get user display name from database if not in token
async function getUserDisplayName(userId: string, tokenDisplayName?: string): Promise<string | undefined> {
  if (tokenDisplayName) {
    return tokenDisplayName;
  }
  
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    const userSnap = await db.collection("users").where("userId", "==", userId).limit(1).get();
    
    if (!userSnap.empty && userSnap.docs[0]) {
      const userData = userSnap.docs[0].data();
      return userData.displayName;
    }
  } catch (err) {
    console.error("[getUserDisplayName] Error fetching display name:", err);
  }
  
  return undefined;
}

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
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
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
      const limitText =
        quotaResult.limit === -1 ? "unlimited" : quotaResult.limit.toString();
      return res
        .status(429)
        .json(
          newErrorResponse(
            "Quota Exceeded",
            `Quota limit exceeded for profile optimizer. Current usage: ${quotaResult.count}/${limitText}. Try again in the next period.`
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
    if (
      full_name.length > 100 ||
      professional_title.length > 200 ||
      profile.length > 5000
    ) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Validation Error",
            "Input fields exceed allowed length."
          )
        );
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
        "[optimizeProfile] Unexpected JSON parse failure after validation:",
        err instanceof Error ? err.message : String(err),
        "Response text:",
        aiResponseText.substring(0, 500) + "..."
      );
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Processing Error",
            "The AI response could not be processed. Please try again or contact support."
          )
        );
    }

    // 7. Update quota after success
    // Increment quota for everyone, regardless of limit
    try {
      await updateUserQuota(userId, "upwork_profile_optimizer");
    } catch (err) {
      // Log but do not fail the request
      console.warn("Warning: Failed to update quota for user", userId, err);
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
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
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
      const limitText =
        quotaResult.limit === -1 ? "unlimited" : quotaResult.limit.toString();
      return res
        .status(429)
        .json(
          newErrorResponse(
            "Quota Exceeded",
            `Quota limit exceeded for profile optimizer. Current usage: ${quotaResult.count}/${limitText}. Try again in the next period.`
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
    if (
      full_name.length > 100 ||
      professional_title.length > 200 ||
      profile.length > 5000
    ) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Validation Error",
            "Input fields exceed allowed length."
          )
        );
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
      aiResponseText = await callGemini(
        content,
        linkedinOptimizerSystemInstruction()
      );
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
        "[optimizeLinkedIn] Unexpected JSON parse failure after validation:",
        err instanceof Error ? err.message : String(err),
        "Response text:",
        aiResponseText.substring(0, 500) + "..."
      );
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Processing Error",
            "The AI response could not be processed. Please try again or contact support."
          )
        );
    }

    // 7. Update quota after success
    try {
      await updateUserQuota(userId, "linkedin_profile_optimizer");
    } catch (err) {
      // Log but do not fail the request
      console.warn("Warning: Failed to update quota for user", userId, err);
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
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    // 2. Check quota
    let quotaResult;
    try {
      quotaResult = await checkUserQuota(userId, "ai_proposals");
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
      const limitText =
        quotaResult.limit === -1 ? "unlimited" : quotaResult.limit.toString();
      return res
        .status(429)
        .json(
          newErrorResponse(
            "Quota Exceeded",
            `Quota limit exceeded for AI proposals. Current usage: ${quotaResult.count}/${limitText}. Try again in the next period.`
          )
        );
    }

    // 3. Validate input
    const { client_name, job_title, proposal_tone, job_summary } =
      req.body as ProposalReq;
    if (!client_name || !job_title || !proposal_tone || !job_summary) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Missing required fields: client_name, job_title, proposal_tone, job_summary"
          )
        );
    }
    if (
      client_name.length > 100 ||
      job_title.length > 200 ||
      job_summary.length > 2000
    ) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Validation Error",
            "Input fields exceed allowed length."
          )
        );
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

    // 4. Get user display name
    const displayName = await getUserDisplayName(userId, req.userDisplayName);

    // 5. Sanitize input (simple trim)
    const sanitizedClientName = client_name.trim();
    const sanitizedJobTitle = job_title.trim();
    const sanitizedJobSummary = job_summary.trim();

    const inputContent = `Client Name: ${sanitizedClientName}\nJob Title: ${sanitizedJobTitle}\nProposal Tone: ${proposal_tone}\n\nJob Summary:\n${sanitizedJobSummary}`;
    const content = proposalPrompt(inputContent, displayName);

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
    let parsedResponse: ProposalResponse | AIErrorResponse;
    let proposalResponse: ProposalResponse;

    try {
      parsedResponse = JSON.parse(aiResponseText);

      // Check if AI returned an error response
      if ("error" in parsedResponse && parsedResponse.error === true) {
        // Handle different error types
        if (parsedResponse.code === "OUT_OF_SCOPE") {
          return res
            .status(400)
            .json(
              newErrorResponse(
                "Out of Scope",
                parsedResponse.message ||
                  "This type of work is not supported. Please provide a web development related project."
              )
            );
        } else if (parsedResponse.code === "INVALID_INPUT") {
          return res
            .status(400)
            .json(
              newErrorResponse(
                "Invalid Input",
                parsedResponse.message ||
                  "The provided information is not valid. Please check your input and try again."
              )
            );
        } else if (parsedResponse.code === "CONTENT_TOO_LONG") {
          return res
            .status(400)
            .json(
              newErrorResponse(
                "Content Too Long",
                parsedResponse.message ||
                  "The job description is too long. Please provide a shorter summary."
              )
            );
        } else {
          return res
            .status(400)
            .json(
              newErrorResponse(
                "AI Error",
                parsedResponse.message ||
                  "The AI service encountered an error. Please try again."
              )
            );
        }
      }

      // At this point, parsedResponse should be a ProposalResponse
      proposalResponse = parsedResponse as ProposalResponse;
    } catch (err) {
      console.error(
        "[generateProposal] Unexpected JSON parse failure after validation:",
        err instanceof Error ? err.message : String(err),
        "Response text:",
        aiResponseText.substring(0, 500) + "..."
      );
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Processing Error",
            "The AI response could not be processed. Please try again or contact support."
          )
        );
    }

    // 6.1. Validate parsed response structure
    if (!proposalResponse) {
      console.error("[generateProposal] Parsed response is null/undefined");
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Processing Error",
            "The AI response was empty. Please try again or contact support."
          )
        );
    }

    // Ensure keyPoints is an array
    if (!Array.isArray(proposalResponse.keyPoints)) {
      proposalResponse.keyPoints = [];
    }

    // Ensure all required fields exist
    const requiredFields = [
      "hook",
      "solution",
      "availability",
      "support",
      "closing",
    ];
    for (const field of requiredFields) {
      if (!proposalResponse[field as keyof ProposalResponse]) {
        (proposalResponse as any)[field] = `[${field} not provided]`;
      }
    }

    // 6.5. Combine components into MDX
    const mdxContent = `${proposalResponse.hook}

${proposalResponse.solution}

${proposalResponse.keyPoints.map((point: string) => `• ${point}`).join("\n")}

${
  proposalResponse.portfolioLink
    ? `Portfolio: ${proposalResponse.portfolioLink}`
    : ""
}

${proposalResponse.availability}

${proposalResponse.support}

${proposalResponse.closing}`;

    proposalResponse.mdx = mdxContent.trim();

    // 7. Store proposal history and get the proposal ID
    let proposalId: string | undefined;
    try {
      proposalId = await storeProposalHistory(
        userId,
        {
          client_name: sanitizedClientName,
          job_title: sanitizedJobTitle,
          proposal_tone: proposal_tone,
          job_summary: sanitizedJobSummary,
        },
        proposalResponse
      );
      // Add proposal ID to response
      proposalResponse.proposalId = proposalId;
    } catch (err) {
      console.warn(
        "Warning: Failed to store proposal history for user",
        userId,
        err
      );
    }

    // 8. Update quota after success
    try {
      await updateUserQuota(userId, "ai_proposals");
    } catch (err) {
      // Log but do not fail the request
      console.warn("Warning: Failed to update quota for user", userId, err);
    }

    // 9. Return success
    return res
      .status(200)
      .json(
        newSuccessResponse(
          "Proposal Generated",
          "AI proposal generated successfully",
          proposalResponse
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

// Get user's AI proposal history
export async function getProposalHistory(req: Request, res: Response) {
  try {
    // 1. Get user ID from auth middleware
    const userId = req.userID as string;
    if (!userId) {
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    // 2. Parse query parameters
    const { page = 1, limit = 10, search } = req.query as ProposalHistoryReq;
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);

    // 3. Validate pagination parameters
    if (pageNum < 1 || limitNum < 1 || limitNum > 50) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Page must be >= 1, limit must be between 1 and 50"
          )
        );
    }

    // 4. Get proposal history with optional search
    const result = await getUserProposalHistory(userId, pageNum, limitNum, search);

    // 5. Return success
    return res.status(200).json(
      newSuccessResponse(
        "Proposal History Retrieved",
        "AI proposal history retrieved successfully",
        {
          proposals: result.proposals,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: result.total,
            hasMore: result.hasMore,
          },
        }
      )
    );
  } catch (err) {
    console.error("[getProposalHistory] Error:", err);
    return res
      .status(500)
      .json(
        newErrorResponse(
          "Internal Server Error",
          "An error occurred while retrieving proposal history. Please try again or contact support."
        )
      );
  }
}

// Get a specific proposal by ID
export async function getProposalByIdController(req: Request, res: Response) {
  try {
    // 1. Get user ID from auth middleware
    const userId = req.userID as string;
    if (!userId) {
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    // 2. Get proposal ID from params
    const { proposalId } = req.params;
    if (!proposalId) {
      return res
        .status(400)
        .json(newErrorResponse("Invalid Request", "Proposal ID is required"));
    }

    // 3. Get proposal by ID
    const proposal = await getProposalById(userId, proposalId);
    if (!proposal) {
      return res
        .status(404)
        .json(
          newErrorResponse("Not Found", "Proposal not found or access denied")
        );
    }

    // 4. Return success
    return res
      .status(200)
      .json(
        newSuccessResponse(
          "Proposal Retrieved",
          "AI proposal retrieved successfully",
          proposal
        )
      );
  } catch (err) {
    console.error("[getProposalByIdController] Error:", err);
    return res
      .status(500)
      .json(
        newErrorResponse(
          "Internal Server Error",
          "An error occurred while retrieving the proposal. Please try again or contact support."
        )
      );
  }
}

export async function refineProposal(req: Request, res: Response) {
  try {
    // 1. Auth check
    const userId = req.userID as string;
    if (!userId) {
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    // 2. Validate input
    const { proposalId, refinementType, newTone } = req.body as RefineProposalReq;
    
    if (!proposalId || !refinementType) {
      return res.status(400).json(
        newErrorResponse("Invalid Request", "Missing proposalId or refinementType")
      );
    }

    const validRefinementTypes: RefinementAction[] = [
      "expand_text", "trim_text", "simplify_text", "improve_flow", "change_tone"
    ];
    
    if (!validRefinementTypes.includes(refinementType)) {
      return res.status(400).json(
        newErrorResponse("Invalid Request", "Invalid refinement type")
      );
    }

    // Change tone requires newTone
    if (refinementType === "change_tone" && !newTone) {
      return res.status(400).json(
        newErrorResponse("Invalid Request", "newTone required for change_tone refinement")
      );
    }

    // 3. Get proposal details
    const proposal = await getProposalById(userId, proposalId);
    if (!proposal) {
      return res.status(404).json(
        newErrorResponse("Not Found", "Proposal not found")
      );
    }

    // 4. Get latest version (could be refined already)
    const { proposal: currentProposal, refinementOrder } = await getLatestProposalVersion(proposalId, userId);

    // 4a. Get user display name
    const displayName = await getUserDisplayName(userId, req.userDisplayName);

    // 5. Call AI for refinement
    const prompt = refineProposalPrompt(
      currentProposal,
      refinementType,
      proposal.jobTitle,
      proposal.clientName,
      newTone || proposal.proposalTone,
      displayName
    );

    let aiResponseText = "";
    try {
      aiResponseText = await callGemini(prompt, refineProposalSystemInstruction());
    } catch (err: any) {
      console.error("[refineProposal] AI call failed:", err);
      return res.status(500).json(
        newErrorResponse("AI Service Error", "Failed to refine proposal. Please try again.")
      );
    }

    // 6. Parse AI response
    let refinedProposal: ProposalResponse;
    try {
      refinedProposal = JSON.parse(aiResponseText) as ProposalResponse;
    } catch (err) {
      console.error("[refineProposal] JSON parse failed:", err);
      return res.status(500).json(
        newErrorResponse("Processing Error", "Failed to process refined proposal.")
      );
    }

    // 7. Store refinement
    await storeRefinement(
      proposalId,
      userId,
      refinementType,
      currentProposal,
      refinedProposal,
      refinementOrder
    );

    // 8. Return success
    return res.status(200).json(
      newSuccessResponse(
        "Proposal Refined",
        "Proposal refined successfully",
        refinedProposal
      )
    );
  } catch (err) {
    console.error("[refineProposal] Error:", err);
    return res.status(500).json(
      newErrorResponse("Internal Server Error", "An error occurred while refining the proposal.")
    );
  }
}

// Get all versions of a proposal
export async function getProposalVersionsController(req: Request, res: Response) {
  try {
    const userId = req.userID as string;
    if (!userId) {
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    const { proposalId } = req.params;
    if (!proposalId) {
      return res.status(400).json(
        newErrorResponse("Invalid Request", "Proposal ID is required")
      );
    }

    const versions = await getProposalVersions(proposalId, userId);

    return res.status(200).json(
      newSuccessResponse(
        "Versions Retrieved",
        "Proposal versions retrieved successfully",
        { versions }
      )
    );
  } catch (err) {
    console.error("[getProposalVersionsController] Error:", err);
    return res.status(500).json(
      newErrorResponse("Internal Server Error", "An error occurred while retrieving proposal versions.")
    );
  }
}

// Cron: delete proposal history older than 30 days
export async function cleanupOldProposalHistory(req: Request, res: Response) {
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);

    const secret = process.env.CRON_SECRET;
    if (secret) {
      const provided = req.headers["x-cron-secret"] as string | undefined;
      if (!provided || provided !== secret) {
        return res.status(401).json(newErrorResponse("Unauthorized", "Invalid cron secret"));
      }
    }

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let deleted = 0;

    while (true) {
      const snap = await db
        .collection("proposal_history")
        .where("createdAt", "<", cutoff)
        .orderBy("createdAt", "asc")
        .limit(500)
        .get();

      if (snap.empty) break;

      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      deleted += snap.size;

      if (snap.size < 500) break;
    }

    return res
      .status(200)
      .json(
        newSuccessResponse(
          "Cleanup Completed",
          "Deleted proposal history older than 30 days",
          { deleted, cutoff: cutoff.toISOString() }
        )
      );
  } catch (err) {
    console.error("[cleanupOldProposalHistory] Error:", err);
    return res
      .status(500)
      .json(newErrorResponse("Internal Server Error", "Cleanup failed"));
  }
}
