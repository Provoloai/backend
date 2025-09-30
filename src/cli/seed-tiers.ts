#!/usr/bin/env node
import "dotenv/config";
import { seedTiers } from "../seed/seedTiers.ts";

seedTiers();
