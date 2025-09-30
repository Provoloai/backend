import "dotenv/config";
import { getFirebaseApp } from "../utils/getFirebaseApp.ts";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",
  server: "sandbox",
});

export async function seedUserPolarIds() {
  console.log("Starting user Polar ID seeding...");

  const organizationId = process.env["POLAR_ORG_ID"];
  if (!organizationId) {
    console.error("POLAR_ORG_ID not set in environment");
    process.exit(1);
  }

  const app = getFirebaseApp();
  const db = getFirestore(app);

  // Query all users (since polarId field might not exist on some documents)
  console.log("Querying all users...");
  const allUsers = await db.collection("users").get();

  // Filter users without polarId (either null, empty string, or field doesn't exist)
  const usersWithoutPolarId = allUsers.docs.filter((doc) => {
    const data = doc.data();
    const polarId = data.polarId;
    return polarId === null || polarId === "" || polarId === undefined;
  });

  console.log(`Found ${usersWithoutPolarId.length} users without polarId`);

  let successCount = 0;
  let errorCount = 0;

  for (const doc of usersWithoutPolarId) {
    try {
      const userData = doc.data();
      const userId = userData.userId || doc.id;
      const email = userData.email;
      const name = userData.displayName || userData.name || email;

      if (!email) {
        console.warn(`User ${userId} has no email, skipping...`);
        continue;
      }

      console.log(`Creating Polar customer for user ${userId} (${email})...`);

      let polarCustomer;
      try {
        // Try to create new customer
        polarCustomer = await polar.customers.create({
          externalId: userId,
          email: email,
          name: name || email,
        });
      } catch (error: any) {
        // If customer already exists, try to find them by email
        if (error.detail?.[0]?.msg?.includes("already exists")) {
          console.log(
            `Customer with email ${email} already exists, looking up existing customer...`
          );
          const existingCustomers = (await polar.customers.list({
            organizationId: organizationId,
            query: email,
            limit: 1,
          })) as any;

          if (existingCustomers.result?.items && existingCustomers.result.items.length > 0) {
            polarCustomer = existingCustomers.result.items[0];
            console.log(`Found existing customer: ${polarCustomer.id}`);
          } else {
            throw new Error(`Customer with email ${email} already exists but could not be found`);
          }
        } else {
          throw error;
        }
      }

      // Update user with polarId
      await doc.ref.update({
        polarId: polarCustomer.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`User ${userId} updated with polarId: ${polarCustomer.id}`);
      successCount++;

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to create Polar customer for user ${doc.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\nSeeding completed:`);
  console.log(`Successfully processed: ${successCount} users`);
  console.log(`Failed: ${errorCount} users`);
}
