import "dotenv/config";
import { createPolar } from "../utils/polarClient.ts";
import { fileURLToPath } from "url";
import process from "process";

async function deleteAllPolarCustomers() {
  console.log("Starting Polar customer deletion process...");

  const organizationId = process.env["POLAR_ORG_ID"];
  if (!organizationId) {
    console.error("POLAR_ORG_ID not set in environment");
    process.exit(1);
  }

  const polar = createPolar();
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`Fetching customers (page ${page})...`);
      const response = await polar.customers.list({
        organizationId: organizationId,
        page: page,
        limit: 100,
      });

      const customers = response.result?.items || [];

      if (customers.length === 0) {
        console.log("No more customers found.");
        hasMore = false;
        break;
      }

      console.log(`Found ${customers.length} customers to delete.`);

      for (const customer of customers) {
        try {
          await polar.customers.delete({ id: customer.id });
          console.log(`Deleted customer: ${customer.id} (${customer.email})`);
          // Add a small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (err: any) {
          console.error(
            `Failed to delete customer ${customer.id}:`,
            err.message
          );
        }
      }

      // If we deleted everything on this page, fetching page 1 again would be empty or have new items
      // But typically with pagination where items are removed, we should re-fetch page 1 until it's empty
      // provided the order is stable. However, let's just stick to the loop.
      // If we delete items, the next "page 1" will contain what was previously on page 2.
      // So we should NOT increment page if we are deleting items, we should keep fetching page 1.

      // Reset page to 1 because we are depleting the list.
      page = 1;

      // If the list was smaller than limit, we are done.
      if (customers.length < 100) {
        hasMore = false;
      }
    }

    console.log("All Polar customers have been deleted.");
  } catch (error) {
    console.error("Error deleting Polar customers:", error);
  }
}

// Run the function if main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deleteAllPolarCustomers().catch(console.error);
}
