#!/usr/bin/env node
import "dotenv/config";
import { seedUserPolarIds } from "../seed/seedUserPolarIds.ts";

seedUserPolarIds()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
