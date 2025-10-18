import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { getCookie } from "../utils/getCookie.ts";
import { closeFirebaseApp, getFirebaseApp } from "../utils/getFirebaseApp.ts";
import { newSuccessResponse, newErrorResponse } from "../utils/apiResponse.ts";
import { createQuotaHistoryFromTier } from "../utils/quota.utils.ts";
import { createPolarCustomer } from "../utils/polarClient.ts";
import { subscribeUser } from "../services/mailerlite.service.ts";

// Types
import type { NewUser, User } from "../types/user.ts";
import type { Request, Response } from "express";
import type { Timestamp } from "firebase-admin/firestore";
import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";

export async function login(req: Request, res: Response) {
  try {
    const { idToken } = req.body;

    // Validate request body
    if (!idToken) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Please check your request format and try again."
          )
        );
    }

    // Initialize Firebase
    const app = getFirebaseApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Verify ID token
    let token: DecodedIdToken | null = null;
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
      cookie = await auth.createSessionCookie(idToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000,
      });
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

    // Get user data in Firestore
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
    const user: User = {
      id: doc.id,
      userId: data.userId,
      email: data.email,
      displayName: data.displayName || null,
      tierId: data.tierId,
      mailerliteId: data.mailerliteId || null,
      polarId: data.polarId || null,
      createdAt: data.createdAt
        ? data.createdAt instanceof Date
          ? data.createdAt
          : new Date((data.createdAt as Timestamp).seconds * 1000)
        : undefined,
      updatedAt: data.updatedAt
        ? data.updatedAt instanceof Date
          ? data.updatedAt
          : new Date((data.updatedAt as Timestamp).seconds * 1000)
        : undefined,
    };

    return res
      .status(200)
      .json(
        newSuccessResponse(
          "Login Successful",
          "User authenticated successfully",
          user
        )
      );
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

    // Validate request body
    if (!idToken)
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Please check your request format and try again."
          )
        );

    // Initialize Firebase
    const app = getFirebaseApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Verify ID token
    let decodedUserInfo: DecodedIdToken | null = null;
    try {
      decodedUserInfo = (await auth.verifyIdToken(idToken)) as DecodedIdToken;
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

    const userID = decodedUserInfo.uid;
    let userRecord: UserRecord | null = null;

    // Get Firebase Auth UserRecord
    try {
      userRecord = (await auth.getUser(userID)) as UserRecord;
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

    let userData: User | null = null;
    let isNewUser: boolean = false;
    const now: Date = new Date();

    if (!docs.empty && docs.docs.length > 0) {
      // User exists
      const existingUserDoc = docs.docs[0];
      if (existingUserDoc) {
        const existingUserData: User = existingUserDoc.data() as User;
        userData = {
          id: existingUserDoc.id,
          userId: userID,
          email: userRecord.email!,
          displayName: userRecord.displayName || null,
          tierId: existingUserData.tierId || starterTierId,
          mailerliteId: null,
          polarId: existingUserData.polarId || null,
          createdAt: existingUserData.createdAt
            ? existingUserData.createdAt instanceof Date
              ? existingUserData.createdAt
              : new Date(
                  (existingUserData.createdAt as Timestamp).seconds * 1000
                )
            : now,
          updatedAt: existingUserData.updatedAt
            ? existingUserData.updatedAt instanceof Date
              ? existingUserData.updatedAt
              : new Date(
                  (existingUserData.updatedAt as Timestamp).seconds * 1000
                )
            : now,
        };
      }
    } else {
      // Create new user
      isNewUser = true;
      const newUserData: NewUser = {
        userId: userID,
        email: userRecord.email!,
        displayName: userRecord.displayName || null,
        tierId: starterTierId,
        mailerliteId: null,
        polarId: null,
        createdAt: now,
        updatedAt: now,
      };

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

        userData.polarId = polarCustomerResult.id;
      } catch (error) {
        console.error(
          `Failed to create Polar customer for new user ${userID}:`,
          error
        );
      }

      // Create quota history for new users
      await createQuotaHistoryFromTier(userID, starterTierId, false);
    }

    // Create session cookie
    let cookie;
    try {
      cookie = await auth.createSessionCookie(idToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000,
      });
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
      ? "Signup successful! Your account has been created."
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
        .json(
          newErrorResponse("No Session", "No session found. Please log in.")
        );
    }

    const app = getFirebaseApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Verify session cookie
    let decodedUserInfo: DecodedIdToken | null = null;
    try {
      decodedUserInfo = await auth.verifySessionCookie(sessionCookie, true);
    } catch (err) {
      return res
        .status(401)
        .json(
          newErrorResponse(
            "Invalid Session",
            "Session is invalid or expired. Please log in again."
          )
        );
    }

    // Get user data in Firestore
    const usersRef = db.collection("users");
    const userQuery = usersRef.where("userId", "==", decodedUserInfo.uid).limit(1);
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
    const user: User = {
      id: doc.id,
      userId: data.userId,
      email: data.email,
      displayName: data.displayName || null,
      tierId: data.tierId,
      polarId: data.polarId || null,
      mailerliteId: data.mailerliteId || null,
      createdAt: data.createdAt
        ? data.createdAt instanceof Date
          ? data.createdAt
          : new Date((data.createdAt as Timestamp).seconds * 1000)
        : undefined,
      updatedAt: data.updatedAt
        ? data.updatedAt instanceof Date
          ? data.updatedAt
          : new Date((data.updatedAt as Timestamp).seconds * 1000)
        : undefined,
    };

    return res
      .status(200)
      .json(newSuccessResponse("Session Valid", "Session is valid", user));
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
    const sessionCookie = getCookie(req, "session");
    
    // Clear the session cookie first
    res.cookie("session", "", {
      maxAge: -1,
      path: "/",
      sameSite: "none",
      secure: true,
      httpOnly: true,
    });

    // If we have a session cookie, revoke it on Firebase
    if (sessionCookie) {
      try {
        const app = getFirebaseApp();
        const auth = getAuth(app);
        
        // Verify the session to get the UID
        const decodedToken = await auth.verifySessionCookie(sessionCookie, true);
        
        // Revoke all refresh tokens for this user
        await auth.revokeRefreshTokens(decodedToken.uid);
      } catch (err) {
        // Log the error but don't fail the logout
        console.error("Failed to revoke Firebase session:", err);
      }
    }

    return res
      .status(200)
      .json(
        newSuccessResponse(
          "Logout Successful",
          "User logged out successfully",
          null
        )
      );
  } finally {
    closeFirebaseApp();
  }
}

