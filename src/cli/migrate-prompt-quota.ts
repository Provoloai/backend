#!/usr/bin/env node
import "dotenv/config";
import { migratePromptQuota } from "../seed/migratePromptQuota.ts";

migratePromptQuota().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
