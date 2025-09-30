import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { closeFirebaseApp, getFirebaseApp } from "../utils/getFirebaseApp.ts";
import { newSuccessResponse, newErrorResponse } from "../utils/apiResponse.ts";
import { getCookie } from "../utils/getCookie.ts";
import { createQuotaHistoryFromTier } from "../utils/quota.utils.ts";
import { createPolarCustomer } from "../utils/polarClient.ts";

export async function login(req: Request, res: Response) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res
        .status(400)
        .json(
          newErrorResponse("Invalid Request", "Please check your request format and try again.")
        );
    }

    const app = getFirebaseApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Verify ID token
    let token;
    try {
      token = await auth.verifyIdToken(idToken);
    } catch (err) {
      return res
        .status(401)
        .json(
          newErrorResponse(
            "Authentication Failed",
            "Unable to verify your authentication. Please try logging in again."
          )
        );
    }

    // Create session cookie (expires in 5 days)
    let cookie;
    try {
      cookie = await auth.createSessionCookie(idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 });
    } catch (err) {
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Session Creation Failed",
            "Unable to create your session. Please contact support if this continues."
          )
        );
    }

    // Set HTTP-only cookie
    res.cookie("session", cookie, {
      maxAge: 5 * 24 * 60 * 60 * 1000,
      path: "/",
      sameSite: "none",
      secure: true,
      httpOnly: true,
    });

    // Get user info from Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUser(token.uid);
    } catch (err) {
      return res
        .status(500)
        .json(
          newErrorResponse(
            "User Info Failed",
            "Unable to retrieve your account information. Please contact support if this continues."
          )
        );
    }

    // Get user data in Firestore (strict mode - don't auto-create for login)
    const usersRef = db.collection("users");
    const userQuery = usersRef.where("userId", "==", token.uid).limit(1);
    const docs = await userQuery.get();
    if (docs.empty || docs.docs.length === 0) {
      return res
        .status(403)
        .json(
          newErrorResponse(
            "Account Setup Required",
            "Your account is not properly set up. Please contact support or sign up again to complete your account setup."
          )
        );
    }
    const doc = docs.docs[0];
    if (!doc) {
      return res
        .status(403)
        .json(
          newErrorResponse(
            "Account Setup Required",
            "Your account is not properly set up. Please contact support or sign up again to complete your account setup."
          )
        );
    }
    const data = doc.data();
    const user = {
      id: doc.id,
      userId: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      tierId: data.tierId,
      subscribed: data.subscribed ?? true,
      createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt.seconds * 1000) : undefined,
    };

    return res
      .status(200)
      .json(newSuccessResponse("Login Successful", "User authenticated successfully", user));
  } catch (err) {
    return res
      .status(500)
      .json(
        newErrorResponse(
          "Login Error",
          "Unable to log you in. Please contact support if this continues."
        )
      );
  }
}

