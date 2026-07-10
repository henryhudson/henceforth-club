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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const key = PrivateKey.fromRandom();
  mkdirSync(jobsDir, { recursive: true });
  writeFileSync(keyFilePath(jobId, jobsDir), wrapWif(key.toWif(), wrapKey), { mode: 0o600 });
  return { address: key.toAddress() };
}

/**
 * Loads and decrypts jobId's key, or null if the jobId is refused, the file
 * is missing, or the payload fails authentication.
 */
export function loadJobKey(jobId, wrapKey, jobsDir = DEFAULT_JOBS_DIR) {
  if (!validJobId(jobId)) return null;
  const filePath = keyFilePath(jobId, jobsDir);
  if (!existsSync(filePath)) return null;
  const wif = unwrapWif(readFileSync(filePath), wrapKey);
  return wif === null ? null : PrivateKey.fromWif(wif);
}

/** Removes jobId's key file. A no-op if the jobId is refused or the file is already gone. */
export function deleteJobKey(jobId, jobsDir = DEFAULT_JOBS_DIR) {
  if (!validJobId(jobId)) return;
  rmSync(keyFilePath(jobId, jobsDir), { force: true });
}

/** The worker's wrapping key, held in the macOS keychain — never in the repo, never on the website. */
export function wrappingKeyFromKeychain() {
  const hex = execFileSync("security", ["find-generic-password", "-s", "xtext-worker-wrap", "-w"], {
    encoding: "utf8",
  }).trim();
  return Buffer.from(hex, "hex");
}
