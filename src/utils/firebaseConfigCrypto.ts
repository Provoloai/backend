import crypto from "crypto";

export function encodeFirebaseConfig(configJSON: Buffer | string, secretKey: string): string {
  if (secretKey.length !== 32) throw new Error("Secret key must be 32 characters long");
  const key = Buffer.from(secretKey, "utf-8");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(typeof configJSON === "string" ? Buffer.from(configJSON, "utf-8") : configJSON),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const encrypted = Buffer.concat([iv, tag, ciphertext]);
  return encrypted.toString("base64");
}

export function decodeFirebaseConfig(encodedConfig: string, secretKey: string): Buffer {
  if (secretKey.length !== 32) throw new Error("Secret key must be 32 characters long");
  const key = Buffer.from(secretKey, "utf-8");
  const encrypted = Buffer.from(encodedConfig, "base64");

  const iv = encrypted.slice(0, 12);
  const tag = encrypted.slice(12, 28);
  const ciphertext = encrypted.slice(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext;
}
