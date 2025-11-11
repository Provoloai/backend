#!/usr/bin/env node
import "dotenv/config";
import { migrateBetaUsers } from "../seed/migrateBetaUsers.ts";

// Get token from command line argument if provided, otherwise use env var
const token = process.argv[2] || process.env.MIGRATION_SECRET_TOKEN;

if (!token) {
  console.error("❌ Error: Migration secret token required");
  console.error("   Usage: npm run migrate-beta-users <TOKEN>");
  console.error("   Or set MIGRATION_SECRET_TOKEN in your .env file");
  process.exit(1);
}

migrateBetaUsers(token)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

