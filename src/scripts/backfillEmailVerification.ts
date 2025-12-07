import "dotenv/config";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseApp, closeFirebaseApp } from "../utils/getFirebaseApp.ts";

async function backfillEmailVerification() {
  console.log("Starting backfill of email verification status...");

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    // 1. Get all users from Firestore who are verified
    console.log("Fetching verified users from Firestore...");
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("emailVerified", "==", true).get();

    if (snapshot.empty) {
      console.log("No verified users found in Firestore.");
      return;
    }

    console.log(`Found ${snapshot.size} verified users in Firestore.`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2. Iterate and update Firebase Auth
    // Process in chunks to avoid overwhelming the API if there are many users
    const chunkSize = 50;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      console.log(
        `Processing batch ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(
          docs.length / chunkSize
        )}...`
      );

      await Promise.all(
        chunk.map(async (doc) => {
          const userData = doc.data();
          const userId = userData.userId; // Assuming userId matches Firebase Auth UID
          const email = userData.email;

          if (!userId) {
            console.warn(`Skipping document ${doc.id}: No userId found.`);
            return;
          }

          try {
            const userRecord = await auth.getUser(userId);

            if (!userRecord.emailVerified) {
              await auth.updateUser(userId, {
                emailVerified: true,
              });
              console.log(`Updated Auth for user: ${email} (${userId})`);
              updatedCount++;
            } else {
              skippedCount++;
            }
          } catch (error: any) {
            if (error.code === "auth/user-not-found") {
              console.warn(`User not found in Auth: ${email} (${userId})`);
            } else {
              console.error(`Error updating user ${email} (${userId}):`, error);
            }
            errorCount++;
          }
        })
      );
    }

    console.log("------------------------------------------------");
    console.log("Backfill complete.");
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (already verified): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
  } catch (error) {
    console.error("Fatal error during backfill:", error);
  } finally {
    closeFirebaseApp();
  }
}

backfillEmailVerification();
