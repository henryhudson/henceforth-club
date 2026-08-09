// One random key per job, encrypted at rest, deletable on sight. Runs on the
// Mac mini worker only — never on the website, never in Upstash, never in a
// Vercel environment. This module is the randomness and file-system boundary
// for the worker's per-job keys; nothing else in the pipeline should touch
// node:crypto's random source or the jobs directory directly.
//
// Payload format (mirrors src/lib/board-pdf-crypto.ts): 12-byte random nonce
// ‖ 16-byte GCM authentication tag ‖ ciphertext, under aes-256-gcm with the
// wrapping key used directly as the AES key (already 32 raw bytes).

import { execFileSync } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrivateKey } from "@bsv/sdk";

const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

const DEFAULT_JOBS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "jobs");

// A job identifier is a plain token — letters, digits, hyphens, nothing else.
// Today's jobIds are server-generated random identifiers that always match,
// but this module holds fund-linked keys and must not trust its caller: a
// hostile jobId like "../../somewhere/x" would otherwise be joined into a
// path that escapes the jobs directory. Every operation refuses a jobId
// that fails this test before touching the file system.
const JOB_ID_PATTERN = /^[A-Za-z0-9-]+$/;

const validJobId = (jobId) => JOB_ID_PATTERN.test(jobId);

function keyFilePath(jobId, jobsDir) {
  return path.join(jobsDir, `${jobId}.key`);
}

function wrapWif(wif, wrapKey) {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", wrapKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(wif, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, ciphertext]);
}

