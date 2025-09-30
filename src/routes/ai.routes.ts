import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.ts";
import {
  optimizeProfile,
  optimizeLinkedIn,
  generateProposal,
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
 *               - proposal_tone
 *               - job_summary
 *             properties:
 *               client_name:
 *                 type: string
 *                 maxLength: 100
 *                 description: The client's name or company name
 *                 example: "TechStartup Inc."
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

export default aiRouter;
