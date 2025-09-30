import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  userID?: string;
  userEmail?: string;
  userDisplayName?: string;
}
