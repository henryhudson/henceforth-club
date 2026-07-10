import { describe, expect, it, vi } from "vitest";
import { PrivateKey, Script, Transaction } from "@bsv/sdk";
import { matchPayment, readUnspentOutputs, refundAddressOf, runWatchTick } from "./payments.mjs";

// A funding transaction's first input, built directly with the SDK rather
// than a hand-typed hex blob — real opcodes, real pushdata framing, a real
// (if arbitrary) previous outpoint. The signature bytes are placeholder —
// refundAddressOf only parses script shape, it never verifies a signature.
function fundingTxHex(unlockingScript) {
  const tx = new Transaction(
    1,
    [
      {
        sourceTXID: "11".repeat(32),
        sourceOutputIndex: 0,
        unlockingScript,
        sequence: 0xffffffff,
      },
    ],
    [{ satoshis: 1000, lockingScript: Script.fromASM("OP_TRUE") }],
    0,
  );
  return tx.toHex();
}

const standardP2pkhUnlock = (key) =>
  new Script().writeBin(Array(71).fill(0x30)).writeBin(key.toPublicKey().toDER());

describe("matchPayment", () => {
  it("an output exactly at the price funds", () => {
    const utxos = [{ txid: "a", vout: 0, sats: 500 }];
    expect(matchPayment(utxos, 500)).toEqual({
      kind: "funded",
      funding: { txid: "a", vout: 0, sats: 500 },
    });
  });

  it("an output over the price funds", () => {
    const utxos = [{ txid: "a", vout: 0, sats: 900 }];
    expect(matchPayment(utxos, 500)).toEqual({
      kind: "funded",
      funding: { txid: "a", vout: 0, sats: 900 },
    });
  });

  it("a single leg one satoshi under the price is short, not funded", () => {
    const utxos = [{ txid: "a", vout: 0, sats: 499 }];
    expect(matchPayment(utxos, 500)).toEqual({ kind: "short", totalSats: 499 });
  });

  it("several small legs summing past the price are still short — one input only", () => {
    const utxos = [
      { txid: "a", vout: 0, sats: 300 },
      { txid: "b", vout: 1, sats: 300 },
    ];
    expect(matchPayment(utxos, 500)).toEqual({ kind: "short", totalSats: 600 });
  });

  it("no unspent outputs at all is none", () => {
    expect(matchPayment([], 500)).toEqual({ kind: "none" });
  });

  it("picks the largest qualifying output, not just the largest overall", () => {
    const utxos = [
      { txid: "small", vout: 0, sats: 100 },
      { txid: "big", vout: 1, sats: 700 },
    ];
    expect(matchPayment(utxos, 500)).toEqual({
      kind: "funded",
      funding: { txid: "big", vout: 1, sats: 700 },
    });
  });
});

describe("refundAddressOf", () => {
  it("a standard peer-to-peer-key-hash unlocking script resolves to its signer's address", () => {
    const key = PrivateKey.fromRandom();
    const hex = fundingTxHex(standardP2pkhUnlock(key));
    expect(refundAddressOf(hex)).toBe(key.toPublicKey().toAddress());
  });

  it("a non-standard (multisig-shaped) unlocking script returns null, not a guess", () => {
    // OP_0 <sig1> <sig2> — the classic bare-multisig unlock shape: three
    // pushes, not the two a peer-to-peer-key-hash spend always has.
    const unlockingScript = new Script()
      .writeBin([])
      .writeBin(Array(71).fill(0x30))
      .writeBin(Array(71).fill(0x30));
    const hex = fundingTxHex(unlockingScript);
    expect(refundAddressOf(hex)).toBeNull();
  });

  it("a transaction with no inputs returns null", () => {
    const tx = new Transaction(1, [], [{ satoshis: 1000, lockingScript: Script.fromASM("OP_TRUE") }], 0);
    expect(refundAddressOf(tx.toHex())).toBeNull();
  });

  it("malformed hex returns null rather than throwing", () => {
    expect(refundAddressOf("not-a-transaction")).toBeNull();
  });

  it("a public-key push that isn't a valid public key returns null", () => {
    const unlockingScript = new Script().writeBin(Array(71).fill(0x30)).writeBin(Array(33).fill(0xff));
    const hex = fundingTxHex(unlockingScript);
    expect(refundAddressOf(hex)).toBeNull();
  });

  it("a 65-byte uncompressed-key push returns null — never the compressed re-encoding's address", () => {
    // The sdk parses a 65-byte 0x04-prefixed key happily, but toAddress()
    // always re-encodes compressed — a DIFFERENT address from the one an
    // uncompressed-key wallet watches. Refunding there would strand the
    // money; null keeps the never-guess contract and the job becomes the
    // flagged ops case instead.
    const key = PrivateKey.fromRandom();
    const uncompressed = key.toPublicKey().encode(false); // 65 bytes, 0x04 prefix
    const unlockingScript = new Script().writeBin(Array(71).fill(0x30)).writeBin(uncompressed);
    const hex = fundingTxHex(unlockingScript);
    expect(refundAddressOf(hex)).toBeNull();
  });
});

