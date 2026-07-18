import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { P2PKH, PrivateKey, Script, Transaction } from "@bsv/sdk";
import { applyEvent } from "@/lib/folkloreJob/jobs";
import { createJobKey, loadJobKey } from "./keystore.mjs";
import { buildSweepTx } from "./sweep.mjs";
import { floatLegSats, floatPoolAddressError, revenueAddressError, runWorkerTick } from "./worker.mjs";

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
  // Once the inscription broadcasts, the funding leg is spent, so the job
  // address reads empty afterward. This lets one address answer "funded" to
  // the payment watch and "empty" to the later done-job late-watch and reaper,
  // exactly as the chain would.
  let inscribed = false;
  return vi.fn(async (url, opts) => {
    if (url.includes("/api/x/register")) return { ok: true, status: 200, json: async () => ({ ok: true }) };
    if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
      inscribed = true;
      // Echo the txid of the exact bytes submitted, as a real miner would.
      const txid = Transaction.fromHex(opts.body).id("hex");
      return { ok: true, status: 200, json: async () => ({ txid, txStatus: "SEEN_ON_NETWORK", status: 200 }) };
    }
    if (url.includes("/unspent")) {
      return { ok: true, json: async () => (inscribed ? [] : [{ tx_hash: fundingTxid, tx_pos: 0, value: utxoValue }]) };
    }
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

describe("floatPoolAddressError — the £2 leg's destination, validated like the revenue address", () => {
  it("an unset float pool address refuses (per job, not at startup)", () => {
    expect(floatPoolAddressError("")).not.toBeNull();
    expect(floatPoolAddressError(undefined)).not.toBeNull();
  });
  it("a malformed float pool address refuses", () => {
    expect(floatPoolAddressError("not-an-address")).not.toBeNull();
  });
  it("a valid address is accepted", () => {
    expect(floatPoolAddressError(PrivateKey.fromRandom().toAddress())).toBeNull();
  });
});

describe("floatLegSats — the £2 leg derived from the untouched record schema", () => {
  it("is price minus fee minus premium on a £2-era record", () => {
    expect(floatLegSats({ feeSats: 1_000, premiumSats: 0, priceSats: 19_000 })).toBe(18_000);
  });
  it("is zero on a £1-era record, whose fee plus premium is the whole price", () => {
    expect(floatLegSats({ feeSats: 500, premiumSats: 9_290_000, priceSats: 9_290_500 })).toBe(0);
  });
  it("is zero on records missing or corrupting the decomposition", () => {
    expect(floatLegSats({ premiumSats: 5_000, priceSats: 6_000 })).toBe(0); // no feeSats recorded
    expect(floatLegSats({ feeSats: 2_000, premiumSats: 0, priceSats: 1_000 })).toBe(0); // negative leg
  });
});

describe("runWorkerTick", () => {
  it("walks a job from quoted to done, retaining its key at done for the late watch, then reaps it once the window closes", async () => {
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

      // Custody does NOT end at done: the key is retained for the late watch (a
      // straggler leg could still land on the address), exactly as a swept
      // job's is. The sweeping job's key is likewise retained for the refund.
      expect(loadJobKey("happy-job", WRAP_KEY, jobsDir)).not.toBeNull();
      expect(loadJobKey("fails-job", WRAP_KEY, jobsDir)).not.toBeNull();

      // A tick past the late window (LATE_WATCH_DAYS = 7 -> 604_800_000 ms
      // after the quote expiry), with the address now affirmatively empty,
      // reaps the done job's key: custody finally, fully ends.
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
        nowMs: 10_000 + 604_800_000 + 1,
      });

      expect(loadJobKey("happy-job", WRAP_KEY, jobsDir)).toBeNull();
      expect(store.jobs.get("happy-job").state).toBe("done"); // still terminal — the reap changes no state
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("routes a £2-era job's float leg to the float pool address alongside the inscription", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-float-"));
    try {
      const revenueAddress = PrivateKey.fromRandom().toAddress();
      const floatPoolAddress = PrivateKey.fromRandom().toAddress();
      const fundingTxid = "55".repeat(32);
      const fundingHex = fundingTxHex(standardP2pkhUnlock(PrivateKey.fromRandom()));
      const archive = { v: 1, source: "x", handle: "flora", profile: {}, posts: [{ id: "1", at: "2020-01-01", text: "hi" }] };

      expect(createJobKey("float-job", WRAP_KEY, jobsDir)).not.toBeNull();
      const store = makeStore(
        [
          {
            jobId: "float-job",
            handle: "flora",
            state: "funded",
            feeSats: 1_000,
            premiumSats: 0,
            priceSats: 19_000,
            expiresAtMs: 10_000,
            fundingTxid,
            fundingVout: 0,
            fundingSats: 1_000_000,
          },
        ],
        { "float-job": archive },
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
        floatPoolAddress,
        feeRate: 100,
        registerBaseUrl: "https://www.henceforth.club",
        nowMs: 2_000,
      });

      expect(store.jobs.get("float-job").state).toBe("done");

      // The broadcast bytes themselves carry the float leg: exactly 18,000
      // satoshis (price minus fee minus premium) locked to the pool address.
      const arcCall = fetchFn.mock.calls.find(([url]) => url.includes("arc.gorillapool.io"));
      expect(arcCall).toBeDefined();
      const tx = Transaction.fromHex(arcCall[1].body);
      const poolScript = new P2PKH().lock(floatPoolAddress).toHex();
      const poolOutputs = tx.outputs.filter((o) => o.lockingScript.toHex() === poolScript);
      expect(poolOutputs).toHaveLength(1);
      expect(poolOutputs[0].satoshis).toBe(18_000);
      // No premium output — the £2 is not revenue.
      const revenueScript = new P2PKH().lock(revenueAddress).toHex();
      expect(tx.outputs.some((o) => o.lockingScript.toHex() === revenueScript)).toBe(false);
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("a float leg with no float pool configured refuses to inscribe and routes to the refund path", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-nopool-"));
    try {
      const fundingTxid = "66".repeat(32);
      const fundingHex = fundingTxHex(standardP2pkhUnlock(PrivateKey.fromRandom()));
      const archive = { v: 1, source: "x", handle: "flora", profile: {}, posts: [{ id: "1", at: "2020-01-01", text: "hi" }] };

      const store = makeStore(
        [
          {
            jobId: "no-pool-job",
            handle: "flora",
            state: "funded",
            feeSats: 1_000,
            premiumSats: 0,
            priceSats: 19_000,
            expiresAtMs: 10_000,
            fundingTxid,
            fundingVout: 0,
            fundingSats: 1_000_000,
          },
        ],
        { "no-pool-job": archive },
      );
      const fetchFn = stubFetch({ fundingTxid, fundingHex, utxoValue: 1_000_000 });

      await runWorkerTick({
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
      });

      const job = store.jobs.get("no-pool-job");
      expect(job.state).toBe("sweeping");
      expect(job.failureReason).toBe("float-pool-unconfigured");
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

// Shared deps for a single tick over a store, fetch, and jobs directory.
function sweepDeps(store, fetchFn, jobsDir, nowMs) {
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

describe("runWorkerTick — the sweep (every failure path ends with the visitor's money back)", () => {
  it("retries a rejected broadcast, replays the same deterministic txid, and reaches swept with the key intact throughout", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-sweep-"));
    try {
      const jobId = "sweep-retry-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const jobKey = loadJobKey(jobId, WRAP_KEY, jobsDir);
      const jobAddress = created.address;

      const payerKey = PrivateKey.fromRandom();
      const fundingTxid = "55".repeat(32);
      const fundingHex = fundingTxHex(standardP2pkhUnlock(payerKey));
      const refundAddress = payerKey.toPublicKey().toAddress();
      const fundingSats = 1_000_000;

      // The deterministic sweep the worker must build and replay — same key,
      // same single unspent leg, same refund address, same fee rate.
      const expected = await buildSweepTx({
        jobKey,
        fundings: [{ txid: fundingTxid, vout: 0, sats: fundingSats }],
        refundAddress,
        feeRate: 100,
      });

      const store = makeStore(
        [
          {
            jobId,
            handle: "nemo",
            state: "sweeping",
            address: jobAddress,
            fundingTxid,
            fundingVout: 0,
            fundingSats,
            premiumSats: 10_000,
            priceSats: 11_000,
            expiresAtMs: 10_000,
            failureReason: "underfunded",
          },
        ],
        {},
      );

      let arcAccepts = false;
      let broadcastDone = false;
      let confirmed = false;
      const fetchFn = vi.fn(async (url, opts) => {
        if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
          if (!arcAccepts) {
            return { ok: true, status: 200, json: async () => ({ txid: "", txStatus: "REJECTED", extraInfo: "miner said no", status: 462 }) };
          }
          broadcastDone = true; // the sweep is now in the mempool — the leg is spent
          const txid = Transaction.fromHex(opts.body).id("hex");
          return { ok: true, status: 200, json: async () => ({ txid, txStatus: "SEEN_ON_NETWORK", status: 200 }) };
        }
        if (url.includes("/tx/hash/")) {
          return { ok: true, json: async () => ({ confirmations: confirmed ? 1 : 0 }) };
        }
        if (url.includes(`/tx/${fundingTxid}/hex`)) return { ok: true, text: async () => fundingHex };
        if (url.includes(`${jobAddress}/unspent`)) {
          return { ok: true, json: async () => (broadcastDone ? [] : [{ tx_hash: fundingTxid, tx_pos: 0, value: fundingSats }]) };
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

      // Tick 1 & 2 — broadcast rejected: the job stays sweeping, no txid recorded,
      // and the custody key survives to try again.
      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 2_000));
      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 2_000));
      expect(store.jobs.get(jobId).state).toBe("sweeping");
      expect(store.jobs.get(jobId).sweepTxid).toBeUndefined();
      expect(loadJobKey(jobId, WRAP_KEY, jobsDir)).not.toBeNull();

      // Tick 3 — broadcast accepted: the sweep-broadcast records the deterministic
      // txid, still sweeping (awaiting confirmation).
      arcAccepts = true;
      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 2_000));
      expect(store.jobs.get(jobId).state).toBe("sweeping");
      expect(store.jobs.get(jobId).sweepTxid).toBe(expected.txid);

      // Tick 4 — first confirmation: sweep-confirmed advances to swept. The key is
      // NOT deleted at swept — it outlives the transition for the late watch.
      confirmed = true;
      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 2_000));
      expect(store.jobs.get(jobId).state).toBe("swept");
      expect(loadJobKey(jobId, WRAP_KEY, jobsDir)).not.toBeNull();
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("prefers the recorded payerRefundAddress — no raw-transaction fetch inside the refund path", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-recorded-refund-"));
    try {
      const jobId = "recorded-refund-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const jobAddress = created.address;
      const payerRefundAddress = PrivateKey.fromRandom().toAddress();
      const fundingTxid = "88".repeat(32);

      const store = makeStore(
        [
          {
            jobId,
            handle: "x",
            state: "sweeping",
            address: jobAddress,
            fundingTxid,
            fundingVout: 0,
            fundingSats: 1_000_000,
            payerRefundAddress,
            premiumSats: 10_000,
            priceSats: 11_000,
            expiresAtMs: 10_000,
            failureReason: "underfunded",
          },
        ],
        {},
      );

      let capturedBody = null;
      const fetchFn = vi.fn(async (url, opts) => {
        if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
          capturedBody = opts.body;
          const txid = Transaction.fromHex(opts.body).id("hex");
          return { ok: true, status: 200, json: async () => ({ txid, txStatus: "SEEN_ON_NETWORK", status: 200 }) };
        }
        if (url.includes(`${jobAddress}/unspent`)) {
          return { ok: true, json: async () => [{ tx_hash: fundingTxid, tx_pos: 0, value: 1_000_000 }] };
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 2_000));

      // The sweep went out to the RECORDED refund address, and the raw funding
      // transaction was never fetched — the answer was already on the job.
      expect(capturedBody).not.toBeNull();
      const tx = Transaction.fromHex(capturedBody);
      expect(tx.outputs).toHaveLength(1);
      expect(tx.outputs[0].lockingScript.toHex()).toBe(new P2PKH().lock(payerRefundAddress).toHex());
      expect(fetchFn).not.toHaveBeenCalledWith(expect.stringContaining("/hex"));
      expect(store.jobs.get(jobId).sweepTxid).toBe(tx.id("hex"));
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("stays sweeping and warns exactly once when the funding input resolves to no refund address", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-refundless-"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const jobId = "refundless-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const jobAddress = created.address;
      const fundingTxid = "77".repeat(32);
      // A bare-multisig-shaped unlock — three pushes, not the two a P2PKH spend
      // has — so refundAddressOf returns null: never a guessed address.
      const nonStandardHex = fundingTxHex(
        new Script().writeBin([]).writeBin(Array(71).fill(0x30)).writeBin(Array(71).fill(0x30)),
      );

      const store = makeStore(
        [
          {
            jobId,
            handle: "x",
            state: "sweeping",
            address: jobAddress,
            fundingTxid,
            fundingVout: 0,
            fundingSats: 1_000_000,
            premiumSats: 1,
            priceSats: 1,
            expiresAtMs: 10_000,
            failureReason: "underfunded",
          },
        ],
        {},
      );

      const fetchFn = vi.fn(async (url) => {
        if (url.includes(`${jobAddress}/unspent`)) return { ok: true, json: async () => [{ tx_hash: fundingTxid, tx_pos: 0, value: 1_000_000 }] };
        if (url.includes(`/tx/${fundingTxid}/hex`)) return { ok: true, text: async () => nonStandardHex };
        throw new Error(`unexpected fetch: ${url}`);
      });

      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 2_000));
      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 2_000)); // a second tick must not re-warn

      expect(store.jobs.get(jobId).state).toBe("sweeping");
      expect(store.jobs.get(jobId).sweepTxid).toBeUndefined();
      const jobWarns = warnSpy.mock.calls.filter((c) => String(c[0]).includes(jobId));
      expect(jobWarns).toHaveLength(1);
    } finally {
      warnSpy.mockRestore();
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });
});

