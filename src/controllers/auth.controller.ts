import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { closeFirebaseApp, getFirebaseApp } from "../utils/getFirebaseApp.ts";
import { newSuccessResponse, newErrorResponse } from "../utils/apiResponse.ts";
import { getCookie } from "../utils/getCookie.ts";
import { createQuotaHistoryFromTier } from "../utils/quota.utils.ts";
import { createPolarCustomer } from "../utils/polarClient.ts";

import { subscribeUser } from "../services/mailerlite.service.ts";

export async function login(req: Request, res: Response) {
  try {
    const { idToken } = req.body;
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
      mailerliteId: data.mailerliteId || null,
      subscribed: data.subscribed ?? true,
      createdAt: data.createdAt
        ? new Date(data.createdAt.seconds * 1000)
        : undefined,
      updatedAt: data.updatedAt
        ? new Date(data.updatedAt.seconds * 1000)
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

    if (!idToken)
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Please check your request format and try again."
          )
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
          createdAt: data.createdAt
            ? new Date(data.createdAt.seconds * 1000)
            : now,
          updatedAt: data.updatedAt
            ? new Date(data.updatedAt.seconds * 1000)
            : now,
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
          `Created Polar customer for new user ${userID}: ${
            polarCustomerResult.id
          } (${polarCustomerResult.created ? "new" : "existing"})`
        );
      } catch (error) {
        console.error(
          `Failed to create Polar customer for new user ${userID}:`,
          error
        );
      }

      // Create quota history for new users
      await createQuotaHistoryFromTier(userID, starterTierId as any, false);
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
        .json(
          newErrorResponse("No Session", "No session found. Please log in.")
        );
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
          newErrorResponse(
            "Invalid Session",
            "Session is invalid or expired. Please log in again."
          )
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
      mailerliteId: data.mailerliteId || null,
      subscribed: data.subscribed ?? true,
      createdAt: data.createdAt
        ? new Date(data.createdAt.seconds * 1000)
        : undefined,
      updatedAt: data.updatedAt
        ? new Date(data.updatedAt.seconds * 1000)
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
    res.cookie("session", "", {
      maxAge: -1,
      path: "/",
      sameSite: "none",
      secure: true,
      httpOnly: true,
    });
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

    // Enhanced input validation
    if (
      !username ||
      typeof username !== "string" ||
      username.length < 3 ||
      username.length > 32 ||
      !/^[a-zA-Z0-9_\- ]+$/.test(username) ||
      username.startsWith('-') ||
      username.endsWith('-') ||
      username.startsWith(' ') ||
      username.endsWith(' ') ||
      username.includes('--') ||
      username.includes('__') ||
      username.includes('  ')
    ) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Username",
            "Username must be 3-32 characters, contain only letters, numbers, underscores, hyphens, or spaces, and cannot start/end with hyphens or spaces or contain consecutive special characters."
          )
        );
    }

    // Ensure userID and userEmail are present (set by authentication middleware)
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
    const isFirstTimeUser = !req.userDisplayName || req.userDisplayName.trim() === '';
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
      if (docs.empty) {
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
      if (!userDoc) {
        return res
          .status(404)
          .json(
            newErrorResponse(
              "User Not Found",
              "Your user record could not be found. Please contact support."
            )
          );
      }
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
        const subscribeUserResult = await subscribeUser(username, req.userEmail);
        console.log("Mailerlite subscribeUser result:", subscribeUserResult);
        
        // Store MailerLite subscriber ID in user table
        if (subscribeUserResult.success && subscribeUserResult.data && subscribeUserResult.data.id) {
          try {
            await userDoc.ref.update({
              mailerliteId: subscribeUserResult.data.id,
              updatedAt: now,
            });
            console.log(`Stored MailerLite ID ${subscribeUserResult.data.id} for user ${req.userID}`);
          } catch (dbErr) {
            console.error("Failed to store MailerLite ID in user table:", dbErr);
          }
        }
      } catch (mailErr) {
        console.error("Mailerlite subscribeUser error:", mailErr);
      }
    }

    // Get updated user data for response
    try {
      const updatedUserRecord = await auth.getUser(req.userID);
      const usersRef = db.collection("users");
      const userQuery = usersRef.where("userId", "==", req.userID).limit(1);
      const docs = await userQuery.get();
      const userDoc = docs.docs[0];
      const userData = userDoc?.data();

      const user = {
        id: userDoc?.id,
        userId: updatedUserRecord.uid,
        email: updatedUserRecord.email,
        displayName: updatedUserRecord.displayName,
        tierId: userData?.tierId,
        mailerliteId: userData?.mailerliteId || null,
        subscribed: userData?.subscribed ?? true,
        createdAt: userData?.createdAt
          ? new Date(userData.createdAt.seconds * 1000)
          : undefined,
        updatedAt: userData?.updatedAt
          ? new Date(userData.updatedAt.seconds * 1000)
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
    // Avoid leaking sensitive error details to the client
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
    // Clean up Firebase app if needed
    try {
      closeFirebaseApp();
    } catch (closeErr) {
      // Log but do not throw
      console.warn("Error closing Firebase app:", closeErr);
    }
  }
}
