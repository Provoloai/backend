import "dotenv/config";
import { getFirebaseApp } from "../utils/getFirebaseApp.ts";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export async function migrateUsersTier() {
  console.log("Starting user tiers migration...");

  const defaultTierId = process.env.STARTER_TIER_ID || process.env.DEFAULT_TIER_ID;
  if (!defaultTierId) {
    console.error("DEFAULT/STARTER TIER ID not set in env (STARTER_TIER_ID or DEFAULT_TIER_ID)");
    process.exit(1);
  }

  const app = getFirebaseApp();
  const db = getFirestore(app);

  const usersCol = db.collection("users");

  // 1) Users with tierId == ""
  console.log('Querying users with tierId == "" ...');
  const emptySnap = await usersCol.where("tierId", "==", "").get();
  for (const doc of emptySnap.docs) {
    try {
      console.log(`Updating user ${doc.id} -> set tierId to ${defaultTierId}`);
      await doc.ref.update({
        tierId: defaultTierId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`User ${doc.id} updated successfully`);
    } catch (e) {
      console.error(`Failed to update user ${doc.id}:`, e);
    }
  }

  // 2) Users missing tierId
  console.log("Querying users with missing tierId ...");
  const allSnap = await usersCol.get();
  for (const doc of allSnap.docs) {
    const data = doc.data();
    if (!Object.prototype.hasOwnProperty.call(data, "tierId")) {
      try {
        console.log(`Updating user ${doc.id} -> set tierId to ${defaultTierId}`);
        await doc.ref.update({
          tierId: defaultTierId,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`User ${doc.id} updated successfully`);
      } catch (e) {
        console.error(`Failed to update user ${doc.id}:`, e);
      }
    }
  }

  console.log("Migration completed ✔️");
}
