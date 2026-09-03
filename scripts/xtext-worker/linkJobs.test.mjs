// The worker's folklore branch: a paid link or comment job rides the exact
// rails an archive does — same key custody, same broadcast, same sweep — and
// differs only in what the OP_RETURN carries (A1's encodeRecord bytes) and
// where the result lands (the board index instead of handle registration).
// The fakes here drive the REAL state machine and the REAL record codec; only
// the store, the network, and the index writers are stubbed.

import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { P2PKH, PrivateKey, Transaction } from "@bsv/sdk";
import { applyEvent } from "@/lib/folkloreJob/jobs";
import { encodeRecord, recordFromScripts, recordFromValue } from "@/app/folklore/linkRecord";
import { createJobKey } from "./keystore.mjs";
import { runWorkerTick } from "./worker.mjs";

const WRAP_KEY = Buffer.from("11".repeat(32), "hex");

const LINK_RECORD = {
  v: 1,
  app: "folklore",
  kind: "link",
  url: "https://example.com/a",
  title: "A title",
  by: "henry",
};
const PARENT_TXID = "ab".repeat(32);
const COMMENT_RECORD = { v: 1, app: "folklore", kind: "comment", parent: PARENT_TXID, text: "well said" };

// A faithful fake store driving the real transition table, as worker.test.mjs does.
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

function fundedJob(jobId, overrides = {}) {
  return {
    jobId,
    handle: "",
    state: "funded",
    feeSats: 41,
    premiumSats: 929_046,
    priceSats: 929_087,
    expiresAtMs: 10_000,
    fundingTxid: "44".repeat(32),
    fundingVout: 0,
    fundingSats: 1_000_000,
    ...overrides,
  };
}