describe("readUnspentOutputs (distinguishes an affirmatively empty read from a failed one)", () => {
  it("a good 200 with an empty array is ok-and-empty", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => [] }));
    expect(await readUnspentOutputs("1Addr", fetchFn)).toEqual({ ok: true, utxos: [] });
  });

  it("a good 200 with outputs maps them to the matchPayment shape", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => [{ tx_hash: "a", tx_pos: 1, value: 500 }] }));
    expect(await readUnspentOutputs("1Addr", fetchFn)).toEqual({ ok: true, utxos: [{ txid: "a", vout: 1, sats: 500 }] });
  });

  it("a non-200 response is a failed read, not an empty one", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 502 }));
    expect(await readUnspentOutputs("1Addr", fetchFn)).toEqual({ ok: false });
  });

  it("a network throw is a failed read", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await readUnspentOutputs("1Addr", fetchFn)).toEqual({ ok: false });
  });

  it("an unexpected (non-array) body is a failed read", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ nope: true }) }));
    expect(await readUnspentOutputs("1Addr", fetchFn)).toEqual({ ok: false });
  });
});

// The loop is thin glue over the pure parts above: one unspent-outputs
// request per awaiting-payment job per tick, sequential; quoted jobs past
// expiry cost no network call at all. This one tick exercises all of it —
// a fund, an expiry with residue, a quoted expiry with no address, and a
// job that's neither yet (a no-op) — with a stubbed fetch and a fake store.
describe("runWatchTick", () => {
  const fundedKey = PrivateKey.fromRandom();
  const fundingTxid = "22".repeat(32);
  const fundingHex = fundingTxHex(standardP2pkhUnlock(fundedKey));

  function stubFetch() {
    return vi.fn(async (url) => {
      if (url.includes("job-a-address/unspent")) {
        return { ok: true, json: async () => [{ tx_hash: fundingTxid, tx_pos: 0, value: 1000 }] };
      }
      if (url.includes("job-b-address/unspent")) {
        return { ok: true, json: async () => [{ tx_hash: "aa".repeat(32), tx_pos: 0, value: 100 }] };
      }
      if (url.includes("job-c-address/unspent")) {
        return { ok: true, json: async () => [] };
      }
      if (url.includes(`tx/${fundingTxid}/hex`)) {
        return { ok: true, text: async () => fundingHex };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  function fakeStore() {
    const jobs = {
      quoted: [{ jobId: "job-q", state: "quoted", expiresAtMs: 1000, priceSats: 500 }],
      "awaiting-payment": [
        { jobId: "job-a", state: "awaiting-payment", address: "job-a-address", priceSats: 1000, expiresAtMs: 5000 },
        { jobId: "job-b", state: "awaiting-payment", address: "job-b-address", priceSats: 1000, expiresAtMs: 1000 },
        { jobId: "job-c", state: "awaiting-payment", address: "job-c-address", priceSats: 1000, expiresAtMs: 5000 },
      ],
    };
    const advance = vi.fn(async (jobId, event) => ({ ok: true, job: { jobId, ...event } }));
    const listJobsInState = vi.fn(async (state) => jobs[state] ?? []);
    return { listJobsInState, advance };
  }

  it("funds the paid job, expires the timed-out one and the quoted one, and leaves the rest waiting", async () => {
    const fetchFn = stubFetch();
    const { listJobsInState, advance } = fakeStore();

    await runWatchTick({ listJobsInState, advance, fetchFn, nowMs: 2000 });

    expect(advance).toHaveBeenCalledWith("job-q", { kind: "expired", residueSats: 0 }, 2000);
    expect(advance).toHaveBeenCalledWith(
      "job-a",
      {
        kind: "payment-seen",
        txid: fundingTxid,
        vout: 0,
        sats: 1000,
        refundAddress: fundedKey.toPublicKey().toAddress(),
      },
      2000,
    );
    expect(advance).toHaveBeenCalledWith("job-b", { kind: "expired", residueSats: 100 }, 2000);
    expect(advance).toHaveBeenCalledTimes(3); // job-c is neither funded nor expired — no call at all

    // Quoted jobs past expiry never touch the network — they have no address.
    expect(fetchFn).not.toHaveBeenCalledWith(expect.stringContaining("job-q"));
  });

  it("retries once on a version-conflict from advance, then succeeds", async () => {
    const fetchFn = stubFetch();
    const listJobsInState = vi.fn(async (state) =>
      state === "awaiting-payment"
        ? [{ jobId: "job-a", state: "awaiting-payment", address: "job-a-address", priceSats: 1000, expiresAtMs: 5000 }]
        : [],
    );
    const advance = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, refused: "version-conflict" })
      .mockResolvedValueOnce({ ok: true, job: {} });

    await runWatchTick({ listJobsInState, advance, fetchFn, nowMs: 2000 });

    expect(advance).toHaveBeenCalledTimes(2);
  });

  it("a terminal refusal from advance is a benign no-op, not a retry or a throw", async () => {
    const fetchFn = stubFetch();
    const listJobsInState = vi.fn(async (state) =>
      state === "awaiting-payment"
        ? [{ jobId: "job-a", state: "awaiting-payment", address: "job-a-address", priceSats: 1000, expiresAtMs: 5000 }]
        : [],
    );
    const advance = vi.fn().mockResolvedValue({ ok: false, refused: "job-already-swept" });

    await expect(runWatchTick({ listJobsInState, advance, fetchFn, nowMs: 2000 })).resolves.toBeUndefined();
    expect(advance).toHaveBeenCalledTimes(1); // not "job-already-swept" retried
  });
});
