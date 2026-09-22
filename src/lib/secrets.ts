import { createHash, randomBytes } from "node:crypto";

export function generateSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
