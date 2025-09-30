import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import {
  getPaymentTiers,
  getPaymentTierBySlug,
  paymentWebhook,
} from "../controllers/payment.controller.ts";

const paymentRouter: ExpressRouter = Router();

/**
 * @swagger
 * /payment/tiers:
 *   get:
 *     summary: Get all payment tiers
 *     description: Retrieves all available payment tiers sorted by price in ascending order
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Payment tiers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               title: "Payment Tiers"
 *               message: "Payment tiers retrieved successfully"
 *               status: "success"
 *               data: [
 *                 {
 *                   "name": "Starter",
 *                   "slug": "starter",
 *                   "polarRefId": "prod_123",
 *                   "price": 0,
 *                   "description": "Free tier",
 *                   "recurringInterval": "monthly",
 *                   "features": [],
 *                   "createdAt": "2024-01-01T00:00:00.000Z",
 *                   "updatedAt": "2024-01-01T00:00:00.000Z"
 *                 }
 *               ]
 */
paymentRouter.get("/tiers", getPaymentTiers);

/**
 * @swagger
 * /payment/tiers/{slug}:
 *   get:
 *     summary: Get payment tier by slug
 *     description: Retrieves a specific payment tier by its slug identifier
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: The slug identifier of the payment tier
 *         example: "starter"
 *     responses:
 *       200:
 *         description: Payment tier retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               title: "Payment Tier"
 *               message: "Payment tier retrieved successfully"
 *               status: "success"
 *               data:
 *                 name: "Starter"
 *                 slug: "starter"
 *                 polarRefId: "prod_123"
 *                 price: 0
 *                 description: "Free tier"
 *                 recurringInterval: "monthly"
 *                 features: []
 *                 createdAt: "2024-01-01T00:00:00.000Z"
 *                 updatedAt: "2024-01-01T00:00:00.000Z"
 *       400:
 *         description: Invalid request - missing slug
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               title: "Invalid Request"
 *               message: "Tier slug is required"
 *               status: "error"
 *               data: null
 */
paymentRouter.get("/tiers/:slug", getPaymentTierBySlug);

/**
 * @swagger
 * /payment/webhook:
 *   post:
 *     summary: Payment webhook handler
 *     description: Handles webhook events from the payment provider (Polar.sh) for subscription and order updates
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Dynamic webhook payload from payment provider
 *           example:
 *             type: "order.updated"
 *             data:
 *               checkout_id: "cs_test_123"
 *               product_id: "prod_123"
 *               status: "paid"
 *               customer:
 *                 email: "user@example.com"
 *               metadata:
 *                 user_id: "user_123"
 *               created_at: "2024-01-01T00:00:00.000Z"
 *               modified_at: "2024-01-01T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               title: "Payment Webhook"
 *               message: "Webhook received and processed successfully - any data structure accepted"
 *               status: "success"
 *               data:
 *                 type: "order.updated"
 *                 data: {}
 *       400:
 *         description: Invalid webhook data format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               title: "Invalid Request"
 *               message: "Invalid payment webhook data format."
 *               status: "error"
 *               data: null
 */
paymentRouter.post("/webhook", paymentWebhook);

export default paymentRouter;
