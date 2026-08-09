// The 2026-08-09 money-path review's worker-loop fixes, pinned end to end
// against the REAL state machine (the same makeStore shape worker.test.mjs
// uses): the false-failure heal (F4 — a broadcast that reports failure for a
// transaction the network took must never wedge the job in sweeping) and the
// reaper's respect for an unconfirmed late-straggler sweep (F3 — an empty
// unspent read is not enough while a mempool spend hides the outputs).

import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrivateKey, Script, Transaction } from "@bsv/sdk";
import { applyEvent } from "@/lib/folkloreJob/jobs";
import { createJobKey, loadJobKey, readLateSweep, recordLateSweep } from "./keystore.mjs";
import { runWorkerTick } from "./worker.mjs";

const WRAP_KEY = Buffer.from("11".repeat(32), "hex");

function fundingTxHex(unlockingScript) {
  const tx = new Transaction(
    1,
    [{ sourceTXID: "11".repeat(32), sourceOutputIndex: 0, unlockingScript, sequence: 0xffffffff }],
    [{ satoshis: 1000, lockingScript: Script.fromASM("OP_TRUE") }],
    0,
  );
  return tx.toHex();
}
const standardP2pkhUnlock = (key) =>
  new Script().writeBin(Array(71).fill(0x30)).writeBin(key.toPublicKey().toDER());

function makeStore(initialJobs, payloads) {
  const jobs = new Map(initialJobs.map((j) => [j.jobId, { ...j }]));
  const payloadMap = new Map(Object.entries(payloads));
  return {
    jobs,
    listJobsInState: vi.fn(async (state) => [...jobs.values()].filter((j) => j.state === state).map((j) => ({ ...j }))),
    advance: vi.fn(async (jobId, event, nowMs) => {
      const job = jobs.get(jobId);
      if (!job) return { ok: false, refused: "not-found" };
      const result = applyEvent(job, event, nowMs);
      if (!result.ok) return result;
      jobs.set(jobId, result.job);
      if (result.job.state === "done" || result.job.state === "swept") payloadMap.delete(jobId);
      return { ok: true, job: result.job };
    }),
    getPayload: vi.fn(async (jobId) => payloadMap.get(jobId) ?? null),
  };
}

function deps(store, fetchFn, jobsDir, nowMs) {
  return {
    listJobsInState: store.listJobsInState,
    advance: store.advance,
    getPayload: store.getPayload,
    fetchFn,
    wrapKey: WRAP_KEY,
    jobsDir,
    revenueAddress: PrivateKey.fromRandom().toAddress(),
    feeRate: 100,
    registerBaseUrl: "https://www.henceforth.club",
    nowMs,
  };
}

describe("runWorkerTick — the false-failure heal (money-path review F4)", () => {
  function fundedJob(jobId, jobAddress, fundingTxid, payerRefundAddress) {
    return {
      jobId,
      kind: "archive",
      handle: "nemo",
      state: "funded",
      address: jobAddress,
      fundingTxid,
      fundingVout: 0,
      fundingSats: 1_000_000,
      premiumSats: 10_000,
      priceSats: 11_000,
      feeSats: 1_000,
      expiresAtMs: 10_000_000,
      payerRefundAddress,
    };
  }
  const payload = { v: 1, source: "x", handle: "nemo", profile: {}, posts: [] };

  it("a broadcast that reports failure for a transaction the network took advances to inscribed, never sweeping", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-heal-"));
    try {
      const jobId = "false-failure-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const store = makeStore(
        [fundedJob(jobId, created.address, "66".repeat(32), PrivateKey.fromRandom().toAddress())],
        { [jobId]: payload },
      );

      let submittedHex = null;
      const fetchFn = vi.fn(async (url, opts) => {
        if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
          submittedHex = opts.body; // the network TOOK the bytes...
          throw new Error("gateway timeout"); // ...but the response was lost
        }
        if (url.includes("/hex")) {
          const wanted = submittedHex ? Transaction.fromHex(submittedHex).id("hex") : null;
          if (wanted && url.includes(`/tx/${wanted}/hex`)) return { ok: true, text: async () => submittedHex };
          return { ok: false, status: 404, text: async () => "" };
        }
        if (url.includes("/unspent")) return { ok: true, json: async () => [] };
        throw new Error(`unexpected fetch: ${url}`);
      });

      await runWorkerTick(deps(store, fetchFn, jobsDir, 2_000));

      const job = store.jobs.get(jobId);
      expect(job.state).toBe("inscribed");
      expect(job.inscriptionTxid).toBe(Transaction.fromHex(submittedHex).id("hex"));
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("a genuinely failed broadcast records the attempted txid on its way into sweeping", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-heal-"));
    try {
      const jobId = "true-failure-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const store = makeStore(
        [fundedJob(jobId, created.address, "77".repeat(32), PrivateKey.fromRandom().toAddress())],
        { [jobId]: payload },
      );

      let submittedHex = null;
      const fetchFn = vi.fn(async (url, opts) => {
        if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
          submittedHex = opts.body;
          return {
            ok: true,
            status: 200,
            json: async () => ({ txid: "", txStatus: "REJECTED", extraInfo: "bad script", status: 462 }),
          };
        }
        if (url.includes("/hex")) return { ok: false, status: 404, text: async () => "" }; // probe: genuinely absent
        if (url.includes("/unspent")) return { ok: true, json: async () => [] };
        throw new Error(`unexpected fetch: ${url}`);
      });

      await runWorkerTick(deps(store, fetchFn, jobsDir, 2_000));

      const job = store.jobs.get(jobId);
      expect(job.state).toBe("sweeping");
      expect(job.attemptedInscriptionTxid).toBe(Transaction.fromHex(submittedHex).id("hex"));
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("a sweeping job with nothing to sweep and its attempted transaction on the network heals to inscribed", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-heal-"));
    try {
      const jobId = "wedged-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const attemptedTxid = "88".repeat(32);
      const store = makeStore(
        [
          {
            jobId,
            kind: "archive",
            handle: "nemo",
            state: "sweeping",
            address: created.address,
            fundingTxid: "99".repeat(32),
            fundingVout: 0,
            fundingSats: 1_000_000,
            premiumSats: 10_000,
            priceSats: 11_000,
            expiresAtMs: 10_000_000,
            failureReason: "gorillapool: gateway timeout",
            attemptedInscriptionTxid: attemptedTxid,
          },
        ],
        {},
      );

      const fetchFn = vi.fn(async (url) => {
        if (url.includes("/unspent")) return { ok: true, json: async () => [] }; // the funding is SPENT
        if (url.includes(`/tx/${attemptedTxid}/hex`)) return { ok: true, text: async () => "00" }; // ...by the inscription
        throw new Error(`unexpected fetch: ${url}`);
      });

      await runWorkerTick(deps(store, fetchFn, jobsDir, 2_000));

      const job = store.jobs.get(jobId);
      expect(job.state).toBe("inscribed");
      expect(job.inscriptionTxid).toBe(attemptedTxid);
      expect(job.failureReason).toBeUndefined();
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });
});

