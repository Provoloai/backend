import type { Request, Response } from "express";
import { getHealth } from "../services/health.service.ts";
import { newSuccessResponse, newErrorResponse } from "../utils/apiResponse.ts";

export async function healthCheckController(req: Request, res: Response) {
  try {
    const config = {
      environment: process.env.NODE_ENV || "development",
      port: process.env.PORT || 3000,
    };
    const healthData = getHealth(config);
    res.status(200).json(newSuccessResponse("Health Check", "API is running successfully", healthData));
  } catch (error: any) {
    res.status(500).json(newErrorResponse("Health Check Error", "Something went wrong. Please try again or contact support."));
  }
}
