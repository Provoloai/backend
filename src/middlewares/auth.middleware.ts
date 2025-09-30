import type { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseApp } from "../utils/getFirebaseApp.ts";
import { newErrorResponse } from "../utils/apiResponse.ts";
import { getCookie } from "../utils/getCookie.ts";

// Extend Express Request interface to include custom user properties
declare global {
  namespace Express {
    interface Request {
      userID?: string;
      userEmail?: string | undefined;
      userDisplayName?: string | undefined;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const app = getFirebaseApp();
  const auth = getAuth(app);

  let token;
  try {
    // Try session cookie first
    const sessionCookie = getCookie(req, "session");
    if (sessionCookie) {
      token = await auth.verifySessionCookie(sessionCookie, true);
    } else {
      // Fallback to Bearer token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.replace("Bearer ", "");
        token = await auth.verifyIdToken(idToken);
      } else {
        return res.status(401).json(newErrorResponse("Unauthorized", "No authentication provided"));
      }
    }
  } catch (err) {
    return res
      .status(401)
      .json(newErrorResponse("Unauthorized", "Invalid or expired token/session"));
  }

  // Attach user info to request
  req.userID = token.uid;
  req.userEmail = token.email;
  req.userDisplayName = token.name;
  next();
}
