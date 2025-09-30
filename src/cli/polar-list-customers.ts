#!/usr/bin/env node
import "dotenv/config";
import { listCustomers, createPolar } from "../utils/polarClient.ts";

async function main() {
  const accessToken = (process.env.POLAR_ACCESS_TOKEN || "").trim();
  const organizationId = (process.env.POLAR_ORG_ID || "").trim();
  const server = (process.env.POLAR_SERVER || "production").trim();
  if (!accessToken || !organizationId) {
    console.error("Missing POLAR_ACCESS_TOKEN or POLAR_ORG_ID in env");
    process.exit(1);
  }

  if (process.env.POLAR_DEBUG === "1") {
    console.log(`[polar] server=${server} org=${organizationId}`);
  }

  try {
    // Ensure client is created (validates token format and server)
    createPolar({ accessToken, server: server as any });
    const result = await listCustomers({ organizationId, limit: 10, page: 1 });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Failed to list customers:", e);
    process.exit(1);
  }
}

main();