// ARC accepts and echoes the deterministic txid; the custody address reads
// empty once the inscription spends its leg (so the done-job late watch sees
// nothing). `arcBodies` collects the exact broadcast bytes.
function stubFetch({ arcBodies = [], addressEmpty = false } = {}) {
  let inscribed = addressEmpty;
  return vi.fn(async (url, opts) => {
    if (url.includes("/api/x/register")) return { ok: true, status: 200, json: async () => ({ ok: true }) };
    if (url.includes("arc.gorillapool.io") || url.includes("arc.taal.com")) {
      inscribed = true;
      arcBodies.push(opts.body);
      const txid = Transaction.fromHex(opts.body).id("hex");
      return { ok: true, status: 200, json: async () => ({ txid, txStatus: "SEEN_ON_NETWORK", status: 200 }) };
    }
    if (url.includes("/unspent")) {
      return { ok: true, json: async () => (inscribed ? [] : [{ tx_hash: "44".repeat(32), tx_pos: 0, value: 1_000_000 }]) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function makeFolklore(overrides = {}) {
  return {
    recordFromValue,
    encodeRecord,
    addLinkToBoard: vi.fn(async () => "listed"),
    addCommentToIndex: vi.fn(async () => true),
    ...overrides,
  };
}

function deps(store, fetchFn, jobsDir, folklore, nowMs = 2_000) {
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
    folklore,
    nowMs,
  };
}

describe("runWorkerTick — link jobs on the existing rails", () => {
  it("inscribes A1's exact record bytes, pays the floor to revenue, and lands the link on the board — never the register route", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-link-"));
    try {
      expect(createJobKey("link-job", WRAP_KEY, jobsDir)).not.toBeNull();
      const store = makeStore([fundedJob("link-job")], { "link-job": LINK_RECORD });
      const arcBodies = [];
      const fetchFn = stubFetch({ arcBodies });
      const folklore = makeFolklore();
      const d = deps(store, fetchFn, jobsDir, folklore);

      await runWorkerTick(d);

      expect(store.jobs.get("link-job").state).toBe("done");
      expect(arcBodies).toHaveLength(1);

      // The OP_RETURN round-trips through A1's own parser: the chain carries
      // exactly the record the visitor validated and paid for.
      const tx = Transaction.fromHex(arcBodies[0]);
      const scriptHexes = tx.outputs.map((o) => o.lockingScript.toHex());
      expect(recordFromScripts(scriptHexes)).toEqual(LINK_RECORD);

      // The ten-pence floor rides premiumSats to the revenue address.
      const revenueScript = new P2PKH().lock(d.revenueAddress).toHex();
      const revenueOutputs = tx.outputs.filter((o) => o.lockingScript.toHex() === revenueScript);
      expect(revenueOutputs).toHaveLength(1);
      expect(revenueOutputs[0].satoshis).toBe(929_046);

      // The board learned of the txid at the worker's clock; the handle
      // registration path was never touched.
      expect(folklore.addLinkToBoard).toHaveBeenCalledWith(tx.id("hex"), LINK_RECORD, 2_000);
      expect(folklore.addCommentToIndex).not.toHaveBeenCalled();
      expect(fetchFn).not.toHaveBeenCalledWith(expect.stringContaining("/api/x/register"), expect.anything());
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("a comment job feeds its parent's thread through addCommentToIndex", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-comment-"));
    try {
      expect(createJobKey("comment-job", WRAP_KEY, jobsDir)).not.toBeNull();
      const store = makeStore([fundedJob("comment-job")], { "comment-job": COMMENT_RECORD });
      const arcBodies = [];
      const folklore = makeFolklore();

      await runWorkerTick(deps(store, stubFetch({ arcBodies }), jobsDir, folklore));

      expect(store.jobs.get("comment-job").state).toBe("done");
      const txid = Transaction.fromHex(arcBodies[0]).id("hex");
      expect(folklore.addCommentToIndex).toHaveBeenCalledWith(PARENT_TXID, txid, 2_000);
      expect(folklore.addLinkToBoard).not.toHaveBeenCalled();
      expect(recordFromScripts(Transaction.fromHex(arcBodies[0]).outputs.map((o) => o.lockingScript.toHex()))).toEqual(
        COMMENT_RECORD,
      );
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("a failed index write after a successful broadcast is loud, leaves the job inscribed, and retries next tick", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-index-retry-"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(createJobKey("retry-job", WRAP_KEY, jobsDir)).not.toBeNull();
      const store = makeStore([fundedJob("retry-job")], { "retry-job": LINK_RECORD });
      const arcBodies = [];
      const fetchFn = stubFetch({ arcBodies });
      const folklore = makeFolklore({ addLinkToBoard: vi.fn(async () => "unavailable") });
      const d = deps(store, fetchFn, jobsDir, folklore);

      await runWorkerTick(d);

      // Broadcast succeeded, the index write did not: the job stays inscribed
      // — never done, never silently dropped — and the miss is loud.
      expect(store.jobs.get("retry-job").state).toBe("inscribed");
      expect(arcBodies).toHaveLength(1);
      const txid = Transaction.fromHex(arcBodies[0]).id("hex");
      const loud = errorSpy.mock.calls.filter((c) => String(c[0]).includes("retry-job") && String(c[0]).includes(txid));
      expect(loud.length).toBeGreaterThan(0);

      // Next tick the index is back: the write retries (idempotent by
      // construction) and the job completes. No second broadcast.
      folklore.addLinkToBoard.mockImplementation(async () => "listed");
      await runWorkerTick(d);
      expect(store.jobs.get("retry-job").state).toBe("done");
      expect(folklore.addLinkToBoard).toHaveBeenCalledTimes(2);
      expect(arcBodies).toHaveLength(1);
    } finally {
      errorSpy.mockRestore();
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("an inscribed folklore job whose payload has gone is flagged and retried — never registered as an archive", async () => {
    // The misroute this closes: a null payload is not folklore-tagged, so the
    // old sniff sent the job to registerHandle carrying the empty handle every
    // link job has. That 400s, so the job retried forever in the ACTIVE
    // `inscribed` state and held one of the four custody slots for good.
    // `kind` is on the job record, which the payload's deletion cannot touch.
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-nullpayload-"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const store = makeStore(
        [
          {
            ...fundedJob("orphan-job"),
            kind: "folklore",
            state: "inscribed",
            inscriptionTxid: "cd".repeat(32),
          },
        ],
        {}, // no payload at all
      );
      const registerCalls = [];
      const fetchFn = vi.fn(async (url) => {
        if (url.includes("/api/x/register")) {
          registerCalls.push(url);
          return { ok: false, status: 400, json: async () => ({ ok: false }) };
        }
        if (url.includes("/unspent")) return { ok: true, json: async () => [] };
        throw new Error(`unexpected fetch: ${url}`);
      });
      const folklore = makeFolklore();

      await runWorkerTick(deps(store, fetchFn, jobsDir, folklore));

      // It stays inscribed to retry, it is loud, and it never touches the
      // handle registry or the board index.
      expect(store.jobs.get("orphan-job").state).toBe("inscribed");
      expect(registerCalls).toHaveLength(0);
      expect(folklore.addLinkToBoard).not.toHaveBeenCalled();
      expect(warnSpy.mock.calls.filter((c) => String(c[0]).includes("orphan-job")).length).toBeGreaterThan(0);
    } finally {
      warnSpy.mockRestore();
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("a corrupt folklore-tagged payload refuses BEFORE broadcast and routes to the refund path", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-corrupt-"));
    try {
      expect(createJobKey("corrupt-job", WRAP_KEY, jobsDir)).not.toBeNull();
      const hostile = { v: 1, app: "folklore", kind: "link", url: "javascript:alert(1)", title: "x" };
      const store = makeStore([fundedJob("corrupt-job")], { "corrupt-job": hostile });
      const arcBodies = [];
      // The custody address answers empty this tick, so the sweep phase holds
      // and the refusal itself is what this test observes.
      const fetchFn = stubFetch({ arcBodies, addressEmpty: true });

      await runWorkerTick(deps(store, fetchFn, jobsDir, makeFolklore()));

      const job = store.jobs.get("corrupt-job");
      expect(job.state).toBe("sweeping");
      expect(job.failureReason).toBe("record-invalid");
      expect(arcBodies).toHaveLength(0); // nothing was ever broadcast
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("a folklore-tagged payload on a worker without the folklore wiring refuses to spend and refunds", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-unwired-"));
    try {
      expect(createJobKey("unwired-job", WRAP_KEY, jobsDir)).not.toBeNull();
      const store = makeStore([fundedJob("unwired-job")], { "unwired-job": LINK_RECORD });
      const arcBodies = [];
      const fetchFn = stubFetch({ arcBodies, addressEmpty: true });

      await runWorkerTick(deps(store, fetchFn, jobsDir, undefined));

      const job = store.jobs.get("unwired-job");
      expect(job.state).toBe("sweeping");
      expect(job.failureReason).toBe("folklore-unwired");
      expect(arcBodies).toHaveLength(0);
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });

  it("an archive job is untouched by the folklore wiring — registered against its handle, never indexed on the board", async () => {
    const jobsDir = mkdtempSync(path.join(tmpdir(), "xtext-worker-archive-"));
    try {
      expect(createJobKey("archive-job", WRAP_KEY, jobsDir)).not.toBeNull();
      const archive = { v: 1, source: "x", handle: "henry", profile: {}, posts: [{ id: "1", at: "2020-01-01", text: "hi" }] };
      // A £1-era decomposition: fee plus premium is the whole price, so the
      // job carries no float leg and needs no pool address.
      const store = makeStore(
        [fundedJob("archive-job", { handle: "henry", feeSats: 1_000, premiumSats: 5_000, priceSats: 6_000 })],
        { "archive-job": archive },
      );
      const arcBodies = [];
      const fetchFn = stubFetch({ arcBodies });
      const folklore = makeFolklore();

      await runWorkerTick(deps(store, fetchFn, jobsDir, folklore));

      expect(store.jobs.get("archive-job").state).toBe("done");
      expect(fetchFn).toHaveBeenCalledWith("https://www.henceforth.club/api/x/register", expect.anything());
      expect(folklore.addLinkToBoard).not.toHaveBeenCalled();
      expect(folklore.addCommentToIndex).not.toHaveBeenCalled();
    } finally {
      rmSync(jobsDir, { recursive: true, force: true });
    }
  });
});
