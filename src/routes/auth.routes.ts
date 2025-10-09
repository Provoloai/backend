import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { strictRateLimiter } from "../middlewares/rateLimiter.middleware.ts";
import { authMiddleware } from "../middlewares/auth.middleware.ts";
import {
  login,
  logout,
  signupOrEnsureUser,
  updateUsername,
  verifySession,
} from "../controllers/auth.controller.ts";

const authRouter: ExpressRouter = Router();

/**
 * @openapi
 * /api/v1/auth/signup:
 *   post:
 *     summary: Signup or ensure user
 *     description: Verifies Firebase ID token, creates or retrieves user profile, sets session cookie.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Firebase ID token from client
 *             required:
 *               - idToken
 *     responses:
 *       200:
 *         description: Signup/Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Error response (any error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post("/signup", strictRateLimiter(), signupOrEnsureUser);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticates user with Firebase ID token and creates session cookie
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Firebase ID token from client
 *             required:
 *               - idToken
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Error response (any error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post("/login", strictRateLimiter(), login);

/**
 * @openapi
 * /api/v1/auth/verify:
 *   get:
 *     summary: Verify user session
 *     description: Verifies the current user session and returns user info
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Session valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized or invalid session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.get("/verify", verifySession);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Logs out the user by clearing the session cookie
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
authRouter.post("/logout", logout);

/**
 * @openapi
 * /api/v1/auth/update-username:
 *   put:
 *     summary: Update user username
 *     description: Updates the user's display name/username. First-time users (those without a display name) will be automatically subscribed to the mailing list.
 *     tags:
 *       - Auth
 *     security:
 *       - sessionCookie: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: New username (3-32 characters, alphanumeric, underscores, hyphens, spaces allowed)
 *                 minLength: 3
 *                 maxLength: 32
 *                 pattern: '^[a-zA-Z0-9_\- ]+$'
 *             required:
 *               - username
 *     responses:
 *       200:
 *         description: Username updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid username format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.put("/update-username", strictRateLimiter(), authMiddleware, updateUsername);

export default authRouter;