/** The decrypted WIF, or null if the wrapping key is wrong or the ciphertext was altered. */
function unwrapWif(payload, wrapKey) {
  try {
    const nonce = payload.subarray(0, NONCE_LENGTH);
    const tag = payload.subarray(NONCE_LENGTH, NONCE_LENGTH + TAG_LENGTH);
    const ciphertext = payload.subarray(NONCE_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", wrapKey, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null; // authentication failure — refuse, never return partial or garbage plaintext
  }
}

/**
 * Generates a fresh random key for jobId, encrypts its private form at rest,
 * and returns only the address — or null when the jobId is refused.
 */
export function createJobKey(jobId, wrapKey, jobsDir = DEFAULT_JOBS_DIR) {
  if (!validJobId(jobId)) return null;
  mkdirSync(jobsDir, { recursive: true });
  const key = PrivateKey.fromRandom();
  try {
    // Exclusive create ("wx"): if a key already exists for this jobId the write
    // fails rather than clobbering it. A published custody key is fund-linked —
    // a concurrent or replayed mint that overwrote it would strand the coin the
    // visitor sent to the first key's address (money-path review, 2026-07-15).
    writeFileSync(keyFilePath(jobId, jobsDir), wrapWif(key.toWif(), wrapKey), { mode: 0o600, flag: "wx" });
  } catch (err) {
    if (err?.code !== "EEXIST") throw err;
    // The job already has a key — return its address so publish is idempotent,
    // never a fresh one that would orphan an already-advertised address.
    const existing = loadJobKey(jobId, wrapKey, jobsDir);
    return existing === null ? null : { address: existing.toAddress() };
  }
  return { address: key.toAddress() };
}

/**
 * Loads and decrypts jobId's key with the failure mode made explicit:
 * { key } on success, { missing: true } when no file exists (or the jobId is
 * refused), { authFailed: true } when a file EXISTS but the wrapping key
 * cannot open it. The two nulls are operationally opposite — a missing file
 * is a routine "this job never had a key", an authentication failure on a
 * present file means the wrapping key is wrong and someone must look before
 * anything is reaped (money-path review F2, 2026-08-09).
 */
export function loadJobKeyDetailed(jobId, wrapKey, jobsDir = DEFAULT_JOBS_DIR) {
  if (!validJobId(jobId)) return { missing: true };
  const filePath = keyFilePath(jobId, jobsDir);
  if (!existsSync(filePath)) return { missing: true };
  const wif = unwrapWif(readFileSync(filePath), wrapKey);
  if (wif === null) return { authFailed: true };
  return { key: PrivateKey.fromWif(wif) };
}

/**
 * Loads and decrypts jobId's key, or null if the jobId is refused, the file
 * is missing, or the payload fails authentication. Callers who need to tell
 * those apart use loadJobKeyDetailed.
 */
export function loadJobKey(jobId, wrapKey, jobsDir = DEFAULT_JOBS_DIR) {
  const loaded = loadJobKeyDetailed(jobId, wrapKey, jobsDir);
  return loaded.key ?? null;
}

/**
 * Whether the wrapping key can open the custody keys already on disk — the
 * startup probe. Answers null when there is nothing to verify (no wrapped
 * keys exist) or when the first wrapped key opens; answers a refusal message
 * when wrapped keys exist that this wrapping key cannot open. The worker
 * refuses to start on that message: running would read every fund-linked key
 * as absent, and the operator's instinct — seed a fresh wrapping key — would
 * strand them all. The only correct move is restoring the original key.
 */
export function wrapKeyProbeError(wrapKey, jobsDir = DEFAULT_JOBS_DIR) {
  let names;
  try {
    names = readdirSync(jobsDir).filter((name) => name.endsWith(".key"));
  } catch {
    return null; // no jobs directory yet — nothing to verify
  }
  if (names.length === 0) return null;
  const wif = unwrapWif(readFileSync(path.join(jobsDir, names[0])), wrapKey);
  if (wif !== null) return null;
  return (
    `${names.length} wrapped custody key(s) exist on disk but the wrapping key cannot open them. ` +
    "The keychain item does not match the key that wrapped them. Do NOT seed a fresh wrapping key — " +
    "that would strand every fund-linked custody key for good. Restore the original wrapping key."
  );
}

/** Removes jobId's key file. A no-op if the jobId is refused or the file is already gone. */
export function deleteJobKey(jobId, jobsDir = DEFAULT_JOBS_DIR) {
  if (!validJobId(jobId)) return;
  rmSync(keyFilePath(jobId, jobsDir), { force: true });
}

/** Removes jobId's late-sweep marker alongside its key. */
export function clearLateSweep(jobId, jobsDir = DEFAULT_JOBS_DIR) {
  if (!validJobId(jobId)) return;
  rmSync(lateSweepFilePath(jobId, jobsDir), { force: true });
}

function lateSweepFilePath(jobId, jobsDir) {
  return path.join(jobsDir, `${jobId}.late-sweep`);
}

/**
 * Records the txid of a late-straggler sweep broadcast for jobId — durable,
 * so a worker restart cannot forget that a spend of this address is in
 * flight. The reaper refuses to delete the custody key while this marker's
 * transaction is unconfirmed: an unconfirmed sweep hides the address's
 * outputs from the unspent read, and if that sweep were later dropped the
 * outputs would reappear with no key left to spend them (money-path review
 * F3, 2026-08-09).
 */
export function recordLateSweep(jobId, txid, jobsDir = DEFAULT_JOBS_DIR) {
  if (!validJobId(jobId)) return;
  mkdirSync(jobsDir, { recursive: true });
  writeFileSync(lateSweepFilePath(jobId, jobsDir), txid, { mode: 0o600 });
}

/** The recorded late-sweep txid for jobId, or null when none was recorded. */
export function readLateSweep(jobId, jobsDir = DEFAULT_JOBS_DIR) {
  if (!validJobId(jobId)) return null;
  const filePath = lateSweepFilePath(jobId, jobsDir);
  if (!existsSync(filePath)) return null;
  const txid = readFileSync(filePath, "utf8").trim();
  return txid.length > 0 ? txid : null;
}

/**
 * The worker's wrapping key, held in the macOS keychain — never in the repo,
 * never on the website. Throws when the keychain answer does not decode to
 * exactly 32 bytes: a truncated or mis-pasted secret would otherwise ride
 * silently into createCipheriv and fail at the first mint, far from its cause.
 */
export function wrappingKeyFromKeychain() {
  const hex = execFileSync("security", ["find-generic-password", "-s", "xtext-worker-wrap", "-w"], {
    encoding: "utf8",
  }).trim();
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      `the keychain wrapping key decodes to ${key.length} bytes, not 32 — the item is truncated or mis-seeded`,
    );
  }
  return key;
}
