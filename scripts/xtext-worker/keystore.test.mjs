import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  clearLateSweep,
  createJobKey,
  deleteJobKey,
  loadJobKey,
  loadJobKeyDetailed,
  readLateSweep,
  recordLateSweep,
  wrapKeyProbeError,
} from "./keystore.mjs";

// Fixed 32-byte key standing in for wrappingKeyFromKeychain — the real function shells out to
// the macOS keychain and is never called from a test.
const WRAP_KEY = Buffer.from("11".repeat(32), "hex");

describe("worker keystore", () => {
  let jobsDir;

  beforeEach(() => {
    jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-keystore-"));
  });

  afterEach(() => {
    rmSync(jobsDir, { recursive: true, force: true });
  });

  it("a created key round-trips through the encrypted file to the same address", () => {
    const created = createJobKey("job-round-trip", WRAP_KEY, jobsDir);
    expect(Object.keys(created)).toEqual(["address"]); // no key material beyond the address

    const filePath = path.join(jobsDir, "job-round-trip.key");
    expect(statSync(filePath).mode & 0o777).toBe(0o600);

    const loaded = loadJobKey("job-round-trip", WRAP_KEY, jobsDir);
    expect(loaded.toAddress()).toBe(created.address);
  });

  it("a tampered ciphertext refuses to load (authentication, not garbage)", () => {
    createJobKey("job-tampered", WRAP_KEY, jobsDir);
    const filePath = path.join(jobsDir, "job-tampered.key");
    const payload = readFileSync(filePath);
    payload[payload.length - 1] ^= 0xff; // flip a ciphertext byte, breaking the GCM auth tag
    writeFileSync(filePath, payload);

    expect(loadJobKey("job-tampered", WRAP_KEY, jobsDir)).toBeNull();
  });

  it("delete removes the file; loading after delete is null", () => {
    createJobKey("job-delete", WRAP_KEY, jobsDir);
    const filePath = path.join(jobsDir, "job-delete.key");
    expect(existsSync(filePath)).toBe(true);

    deleteJobKey("job-delete", jobsDir);
    expect(existsSync(filePath)).toBe(false);
    expect(loadJobKey("job-delete", WRAP_KEY, jobsDir)).toBeNull();
  });

  it("two jobs never share a key", () => {
    const a = createJobKey("job-a", WRAP_KEY, jobsDir);
    const b = createJobKey("job-b", WRAP_KEY, jobsDir);
    expect(a.address).not.toBe(b.address);
  });

  it("re-creating an existing job never overwrites its published key", () => {
    // The CRITICAL race (money-path review, 2026-07-15): a second key-publish
    // for a jobId that already has a key — a concurrent worker process, or a
    // replayed publish after a stale state read — must NOT mint a fresh key
    // over the one whose address a visitor may already be paying. It returns
    // the existing key's address instead, so publish is idempotent.
    const first = createJobKey("job-republish", WRAP_KEY, jobsDir);
    const filePath = path.join(jobsDir, "job-republish.key");
    const bytesAfterFirst = readFileSync(filePath);

    const second = createJobKey("job-republish", WRAP_KEY, jobsDir);

    expect(readFileSync(filePath).equals(bytesAfterFirst)).toBe(true); // file untouched
    expect(second.address).toBe(first.address); // same published address, not a new key
    expect(loadJobKey("job-republish", WRAP_KEY, jobsDir).toAddress()).toBe(first.address);
  });

  it("a jobId containing \"../\" is refused by all three operations", () => {
    // The attack layout: the keystore is pointed at root/jobs, and a genuine
    // wrapped key sits one level up at root/escape.key. If any operation
    // joined the hostile jobId into a path, "../escape" would reach it.
    const root = jobsDir;
    const nestedJobsDir = path.join(root, "jobs");
    mkdirSync(nestedJobsDir);
    createJobKey("escape", WRAP_KEY, root);
    const outsideFile = path.join(root, "escape.key");
    const outsideBytesBefore = readFileSync(outsideFile);
    const rootEntriesBefore = readdirSync(root).sort();

    expect(createJobKey("../escape", WRAP_KEY, nestedJobsDir)).toBeNull();
    expect(readFileSync(outsideFile).equals(outsideBytesBefore)).toBe(true); // not overwritten

    // The key at root/escape.key is valid under WRAP_KEY, so a null here can
    // only come from the jobId being refused — not from a failed decrypt.
    expect(loadJobKey("../escape", WRAP_KEY, nestedJobsDir)).toBeNull();

    deleteJobKey("../escape", nestedJobsDir);
    expect(existsSync(outsideFile)).toBe(true); // not deleted

    expect(readdirSync(root).sort()).toEqual(rootEntriesBefore); // nothing appeared outside the jobs directory
    expect(readdirSync(nestedJobsDir)).toEqual([]); // and nothing inside it either
  });
});

describe("wrapping-key lifecycle (money-path review F2, 2026-08-09)", () => {
  const OTHER_KEY = Buffer.from("22".repeat(32), "hex");
  let jobsDir;

  beforeEach(() => {
    jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-lifecycle-"));
  });

  afterEach(() => {
    rmSync(jobsDir, { recursive: true, force: true });
  });

  it("loadJobKeyDetailed tells a missing file apart from a wrapping-key mismatch", () => {
    expect(loadJobKeyDetailed("never-existed", WRAP_KEY, jobsDir)).toEqual({ missing: true });

    createJobKey("job-mismatch", WRAP_KEY, jobsDir);
    expect(loadJobKeyDetailed("job-mismatch", OTHER_KEY, jobsDir)).toEqual({ authFailed: true });
    expect(loadJobKeyDetailed("job-mismatch", WRAP_KEY, jobsDir).key).toBeDefined();
  });

  it("the probe passes an empty jobs directory and a matching key, refuses a mismatched one", () => {
    expect(wrapKeyProbeError(WRAP_KEY, jobsDir)).toBeNull(); // nothing to verify
    expect(wrapKeyProbeError(WRAP_KEY, path.join(jobsDir, "does-not-exist"))).toBeNull();

    createJobKey("job-probe", WRAP_KEY, jobsDir);
    expect(wrapKeyProbeError(WRAP_KEY, jobsDir)).toBeNull();

    const refusal = wrapKeyProbeError(OTHER_KEY, jobsDir);
    expect(refusal).toContain("Do NOT seed a fresh wrapping key");
    expect(refusal).toContain("Restore the original");
  });

  it("late-sweep markers round-trip, survive by file, and clear with the key's lifecycle", () => {
    expect(readLateSweep("job-late", jobsDir)).toBeNull();

    recordLateSweep("job-late", "ab".repeat(32), jobsDir);
    expect(readLateSweep("job-late", jobsDir)).toBe("ab".repeat(32));

    clearLateSweep("job-late", jobsDir);
    expect(readLateSweep("job-late", jobsDir)).toBeNull();
  });

  it("a hostile jobId never writes or reads a marker outside the jobs directory", () => {
    recordLateSweep("../escape-marker", "ab".repeat(32), jobsDir);
    expect(readLateSweep("../escape-marker", jobsDir)).toBeNull();
    expect(readdirSync(jobsDir)).toEqual([]);
  });
});
