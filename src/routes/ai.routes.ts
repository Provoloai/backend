import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.ts";
import {
  optimizeProfile,
  optimizeLinkedIn,
  generateProposal,
  getProposalHistory,
  getProposalByIdController,
} from "../controllers/optimize.controller.ts";

const aiRouter: ExpressRouter = Router();

/**
 * @openapi
 * /api/v1/ai/optimize-upwork:
 *   post:
 *     summary: Optimize freelancer Upwork profile using AI
 *     description: Analyzes and optimizes a freelancer's Upwork profile content using AI to improve client attraction and profile effectiveness.
 *     tags:
 *       - AI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: John Doe
 *                 description: Freelancer's full name (max 100 characters)
 *               professional_title:
 *                 type: string
 *                 example: Full Stack Developer
 *                 description: Professional title or role (max 200 characters)
 *               profile:
 *                 type: string
 *                 example: Experienced developer with 5+ years in web development...
 *                 description: Profile description or bio (max 1000 characters)
 *             required:
 *               - full_name
 *               - professional_title
 *               - profile
 *     responses:
 *       200:
 *         description: Profile optimization completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     weaknessesAndOptimization:
 *                       type: string
 *                     optimizedProfileOverview:
 *                       type: string
 *                     suggestedProjectTitles:
 *                       type: string
 *                     recommendedVisuals:
 *                       type: string
 *                     beforeAfterComparison:
 *                       type: string
 *       400:
 *         description: Bad Request - Invalid input validation
 *       401:
 *         description: Unauthorized - Unauthorized
 *       429:
 *         description: Too Many Requests - Daily limit exceeded
 *       500:
 *         description: Internal Server Error - AI service or client creation failed
 */
aiRouter.post("/optimize-upwork", authMiddleware, optimizeProfile);

/**
 * @swagger
 * /api/v1/ai/optimize-linkedin:
 *   post:
 *     summary: Optimize LinkedIn Profile
 *     description: Uses AI to analyze and optimize a LinkedIn professional profile for better networking and job opportunities
 *     tags:
 *       - AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - full_name
 *               - professional_title
 *               - profile
 *             properties:
 *               full_name:
 *                 type: string
 *                 maxLength: 100
 *                 description: The professional's full name
 *                 example: "John Smith"
 *               professional_title:
 *                 type: string
 *                 maxLength: 200
 *                 description: Current professional title or headline
 *                 example: "Senior Software Engineer"
 *               profile:
 *                 type: string
 *                 maxLength: 5000
 *                 description: Current LinkedIn profile content (summary, experience, etc.)
 *                 example: "Experienced software engineer with 5+ years in web development..."
 *     responses:
 *       200:
 *         description: LinkedIn profile optimization successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Optimization Successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     weaknessesAndOptimization:
 *                       type: string
 *                     optimizedProfileOverview:
 *                       type: string
 *                     suggestedProjectTitles:
 *                       type: string
 *                     recommendedVisuals:
 *                       type: string
 *                     beforeAfterComparison:
 *                       type: string
 *       400:
 *         description: Bad Request - Invalid input validation
 *       401:
 *         description: Unauthorized - Unauthorized
 *       429:
 *         description: Too Many Requests - Daily limit exceeded
 *       500:
 *         description: Internal Server Error - AI service or client creation failed
 */
aiRouter.post("/optimize-linkedin", authMiddleware, optimizeLinkedIn);