export async function updateUsername(req: Request, res: Response) {
  try {
    const { username } = req.body;

    // Validate username
    if (
      !username ||
      typeof username !== "string" ||
      username.length < 3 ||
      !/^[a-zA-Z0-9_\- ]+$/.test(username) ||
      username.startsWith("-") ||
      username.endsWith("-") ||
      username.startsWith(" ") ||
      username.endsWith(" ") ||
      username.includes("--") ||
      username.includes("__")
    ) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Username",
            "Username must be at least 3, use only letters, numbers, underscores, hyphens, or spaces, cannot start or end with hyphens or spaces, and cannot contain consecutive hyphens or consecutive underscores."
          )
        );
    }

    // Ensure userID and userEmail are present
    if (!req.userID || !req.userEmail) {
      return res
        .status(401)
        .json(
          newErrorResponse(
            "Unauthorized",
            "You must be logged in to update your username."
          )
        );
    }

    // Check if this is a first-time user (no displayName)
    const isFirstTimeUser =
      !req.userDisplayName || req.userDisplayName.trim() === "";
    const now = new Date();

    // Initialize Firebase
    const app = getFirebaseApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Update username in Firebase Auth
    try {
      await auth.updateUser(req.userID, { displayName: username });
    } catch (authErr) {
      console.error("Firebase Auth updateUser error:", authErr);
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Auth Update Failed",
            "Unable to update your username in authentication. Please contact support."
          )
        );
    }

    // Update username in Firestore
    let userDoc;
    try {
      const usersRef = db.collection("users");
      const userQuery = usersRef.where("userId", "==", req.userID).limit(1);
      const docs = await userQuery.get();

      if (docs.empty || !docs.docs[0]) {
        return res
          .status(404)
          .json(
            newErrorResponse(
              "User Not Found",
              "Your user record could not be found. Please contact support."
            )
          );
      }
      
      userDoc = docs.docs[0];
      await userDoc.ref.update({ displayName: username });
    } catch (firestoreErr) {
      console.error("Firestore update error:", firestoreErr);
      return res
        .status(500)
        .json(
          newErrorResponse(
            "Database Update Failed",
            "Unable to update your username in our database. Please contact support."
          )
        );
    }

    // Subscribe first-time users to mailing list (do not block on error)
    if (isFirstTimeUser) {
      try {
        const subscribeUserResult = await subscribeUser(
          username,
          req.userEmail
        );
        console.log("Mailerlite subscribeUser result:", subscribeUserResult);

        // Store MailerLite subscriber ID in user table
        if (
          subscribeUserResult.success &&
          subscribeUserResult.data &&
          subscribeUserResult.data.id
        ) {
          try {
            await userDoc.ref.update({
              mailerliteId: subscribeUserResult.data.id,
              updatedAt: now,
            });
            console.log(
              `Stored MailerLite ID ${subscribeUserResult.data.id} for user ${req.userID}`
            );
          } catch (dbErr) {
            console.error(
              "Failed to store MailerLite ID in user table:",
              dbErr
            );
          }
        }
      } catch (mailErr) {
        console.error("Mailerlite subscribeUser error:", mailErr);
      }
    }

    // Get updated user data for response
    try {
      const usersRef = db.collection("users");
      const userQuery = usersRef.where("userId", "==", req.userID).limit(1);
      const docs = await userQuery.get();
      
      if (docs.empty || !docs.docs[0]) {
        throw new Error("User document not found after username update.");
      }
      
      const userDoc = docs.docs[0];
      const userData = userDoc.data();
      
      const user: User = {
        id: userDoc.id,
        userId: userData.userId,
        email: userData.email,
        displayName: userData.displayName || null,
        tierId: userData.tierId,
        polarId: userData.polarId || null,
        mailerliteId: userData.mailerliteId || null,
        createdAt: userData.createdAt
          ? userData.createdAt instanceof Date
            ? userData.createdAt
            : new Date((userData.createdAt as Timestamp).seconds * 1000)
          : undefined,
        updatedAt: userData.updatedAt
          ? userData.updatedAt instanceof Date
            ? userData.updatedAt
            : new Date((userData.updatedAt as Timestamp).seconds * 1000)
          : undefined,
      };

      return res
        .status(200)
        .json(
          newSuccessResponse(
            "Username Updated",
            "Username updated successfully. Please log in again to refresh your session with the new username.",
            user
          )
        );
    } catch (userErr) {
      console.error("Error getting updated user data:", userErr);
      return res
        .status(200)
        .json(
          newSuccessResponse(
            "Username Updated",
            "Username updated successfully. Please log in again to refresh your session.",
            null
          )
        );
    }
  } catch (err) {
    console.error("Update Username Error:", err);
    return res
      .status(500)
      .json(
        newErrorResponse(
          "Update Username Error",
          "Unable to update your username. Please contact support if this continues."
        )
      );
  } finally {
    closeFirebaseApp();
  }
}
