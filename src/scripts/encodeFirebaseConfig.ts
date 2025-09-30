import { readFileSync, writeFileSync } from "fs";
import { encodeFirebaseConfig } from "../utils/firebaseConfigCrypto.ts";

const [, , configFileArg, secretKey] = process.argv;
const configFile = configFileArg || process.env.FIREBASE_CONFIG_FILE || "firebaseConfig.json";
const encodedFile = process.env.FIREBASE_ENCODED_CONFIG_FILE || "firebase_config_encoded.txt";

if (!configFile || !secretKey) {
  console.log(
    "Usage: ts-node scripts/encodeFirebaseConfig.ts <firebase-config-file> <32-char-secret-key>"
  );
  process.exit(1);
}
if (secretKey.length !== 32) {
  console.error("Secret key must be exactly 32 characters long");
  process.exit(1);
}

const configData = readFileSync(configFile);
const encodedConfig = encodeFirebaseConfig(configData, secretKey);

writeFileSync(encodedFile, encodedConfig);

console.log("Firebase config encoded successfully!");
console.log("Encoded config saved to:", encodedFile);
console.log("\nEncoded config:\n", encodedConfig);