/**
 * @swagger
 * /api/v1/ai/generate-proposal:
 *   post:
 *     summary: Generate AI Proposal
 *     description: Uses AI to generate high-converting Upwork proposals based on job requirements and client information
 *     tags:
 *       - AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_name
 *               - job_title
 *               - proposal_tone
 *               - job_summary
 *             properties:
 *               client_name:
 *                 type: string
 *                 maxLength: 100
 *                 description: The client's name or company name
 *                 example: "TechStartup Inc."
 *               job_title:
 *                 type: string
 *                 maxLength: 200
 *                 description: The job title for the position
 *                 example: "WordPress Developer"
 *               proposal_tone:
 *                 type: string
 *                 enum: [professional, conversational, confident, calm]
 *                 description: The desired tone for the proposal
 *                 example: "professional"
 *               job_summary:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Summary of the job posting including requirements, budget, and key details
 *                 example: "Looking for a WordPress developer to build a custom e-commerce site with payment integration..."
 *     responses:
 *       200:
 *         description: Proposal generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Proposal Generated"
 *                 data:
 *                   type: object
 *                   properties:
 *                     hook:
 *                       type: string
 *                       description: Attention-grabbing opening statement
 *                     solution:
 *                       type: string
 *                       description: How you'll solve their problem
 *                     keyPoints:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Bullet points with emojis highlighting services
 *                     portfolioLink:
 *                       type: string
 *                       description: Portfolio URL if relevant
 *                     availability:
 *                       type: string
 *                       description: Availability statement
 *                     support:
 *                       type: string
 *                       description: Post-launch support information
 *                     closing:
 *                       type: string
 *                       description: Call-to-action to move forward
 *                     mdx:
 *                       type: string
 *                       description: Complete proposal as formatted markdown text
 *                       example: "Hi [Client Name]! I noticed you're looking for a WordPress developer...\n\nI can help you build a custom e-commerce solution...\n\n• ✅ Custom WordPress development\n• 🚀 E-commerce integration\n• 🎯 SEO optimization\n\nPortfolio: https://example.com\n\nI'm available to start immediately!\n\nI provide 30 days of free support after launch.\n\nLet's discuss your project!"
 *       400:
 *         description: Bad Request - Invalid input validation
 *       401:
 *         description: Unauthorized - Unauthorized
 *       429:
 *         description: Too Many Requests - Daily limit exceeded
 *       500:
 *         description: Internal Server Error - AI service or client creation failed
 */
aiRouter.post("/generate-proposal", authMiddleware, generateProposal);

/**
 * @swagger
 * /api/v1/ai/proposal-history:
 *   get:
 *     summary: Get AI Proposal History
 *     description: Retrieves the user's AI proposal generation history with pagination and optional search
 *     tags:
 *       - AI
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of proposals per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter by job title, client name, or job summary
 *         example: "WordPress Developer"
 *     responses:
 *       200:
 *         description: Proposal history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Proposal History Retrieved"
 *                 data:
 *                   type: object
 *                   properties:
 *                     proposals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Unique proposal ID
 *                           clientName:
 *                             type: string
 *                             description: Client name
 *                           jobTitle:
 *                             type: string
 *                             description: Job title for the position
 *                           proposalTone:
 *                             type: string
 *                             enum: [professional, conversational, confident, calm]
 *                           jobSummary:
 *                             type: string
 *                             description: Job summary used for generation
 *                           proposalResponse:
 *                             type: object
 *                             description: Generated proposal content
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: When the proposal was created
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                             description: When the proposal was last updated
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           description: Current page number
 *                         limit:
 *                           type: integer
 *                           description: Number of items per page
 *                         total:
 *                           type: integer
 *                           description: Total number of proposals
 *                         hasMore:
 *                           type: boolean
 *                           description: Whether there are more pages available
 *       400:
 *         description: Bad Request - Invalid pagination parameters
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal Server Error - Failed to retrieve proposal history
 */
aiRouter.get("/proposal-history", authMiddleware, getProposalHistory);

/**
 * @swagger
 * /api/v1/ai/proposal-history/{proposalId}:
 *   get:
 *     summary: Get Specific AI Proposal
 *     description: Retrieves a specific AI proposal by ID (user can only access their own proposals)
 *     tags:
 *       - AI
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique proposal ID
 *     responses:
 *       200:
 *         description: Proposal retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Proposal Retrieved"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Unique proposal ID
 *                     clientName:
 *                       type: string
 *                       description: Client name
 *                     jobTitle:
 *                       type: string
 *                       description: Job title for the position
 *                     proposalTone:
 *                       type: string
 *                       enum: [professional, conversational, confident, calm]
 *                     jobSummary:
 *                       type: string
 *                       description: Job summary used for generation
 *                     proposalResponse:
 *                       type: object
 *                       description: Complete generated proposal content
 *                       properties:
 *                         hook:
 *                           type: string
 *                         solution:
 *                           type: string
 *                         keyPoints:
 *                           type: array
 *                           items:
 *                             type: string
 *                         portfolioLink:
 *                           type: string
 *                         availability:
 *                           type: string
 *                         support:
 *                           type: string
 *                         closing:
 *                           type: string
 *                         mdx:
 *                           type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad Request - Missing proposal ID
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Not Found - Proposal not found or access denied
 *       500:
 *         description: Internal Server Error - Failed to retrieve proposal
 */
aiRouter.get("/proposal-history/:proposalId", authMiddleware, getProposalByIdController);

export default aiRouter;
