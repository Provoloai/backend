import { Router } from "express";
import type { Router as ExpressRouter } from "express";

import { healthCheckController } from "../controllers/health.controller.ts";

const healthRouter: ExpressRouter = Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Get health check
 *     description: Returns a simple message to indicate the service is up
 *     tags:
 *       - Health
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 description:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     uptime:
 *                       type: string
 *                     version:
 *                       type: string
 *                     env:
 *                       type: string
 *                     port:
 *                       type: string
 */
healthRouter.get("/", healthCheckController);

export default healthRouter;
