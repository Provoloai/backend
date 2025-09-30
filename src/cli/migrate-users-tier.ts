#!/usr/bin/env node
import "dotenv/config";
import { migrateUsersTier } from "../seed/migrateUsersTier.ts";

migrateUsersTier()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
