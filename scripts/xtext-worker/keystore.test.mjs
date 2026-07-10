import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createJobKey, loadJobKey, deleteJobKey } from "./keystore.mjs";

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