describe("runWorkerTick — the reaper and the unconfirmed late sweep (money-path review F3)", () => {
  const LATE = 8 * 24 * 60 * 60 * 1000; // past the 7-day window

  function sweptJob(jobId, address) {
    return {
      jobId,
      kind: "archive",
      handle: "nemo",
      state: "swept",
      address,
      premiumSats: 10_000,
      priceSats: 11_000,
      expiresAtMs: 10_000,
    };
  }

  it("an empty read does NOT reap while a recorded late sweep is unconfirmed; confirmation releases the reap", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-reap-"));
    try {
      const jobId = "late-sweep-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const lateSweepTxid = "aa".repeat(32);
      recordLateSweep(jobId, lateSweepTxid, jobsDir);

      const store = makeStore([sweptJob(jobId, created.address)], {});

      let confirmed = false;
      const fetchFn = vi.fn(async (url) => {
        if (url.includes("/unspent")) return { ok: true, json: async () => [] }; // hidden by the mempool spend
        if (url.includes(`/tx/hash/${lateSweepTxid}`)) {
          return { ok: true, json: async () => ({ confirmations: confirmed ? 1 : 0 }) };
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

      // Unconfirmed: the key must survive — a dropped sweep would need it.
      await runWorkerTick(deps(store, fetchFn, jobsDir, 10_000 + LATE));
      expect(loadJobKey(jobId, WRAP_KEY, jobsDir)).not.toBeNull();
      expect(readLateSweep(jobId, jobsDir)).toBe(lateSweepTxid);

      // Confirmed: custody may end, and the marker goes with the key.
      confirmed = true;
      await runWorkerTick(deps(store, fetchFn, jobsDir, 10_000 + LATE));
      expect(loadJobKey(jobId, WRAP_KEY, jobsDir)).toBeNull();
      expect(readLateSweep(jobId, jobsDir)).toBeNull();
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("a straggler sweep broadcast writes the durable marker with its txid", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-reap-"));
    try {
      const jobId = "straggler-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const payerKey = PrivateKey.fromRandom();
      const stragglerTxid = "bb".repeat(32);
      const stragglerHex = fundingTxHex(standardP2pkhUnlock(payerKey));

      const store = makeStore([sweptJob(jobId, created.address)], {});

      let broadcastHex = null;
      const fetchFn = vi.fn(async (url, opts) => {
        if (url.includes("/unspent")) {
          return {
            ok: true,
            json: async () => (broadcastHex ? [] : [{ tx_hash: stragglerTxid, tx_pos: 0, value: 50_000 }]),
          };
        }
        if (url.includes(`/tx/${stragglerTxid}/hex`)) return { ok: true, text: async () => stragglerHex };
        if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
          broadcastHex = opts.body;
          const txid = Transaction.fromHex(opts.body).id("hex");
          return { ok: true, status: 200, json: async () => ({ txid, txStatus: "SEEN_ON_NETWORK", status: 200 }) };
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

      // Within the window: the straggler is swept and the marker is recorded.
      await runWorkerTick(deps(store, fetchFn, jobsDir, 20_000));
      expect(broadcastHex).not.toBeNull();
      expect(readLateSweep(jobId, jobsDir)).toBe(Transaction.fromHex(broadcastHex).id("hex"));
      expect(loadJobKey(jobId, WRAP_KEY, jobsDir)).not.toBeNull();
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });
});
