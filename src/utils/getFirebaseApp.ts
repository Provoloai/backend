import { readFileSync, existsSync } from "fs";
import { decodeFirebaseConfig } from "./firebaseConfigCrypto.ts";
import { initializeApp, applicationDefault, cert, getApps, getApp } from "firebase-admin/app";
import type { App, ServiceAccount } from "firebase-admin/app";

// Get Firebase App instance with config from env, encoded file, or fallback to JSON
let cachedApp: App | null = null;

export function closeFirebaseApp(): void {
  if (cachedApp) {
    // @ts-ignore: Firebase admin SDK does not type delete() on App, but it's available
    cachedApp.delete && cachedApp.delete();
    cachedApp = null;
  }
}

export function getFirebaseApp(): App {
  if (cachedApp) {
    return cachedApp;
  }
  const encodedConfig = process.env.FIREBASE_ENCODED_CONFIG || "";
  const secretKey = process.env.FIREBASE_SECRET_KEY || "";

  let credential;

  if (encodedConfig && secretKey) {
    // Decode from env
    const configData = decodeFirebaseConfig(encodedConfig, secretKey);
    credential = cert(JSON.parse(configData.toString("utf-8")) as ServiceAccount);
  } else {
    // Use env for encoded config file name
    const encodedFile = process.env.FIREBASE_ENCODED_CONFIG_FILE || "firebase_config_encoded.txt";
    if (existsSync(encodedFile)) {
      const encodedData = readFileSync(encodedFile, "utf-8");
      if (!secretKey) throw new Error("FIREBASE_SECRET_KEY environment variable is required");
      const configData = decodeFirebaseConfig(encodedData, secretKey);
      credential = cert(JSON.parse(configData.toString("utf-8")) as ServiceAccount);
    } else {
      // Use env for plain config file name
      const plainFile = process.env.FIREBASE_CONFIG_FILE || "firebaseConfig.json";
      if (existsSync(plainFile)) {
        credential = cert(JSON.parse(readFileSync(plainFile, "utf-8")) as ServiceAccount);
      } else {
        // Fallback to application default DEV environment
        credential = applicationDefault();
      }
    }
  }

  if (getApps().length > 0) {
    const existing = getApp();
    cachedApp = existing;
    return existing;
  }
  const created = initializeApp({ credential });
  cachedApp = created;
  return created;
}
