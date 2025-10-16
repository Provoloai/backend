import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseApp } from "../utils/getFirebaseApp.ts";

// @ts-expect-error: No type definitions for mailerlite.config.js
import mailerlite from "../config/mailerlite.config.js";

interface UserData {
  id: string;
  userId: string;
  email: string;
  displayName?: string;
  mailerliteId?: string;
  tierId?: string;
}

async function getUserFromDatabase(identifier: string, isEmail: boolean = false): Promise<UserData | null> {
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    const usersRef = db.collection("users");
    
    let query;
    if (isEmail) {
      query = usersRef.where("email", "==", identifier).limit(1);
    } else {
      query = usersRef.where("userId", "==", identifier).limit(1);
    }
    
    const docs = await query.get();
    
    if (docs.empty || docs.docs.length === 0) {
      return null;
    }
    
    const doc = docs.docs[0];
    if (!doc) {
      return null;
    }
    
    const data = doc.data();
    
    return {
      id: doc.id,
      userId: data.userId,
      email: data.email,
      displayName: data.displayName,
      mailerliteId: data.mailerliteId,
      tierId: data.tierId,
    };
  } catch (error) {
    console.error("Error fetching user from database:", error);
    return null;
  }
}

async function createOrUpdateSubscriber(user: UserData): Promise<string | null> {
  try {
    const result = await mailerlite.subscribers.createOrUpdate({
      email: user.email,
      fields: {
        name: user.displayName || user.email,
      },
      groups: [process.env.MAILERLITE_GROUP_ID],
      status: "active",
      subscribed_at: new Date()
        .toISOString()
        .replace("T", " ")
        .substring(0, 19),
      opted_in_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    });

    return result.data?.data?.id || null;
  } catch (error) {
    console.error("Error creating/updating subscriber:", error);
    return null;
  }
}

async function updateUserMailerLiteId(userId: string, mailerliteId: string): Promise<void> {
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    const usersRef = db.collection("users");
    const userQuery = usersRef.where("userId", "==", userId).limit(1);
    const docs = await userQuery.get();
    
    if (!docs.empty && docs.docs[0]) {
      await docs.docs[0].ref.update({
        mailerliteId: mailerliteId,
        updatedAt: new Date(),
      });
      console.log(`Updated user ${userId} with MailerLite ID: ${mailerliteId}`);
    }
  } catch (error) {
    console.error("Error updating user MailerLite ID:", error);
  }
}

export async function sendPremiumWelcomeEmail(identifier: string, isEmail: boolean = false): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Get user from database
    const user = await getUserFromDatabase(identifier, isEmail);
    
    if (!user) {
      return {
        success: false,
        message: "User not found in database"
      };
    }

    let subscriberId = user.mailerliteId || undefined;

    // If user doesn't have a MailerLite ID, create one
    if (!subscriberId) {
      const newSubscriberId = await createOrUpdateSubscriber(user);
      
      if (!newSubscriberId) {
        return {
          success: false,
          message: "Failed to create MailerLite subscriber"
        };
      }

      // Update user with MailerLite ID
      subscriberId = newSubscriberId;
      await updateUserMailerLiteId(user.userId, newSubscriberId);
    }

    // Add user to premium group
    try {
      const result = await mailerlite.groups.assignSubscriber(subscriberId, process.env.MAILERLITE_PREMIUM_GROUP_ID);
      
      return {
        success: true,
        message: "User successfully added to premium group",
        data: result.data
      };
    } catch (assignError: any) {
      // If subscriber is already in the group, that's okay
      if (assignError.response?.data?.message?.includes("already assigned")) {
        return {
          success: true,
          message: "User is already in premium group",
          data: assignError.response.data
        };
      }
      
      console.error("Error assigning subscriber to premium group:", assignError);
      return {
        success: false,
        message: "Failed to add user to premium group",
        data: assignError.response?.data
      };
    }

  } catch (error) {
    console.error("Error in sendPremiumWelcomeEmail:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
      data: error
    };
  }
}

export async function subscribeUser(name: string, email: string): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Validate inputs
    if (!name || !email) {
      return {
        success: false,
        message: "Name and email are required for subscription"
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: "Invalid email format"
      };
    }

    // Check if required environment variables are set
    if (!process.env.MAILERLITE_API_KEY || !process.env.MAILERLITE_GROUP_ID) {
      return {
        success: false,
        message: "MailerLite configuration is incomplete"
      };
    }

    const result = await mailerlite.subscribers.createOrUpdate({
      email,
      fields: {
        name: name.trim(),
      },
      groups: [process.env.MAILERLITE_GROUP_ID],
      status: "active",
      subscribed_at: new Date()
        .toISOString()
        .replace("T", " ")
        .substring(0, 19),
      opted_in_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    });

    return {
      success: true,
      message: "User subscribed successfully",
      data: result.data
    };
  } catch (error) {
    console.error("MailerLite subscription failed:", error);
    return {
      success: false,
      message: "Failed to subscribe user",
      data: error
    };
  }
}
