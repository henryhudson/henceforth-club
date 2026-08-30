// The pure half of putting a document on the chain: sealing a payload,
// opening it again, and the envelope the OP_RETURN carries. No network, no
// key material beyond what is passed in, so every path here is testable
// without a wallet.
//
// Envelope (one push each, in order):
//   marker · surface · date · key identifier · previous transaction · sealed payload
// The previous transaction is the id of this surface's last inscription, or
// empty for the first, so a reader can walk a surface backwards from any
// document it holds. The key identifier names which archive key opens the
// payload without revealing it.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

export const INSCRIPTION_MARKER = "henceforth.club/board";
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

/** A short public name for a secret key: the first eight hex characters of
 *  its SHA-256. Enough to tell two archive keys apart; useless for recovery. */
export function keyIdentifier(keyHex) {
  return createHash("sha256").update(Buffer.from(keyHex, "hex")).digest("hex").slice(0, 8);
}

/** gzip, then AES-256-GCM: nonce ‖ tag ‖ ciphertext. Compression first, so
 *  the chain carries the smaller form and the tag covers what is stored. */
export function sealPayload(bytes, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("archive key must be 32 bytes of hex");
  const compressed = gzipSync(Buffer.from(bytes));
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]);
}

/** The inverse. A wrong key or a touched byte fails the GCM tag and throws;
 *  nothing partial is ever returned. */
export function openPayload(sealed, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const buf = Buffer.from(sealed);
  if (buf.length < NONCE_LENGTH + TAG_LENGTH) throw new Error("sealed payload is too short to carry a nonce and a tag");
  const nonce = buf.subarray(0, NONCE_LENGTH);
  const tag = buf.subarray(NONCE_LENGTH, NONCE_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(NONCE_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return gunzipSync(compressed);
}

const utf8 = (s) => Buffer.from(s, "utf8");

/** The pushes for the OP_RETURN, in envelope order. */
export function buildEnvelope({ surface, date, keyId, previousTxid = "", sealed }) {
  if (!surface || !/^[a-z][a-z0-9-]*$/.test(surface)) throw new Error(`surface must be a lowercase slug, got ${JSON.stringify(surface)}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`date must be YYYY-MM-DD, got ${JSON.stringify(date)}`);
  if (!/^[0-9a-f]{8}$/.test(keyId)) throw new Error(`key identifier must be eight hex characters, got ${JSON.stringify(keyId)}`);
  if (previousTxid && !/^[0-9a-f]{64}$/.test(previousTxid)) throw new Error("previous transaction id must be 64 lowercase hex characters");
  // "-" stands for no previous transaction: one byte, never a valid id, and
  // never an empty push, which a script parser reads as OP_0 with no data.
  return [utf8(INSCRIPTION_MARKER), utf8(surface), utf8(date), utf8(keyId), utf8(previousTxid || NO_PREVIOUS), Buffer.from(sealed)];
}
const NO_PREVIOUS = "-";

/** Read an envelope back from its pushes. Returns null for anything that is
 *  not one of ours, so a reader can skip foreign outputs without throwing. */
export function parseEnvelope(chunks) {
  if (!Array.isArray(chunks) || chunks.length !== 6) return null;
  const [marker, surface, date, keyId, previousTxid, sealed] = chunks.map((c) => Buffer.from(c));
  if (marker.toString("utf8") !== INSCRIPTION_MARKER) return null;
  return {
    surface: surface.toString("utf8"),
    date: date.toString("utf8"),
    keyId: keyId.toString("utf8"),
    previousTxid: previousTxid.toString("utf8") === NO_PREVIOUS ? null : previousTxid.toString("utf8"),
    sealed,
  };
}

/** The one assertion a transaction must pass before it is signed: it has a
 *  spendable change output. A transaction whose only output is data would
 *  hand the whole input to the miner as fee. */
export function assertHasChange(outputs) {
  const change = outputs.find((o) => o.change === true && (o.satoshis ?? 0) > 0);
  if (!change) throw new Error("refusing to sign: the transaction has no change output, so its only output would be data");
  return change;
}
