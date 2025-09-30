import { readFileSync, writeFileSync } from "fs";
import { decodeFirebaseConfig } from "../utils/firebaseConfigCrypto.ts";

const [, , encodedFileArg, secretKey] = process.argv;
const encodedFile =
  encodedFileArg || process.env.FIREBASE_ENCODED_CONFIG_FILE || "firebase_config_encoded.txt";
const decodedFile = process.env.FIREBASE_CONFIG_FILE || "firebaseConfig.json";

if (!encodedFile || !secretKey) {
  console.log(
    "Usage: ts-node scripts/decodeFirebaseConfig.ts <encoded-config-file> <32-char-secret-key>"
  );
  process.exit(1);
}
if (secretKey.length !== 32) {
  console.error("Secret key must be exactly 32 characters long");
  process.exit(1);
}

const encodedConfig = readFileSync(encodedFile, "utf-8");
const decodedConfig = decodeFirebaseConfig(encodedConfig, secretKey);

writeFileSync(decodedFile, decodedConfig);

console.log("Firebase config decoded successfully!");
console.log("Decoded config saved to:", decodedFile);
console.log("\nDecoded config:\n", decodedConfig.toString("utf-8"));