describe("runWorkerTick — the late watch and the reaper (keys outlive swept, but only for the refund window)", () => {
  it("sweeps a straggler payment on a swept job back to its own sender with the retained key, staying swept", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-late-"));
    try {
      const jobId = "late-straggler-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const jobAddress = created.address;

      const payerKey = PrivateKey.fromRandom();
      const stragglerTxid = "66".repeat(32);
      const stragglerHex = fundingTxHex(standardP2pkhUnlock(payerKey));
      const stragglerRefund = payerKey.toPublicKey().toAddress();

      const store = makeStore(
        [{ jobId, handle: "x", state: "swept", address: jobAddress, expiresAtMs: 5_000, premiumSats: 1, priceSats: 1 }],
        {},
      );

      let capturedBody = null;
      const fetchFn = vi.fn(async (url, opts) => {
        if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
          capturedBody = opts.body;
          const txid = Transaction.fromHex(opts.body).id("hex");
          return { ok: true, status: 200, json: async () => ({ txid, txStatus: "SEEN_ON_NETWORK", status: 200 }) };
        }
        if (url.includes(`${jobAddress}/unspent`)) return { ok: true, json: async () => [{ tx_hash: stragglerTxid, tx_pos: 0, value: 800_000 }] };
        if (url.includes(`/tx/${stragglerTxid}/hex`)) return { ok: true, text: async () => stragglerHex };
        throw new Error(`unexpected fetch: ${url}`);
      });

      // nowMs is inside the late window (a little past the 5_000 expiry).
      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 6_000));

      expect(store.jobs.get(jobId).state).toBe("swept"); // no state-machine event — swept stays swept
      expect(loadJobKey(jobId, WRAP_KEY, jobsDir)).not.toBeNull(); // key retained, still inside the window
      expect(capturedBody).not.toBeNull();

      const tx = Transaction.fromHex(capturedBody);
      expect(tx.inputs[0].sourceTXID).toBe(stragglerTxid); // spends the straggler
      expect(tx.outputs).toHaveLength(1);
      expect(tx.outputs[0].lockingScript.toHex()).toBe(new P2PKH().lock(stragglerRefund).toHex()); // back to its own sender
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("late-watches a done job's address too — a straggler sweeps back to its own sender with the retained key, staying done", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-done-late-"));
    try {
      const jobId = "done-straggler-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const jobAddress = created.address;

      const payerKey = PrivateKey.fromRandom();
      const stragglerTxid = "99".repeat(32);
      const stragglerHex = fundingTxHex(standardP2pkhUnlock(payerKey));
      const stragglerRefund = payerKey.toPublicKey().toAddress();

      const store = makeStore(
        [{ jobId, handle: "x", state: "done", address: jobAddress, expiresAtMs: 5_000, premiumSats: 1, priceSats: 1 }],
        {},
      );

      let capturedBody = null;
      const fetchFn = vi.fn(async (url, opts) => {
        if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
          capturedBody = opts.body;
          const txid = Transaction.fromHex(opts.body).id("hex");
          return { ok: true, status: 200, json: async () => ({ txid, txStatus: "SEEN_ON_NETWORK", status: 200 }) };
        }
        if (url.includes(`${jobAddress}/unspent`)) return { ok: true, json: async () => [{ tx_hash: stragglerTxid, tx_pos: 0, value: 800_000 }] };
        if (url.includes(`/tx/${stragglerTxid}/hex`)) return { ok: true, text: async () => stragglerHex };
        throw new Error(`unexpected fetch: ${url}`);
      });

      // nowMs is inside the late window (a little past the 5_000 expiry).
      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 6_000));

      expect(store.jobs.get(jobId).state).toBe("done"); // no state-machine event — done stays done
      expect(loadJobKey(jobId, WRAP_KEY, jobsDir)).not.toBeNull(); // key retained, still inside the window
      expect(capturedBody).not.toBeNull();

      const tx = Transaction.fromHex(capturedBody);
      expect(tx.inputs[0].sourceTXID).toBe(stragglerTxid); // spends the straggler
      expect(tx.outputs).toHaveLength(1);
      expect(tx.outputs[0].lockingScript.toHex()).toBe(new P2PKH().lock(stragglerRefund).toHex()); // back to its own sender
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("reaps a done job's key once the late window closes, on an affirmatively empty read", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-done-reap-"));
    try {
      const jobId = "done-reap-job";
      const created = createJobKey(jobId, WRAP_KEY, jobsDir);
      const store = makeStore(
        [{ jobId, handle: "x", state: "done", address: created.address, expiresAtMs: 1_000, premiumSats: 1, priceSats: 1 }],
        {},
      );
      const fetchFn = vi.fn(async (url) => {
        if (url.includes("/unspent")) return { ok: true, json: async () => [] };
        throw new Error(`unexpected fetch: ${url}`);
      });

      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, 604_800_000 + 2_000));

      expect(loadJobKey(jobId, WRAP_KEY, jobsDir)).toBeNull(); // window closed + empty read → reaped
      expect(store.jobs.get(jobId).state).toBe("done"); // still terminal
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("the reaper deletes a swept job's key only after the late window closes, not before", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-reaper-"));
    try {
      const withinId = "reaper-within";
      const pastId = "reaper-past";
      const withinCreated = createJobKey(withinId, WRAP_KEY, jobsDir);
      const pastCreated = createJobKey(pastId, WRAP_KEY, jobsDir);

      const store = makeStore(
        [
          { jobId: withinId, handle: "x", state: "swept", address: withinCreated.address, expiresAtMs: 1_000_000, premiumSats: 1, priceSats: 1 },
          { jobId: pastId, handle: "x", state: "swept", address: pastCreated.address, expiresAtMs: 1_000, premiumSats: 1, priceSats: 1 },
        ],
        {},
      );

      const fetchFn = vi.fn(async (url) => {
        if (url.includes("/unspent")) return { ok: true, json: async () => [] };
        throw new Error(`unexpected fetch: ${url}`);
      });

      // LATE_WATCH_DAYS = 7 -> 604_800_000 ms. nowMs is just past the window for
      // the pastId job (expiry 1_000) but still inside it for the withinId job
      // (expiry 1_000_000).
      const nowMs = 604_800_000 + 2_000;
      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, nowMs));

      expect(loadJobKey(withinId, WRAP_KEY, jobsDir)).not.toBeNull(); // inside the window — key survives
      expect(loadJobKey(pastId, WRAP_KEY, jobsDir)).toBeNull(); // window closed — key reaped
      expect(store.jobs.get(withinId).state).toBe("swept");
      expect(store.jobs.get(pastId).state).toBe("swept");
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("the reaper deletes only after an affirmatively empty read — a failed unspent read postpones the reap and keeps the key", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-reaper-read-"));
    try {
      const failId = "reaper-read-fails";
      const emptyId = "reaper-read-empty";
      const failCreated = createJobKey(failId, WRAP_KEY, jobsDir);
      const emptyCreated = createJobKey(emptyId, WRAP_KEY, jobsDir);

      const store = makeStore(
        [
          { jobId: failId, handle: "x", state: "swept", address: failCreated.address, expiresAtMs: 1_000, premiumSats: 1, priceSats: 1 },
          { jobId: emptyId, handle: "x", state: "swept", address: emptyCreated.address, expiresAtMs: 1_000, premiumSats: 1, priceSats: 1 },
        ],
        {},
      );

      // A read returns [] for BOTH a genuine empty address and a failed poll;
      // the reaper must never confuse the two, since deleting a key over funds
      // it merely failed to see would strand them. Only an affirmatively empty
      // read may delete a fund-linked key.
      const fetchFn = vi.fn(async (url) => {
        if (url.includes(`${failCreated.address}/unspent`)) return { ok: false, status: 502 }; // a failed read
        if (url.includes(`${emptyCreated.address}/unspent`)) return { ok: true, json: async () => [] }; // affirmatively empty
        throw new Error(`unexpected fetch: ${url}`);
      });

      const nowMs = 604_800_000 + 2_000; // both past the window
      await runWorkerTick(sweepDeps(store, fetchFn, jobsDir, nowMs));

      expect(loadJobKey(failId, WRAP_KEY, jobsDir)).not.toBeNull(); // failed read → key retained, retry next tick
      expect(loadJobKey(emptyId, WRAP_KEY, jobsDir)).toBeNull(); // ok-and-empty → reaped
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });
});
