import "dotenv/config";
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",
  server: "sandbox",
});

export const fetchCustomersList = async () => {
  console.log("Polar access token:", process.env["POLAR_ACCESS_TOKEN"]);
  console.log("Polar org ID:", process.env["POLAR_ORG_ID"]);
  try {
    const customers = await polar.customers.list({
      organizationId: process.env["POLAR_ORG_ID"] ?? "",
      limit: 5,
      page: 1,
    });

    console.log("Customers:", JSON.stringify(customers));
    return customers;
  } catch (error) {
    console.error("Error fetching customers:", error);
  }
};

fetchCustomersList();
