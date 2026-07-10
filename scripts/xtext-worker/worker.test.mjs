import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrivateKey, Script, Transaction } from "@bsv/sdk";
import { applyEvent } from "@/lib/textJob/jobs";
import { createJobKey, loadJobKey } from "./keystore.mjs";
import { revenueAddressError, runWorkerTick } from "./worker.mjs";

const WRAP_KEY = Buffer.from("11".repeat(32), "hex");

// A funding transaction whose first input is a standard P2PKH spend, so
// refundAddressOf resolves an address and the payment-seen event fires.
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

// A faithful fake store: it drives the REAL state machine (applyEvent), so the
// loop is tested against the actual transition table, not a mock of it.
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

function stubFetch({ fundingTxid, fundingHex, utxoValue }) {
  return vi.fn(async (url, opts) => {
    if (url.includes("/api/x/register")) return { ok: true, status: 200, json: async () => ({ ok: true }) };
    if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
      // Echo the txid of the exact bytes submitted, as a real miner would.
      const txid = Transaction.fromHex(opts.body).id("hex");
      return { ok: true, status: 200, json: async () => ({ txid, txStatus: "SEEN_ON_NETWORK", status: 200 }) };
    }
    if (url.includes("/unspent")) return { ok: true, json: async () => [{ tx_hash: fundingTxid, tx_pos: 0, value: utxoValue }] };
    if (url.includes(`/tx/${fundingTxid}/hex`)) return { ok: true, text: async () => fundingHex };
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("revenueAddressError (hard rule 1 — refuse to start without a valid cold address)", () => {
  it("an unset revenue address refuses", () => {
    expect(revenueAddressError("")).not.toBeNull();
  });
  it("a malformed revenue address refuses", () => {
    expect(revenueAddressError("not-an-address")).not.toBeNull();
  });
  it("a valid address is accepted", () => {
    expect(revenueAddressError(PrivateKey.fromRandom().toAddress())).toBeNull();
  });
});

describe("runWorkerTick", () => {
  it("walks a job from quoted to done, deleting its key, and retains a broadcast-failed job's key", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-loop-"));
    try {
      const revenueAddress = PrivateKey.fromRandom().toAddress();
      const fundingTxid = "33".repeat(32);
      const fundingHex = fundingTxHex(standardP2pkhUnlock(PrivateKey.fromRandom()));
      const archive = { v: 1, source: "x", handle: "henry", profile: {}, posts: [{ id: "1", at: "2020-01-01", text: "hi" }] };

      // A funded job whose funding cannot cover the premium: buildInscriptionTx
      // refuses -> broadcast-failed -> sweeping. Its key must survive for the sweep.
      const failsKey = createJobKey("fails-job", WRAP_KEY, jobsDir);
      expect(failsKey).not.toBeNull();

      const store = makeStore(
        [
          { jobId: "happy-job", handle: "henry", state: "quoted", premiumSats: 5_000, priceSats: 6_000, expiresAtMs: 10_000 },
          {
            jobId: "fails-job",
            handle: "nemo",
            state: "funded",
            premiumSats: 10_000,
            priceSats: 11_000,
            expiresAtMs: 10_000,
            fundingTxid,
            fundingVout: 0,
            fundingSats: 300,
          },
        ],
        { "happy-job": archive, "fails-job": archive },
      );

      const fetchFn = stubFetch({ fundingTxid, fundingHex, utxoValue: 1_000_000 });

      await runWorkerTick({
        listJobsInState: store.listJobsInState,
        advance: store.advance,
        getPayload: store.getPayload,
        fetchFn,
        wrapKey: WRAP_KEY,
        jobsDir,
        revenueAddress,
        feeRate: 100,
        registerBaseUrl: "https://www.henceforth.club",
        nowMs: 2_000,
      });

      expect(store.jobs.get("happy-job").state).toBe("done");
      // The recorded txid is the deterministic hash of the exact broadcast
      // bytes (buildInscriptionTx computes it; ARC only echoes it back).
      const recordedTxid = store.jobs.get("happy-job").inscriptionTxid;
      expect(recordedTxid).toMatch(/^[0-9a-f]{64}$/);
      expect(fetchFn).toHaveBeenCalledWith(
        "https://www.henceforth.club/api/x/register",
        expect.objectContaining({ body: JSON.stringify({ handle: "henry", txid: recordedTxid }) }),
      );
      expect(store.jobs.get("fails-job").state).toBe("sweeping");

      // Custody ends exactly at completion: the done job's key is gone, the
      // sweeping job's key is retained for the refund.
      expect(loadJobKey("happy-job", WRAP_KEY, jobsDir)).toBeNull();
      expect(loadJobKey("fails-job", WRAP_KEY, jobsDir)).not.toBeNull();
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("a thrown error while processing one job does not abort the tick", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-throw-"));
    try {
      const store = makeStore(
        [{ jobId: "boom", handle: "x", state: "quoted", premiumSats: 1, priceSats: 1, expiresAtMs: 10_000 }],
        { boom: {} },
      );
      store.advance.mockImplementation(async () => {
        throw new Error("advance blew up");
      });
      const fetchFn = vi.fn(async () => {
        throw new Error("no network expected in this tick");
      });

      await expect(
        runWorkerTick({
          listJobsInState: store.listJobsInState,
          advance: store.advance,
          getPayload: store.getPayload,
          fetchFn,
          wrapKey: WRAP_KEY,
          jobsDir,
          revenueAddress: PrivateKey.fromRandom().toAddress(),
          feeRate: 100,
          registerBaseUrl: "https://www.henceforth.club",
          nowMs: 2_000,
        }),
      ).resolves.toBeUndefined();
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });
});