export async function signupOrEnsureUser(req: Request, res: Response) {
  try {
    const starterTierId = process.env.STARTER_TIER_ID || "";
    const { idToken } = req.body;

    if (!idToken)
      return res
        .status(400)
        .json(
          newErrorResponse("Invalid Request", "Please check your request format and try again.")
        );

    const app = getFirebaseApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Verify ID token
    let token;
    try {
      token = await auth.verifyIdToken(idToken);
    } catch (err) {
      return res
        .status(401)
        .json(
          newErrorResponse(
            "Authentication Failed",
            "Unable to verify your authentication. Please try again."
          )
        );
    }

    const userID = token.uid;
    let userRecord;

    // Get Firebase user record
    try {
      userRecord = await auth.getUser(userID);
    } catch (err) {
      return res
        .status(500)
        .json(
          newErrorResponse(
            "User Info Failed",
            "Unable to retrieve your account information. Please contact support if this continues."
          )
        );
    }

    // Get or create user data in Firestore
    const usersRef = db.collection("users");
    const userQuery = usersRef.where("userId", "==", userID).limit(1);
    const docs = await userQuery.get();

    let userData;
    let isNewUser = false;
    const now = new Date();

    if (!docs.empty && docs.docs.length > 0) {
      // User exists
      const doc = docs.docs[0];
      if (doc) {
        const data = doc.data();
        const userDataObj: any = {
          id: doc.id,
          userId: userID,
          email: userRecord.email,
          tierId: data.tierId || starterTierId,
          subscribed: data.subscribed ?? true,
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : now,
          updatedAt: data.updatedAt ? new Date(data.updatedAt.seconds * 1000) : now,
        };

        // Only add displayName if it exists
        if (userRecord.displayName) {
          userDataObj.displayName = userRecord.displayName;
        }

        userData = userDataObj;
      }
    } else {
      // Create new user
      isNewUser = true;
      const newUserData: any = {
        userId: userID,
        email: userRecord.email,
        tierId: starterTierId,
        subscribed: true,
        createdAt: now,
        updatedAt: now,
      };

      // Only add displayName if it exists
      if (userRecord.displayName) {
        newUserData.displayName = userRecord.displayName;
      }
      const docRef = await usersRef.add(newUserData);
      userData = {
        id: docRef.id,
        ...newUserData,
      };

      // Create Polar customer for new user
      try {
        const polarCustomerResult = await createPolarCustomer({
          userId: userID,
          email: userRecord.email!,
          name: userRecord.displayName || userRecord.email!,
        });

        // Update user document with polarId
        await docRef.update({
          polarId: polarCustomerResult.id,
          updatedAt: now,
        });

        // Update userData for response (extend the type)
        (userData as any).polarId = polarCustomerResult.id;

        console.log(
          `Created Polar customer for new user ${userID}: ${polarCustomerResult.id} (${
            polarCustomerResult.created ? "new" : "existing"
          })`
        );
      } catch (error) {
        console.error(`Failed to create Polar customer for new user ${userID}:`, error);
      }

      // Create quota history for new users
      await createQuotaHistoryFromTier(userID, starterTierId as any, false);
    }

    // Create session cookie
    let cookie;
    try {
      cookie = await auth.createSessionCookie(idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 });
    } catch (err) {
      console.error("Signup Error:", err);
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Session Error",
            "Unable to create your session. Please contact support if this continues."
          )
        );
    }

    // Set the session cookie
    res.cookie("session", cookie, {
      maxAge: 5 * 24 * 60 * 60 * 1000,
      path: "/",
      sameSite: "none",
      secure: true,
      httpOnly: true,
    });

    const message = isNewUser
      ? "New user created with starter tier and quota history"
      : "User profile retrieved";

    const action = isNewUser ? "Signup Successful" : "Login Successful";
    return res.status(200).json(newSuccessResponse(action, message, userData));
  } catch (err) {
    console.error("Signup Error:", err);
    return res
      .status(500)
      .json(
        newErrorResponse(
          "Signup Error",
          "Unable to set up your account. Please contact support if this continues."
        )
      );
  }
}

export async function verifySession(req: Request, res: Response) {
  try {
    const sessionCookie = getCookie(req, "session");
    if (!sessionCookie) {
      return res
        .status(401)
        .json(newErrorResponse("No Session", "No session found. Please log in."));
    }

    const app = getFirebaseApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Verify session cookie
    let token;
    try {
      token = await auth.verifySessionCookie(sessionCookie, true);
    } catch (err) {
      return res
        .status(401)
        .json(
          newErrorResponse("Invalid Session", "Session is invalid or expired. Please log in again.")
        );
    }

    // Get user info from Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUser(token.uid);
    } catch (err) {
      return res
        .status(500)
        .json(
          newErrorResponse(
            "User Info Failed",
            "Unable to retrieve your account information. Please contact support if this continues."
          )
        );
    }

    // Get user data in Firestore (strict mode - don't auto-create for verify)
    const usersRef = db.collection("users");
    const userQuery = usersRef.where("userId", "==", token.uid).limit(1);
    const docs = await userQuery.get();
    const doc = docs.docs[0];
    if (!doc) {
      return res
        .status(403)
        .json(
          newErrorResponse(
            "Account Setup Required",
            "Your account is not properly set up. Please contact support or sign up again to complete your account setup."
          )
        );
    }
    const data = doc.data();
    const user = {
      id: doc.id,
      userId: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      tierId: data.tierId,
      polarId: data.polarId,
      subscribed: data.subscribed ?? true,
      createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt.seconds * 1000) : undefined,
    };

    return res.status(200).json(newSuccessResponse("Session Valid", "Session is valid", user));
  } catch (err) {
    console.error("Verify Session Error:", err);
    return res
      .status(500)
      .json(
        newErrorResponse(
          "Session Verification Error",
          "Unable to verify your session. Please contact support if this continues."
        )
      );
  }
}

export async function logout(req: Request, res: Response) {
  try {
    res.cookie("session", "", {
      maxAge: -1,
      path: "/",
      sameSite: "none",
      secure: true,
      httpOnly: true,
    });
    return res
      .status(200)
      .json(newSuccessResponse("Logout Successful", "User logged out successfully", null));
  } finally {
    closeFirebaseApp();
  }
}
