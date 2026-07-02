import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

/** payload = 12-byte nonce ‖ 16-byte GCM tag ‖ ciphertext */
export function encryptPdf(pdf: Uint8Array, keyHex: string): Uint8Array {
  const key = Buffer.from(keyHex, "hex");
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(pdf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return new Uint8Array(Buffer.concat([nonce, tag, ciphertext]));
}

export function decryptPdf(payload: Uint8Array, keyHex: string): Uint8Array {
  const key = Buffer.from(keyHex, "hex");
  const buf = Buffer.from(payload);
  const nonce = buf.subarray(0, NONCE_LENGTH);
  const tag = buf.subarray(NONCE_LENGTH, NONCE_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(NONCE_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
}
