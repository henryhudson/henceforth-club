import { describe, expect, it } from "vitest";
import { P2PKH, PrivateKey, Transaction } from "@bsv/sdk";
import { INDEXER_BASES, SURFACE, parseHeadPayload, readSurface, resolveHead } from "./chain-archive";
import { BOARD_SURFACE, DONE_SURFACE, GARDENING_SURFACE, reportSurface, weekSurface } from "../../scripts/board/chain-publish-core.mjs";
import { inscribeDocument } from "../../scripts/board/chain-put.mjs";
import { inscribeHead, parseHeadPayload as parseHeadPayloadMjs } from "../../scripts/board/chain-head.mjs";

const KEY_PAIR = PrivateKey.fromString("1".repeat(64), 16);
const WIF = KEY_PAIR.toWif();
const ADDRESS = KEY_PAIR.toAddress();
const SEAL_KEY = "2".repeat(64);
const quiet = () => {};

type Fixture = {
  docTxid: string;
  headTxid: string;
  hexByTxid: Map<string, string>;
  document: Buffer;
};

/** A real document inscription and the head naming it, built through the same
 *  writer production uses, served back through a mocked network. */
async function fixture(headBytesOverride?: Buffer): Promise<Fixture> {
  const document = Buffer.from(JSON.stringify({ generated: "2026-09-01", cards: [] }));
  const doc = await inscribeDocument({
    wif: WIF, keyHex: SEAL_KEY, surface: "board-latest", date: "2026-09-01",
    bytes: document, dryRun: true, log: quiet,
  });
  const docTxid = doc.tx.id("hex") as string;
  const head = headBytesOverride
    ? await inscribeDocument({
        wif: WIF, keyHex: SEAL_KEY, surface: "head", date: "2026-09-01",
        bytes: headBytesOverride, prevTx: doc.tx, dryRun: true, log: quiet,
      })
    : await inscribeHead({
        wif: WIF, keyHex: SEAL_KEY, date: "2026-09-01",
        surfaces: { "board-latest": docTxid }, prevTx: doc.tx, dryRun: true, log: quiet,
      });
  const headTxid = head.tx.id("hex") as string;
  const hexByTxid = new Map([
    [docTxid, doc.tx.toHex() as string],
    [headTxid, head.tx.toHex() as string],
  ]);
  return { docTxid, headTxid, hexByTxid, document };
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const text = (body: string) => new Response(body, { status: 200 });
const refuse = (status: number) => new Response("refused", { status });

/** A fetch that answers history and hex lookups from the fixture, oldest
 *  first in history exactly as the real indexer does. */
function networkFor(f: Fixture, opts: { historyNewestFirstTxids?: string[]; unconfirmed?: string[] } = {}) {
  const newestFirst = opts.historyNewestFirstTxids ?? [f.headTxid, f.docTxid];
  const oldestFirst = [...newestFirst].reverse();
  return (async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/unconfirmed/history")) {
      return opts.unconfirmed ? json(opts.unconfirmed.map((tx_hash) => ({ tx_hash }))) : refuse(404);
    }
    if (u.includes("/history")) return json(oldestFirst.map((tx_hash) => ({ tx_hash })));
    const match = u.match(/\/tx\/([0-9a-f]{64})\/hex/);
    if (match) {
      const hex = f.hexByTxid.get(match[1]);
      return hex ? text(hex) : refuse(404);
    }
    return refuse(404);
  }) as typeof fetch;
}

describe("resolving the head", () => {
  it("finds the newest head and opens its surface map", async () => {
    const f = await fixture();
    const resolved = await resolveHead({ address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: networkFor(f) });
    expect(resolved).toEqual({
      status: "ok",
      headTxid: f.headTxid,
      head: { v: 1, surfaces: { "board-latest": f.docTxid } },
    });
  });

  it("walks past foreign transactions to the newest head", async () => {
    const f = await fixture();
    const foreign = new Transaction();
    foreign.addOutput({ lockingScript: new P2PKH().lock(ADDRESS), satoshis: 1000 });
    const foreignTxid = foreign.id("hex") as string;
    f.hexByTxid.set(foreignTxid, foreign.toHex() as string);
    const network = networkFor(f, { historyNewestFirstTxids: [foreignTxid, f.headTxid, f.docTxid] });
    const resolved = await resolveHead({ address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: network });
    expect(resolved.status).toBe("ok");
    if (resolved.status === "ok") expect(resolved.headTxid).toBe(f.headTxid);
  });

  it("prefers a head still in the mempool over the confirmed history", async () => {
    const f = await fixture();
    const network = networkFor(f, { historyNewestFirstTxids: [f.docTxid], unconfirmed: [f.headTxid] });
    const resolved = await resolveHead({ address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: network });
    expect(resolved.status).toBe("ok");
  });

  it("a head that will not open is corrupt, never silently skipped", async () => {
    const badHead = Buffer.from(JSON.stringify({ v: 2, surfaces: {} }));
    const f = await fixture(badHead);
    const resolved = await resolveHead({ address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: networkFor(f) });
    expect(resolved.status).toBe("corrupt");
    if (resolved.status === "corrupt") expect(resolved.detail).toContain(f.headTxid);
  });

  it("an address with no head inscription says so, distinctly", async () => {
    const f = await fixture();
    const network = networkFor(f, { historyNewestFirstTxids: [f.docTxid] });
    const resolved = await resolveHead({ address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: network });
    expect(resolved.status).toBe("no-head");
  });
});

describe("reading a surface", () => {
  it("resolves the head, fetches the document, and opens it", async () => {
    const f = await fixture();
    const read = await readSurface({ surface: "board-latest", address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: networkFor(f) });
    expect(read.status).toBe("ok");
    if (read.status === "ok") {
      expect(Buffer.from(read.document).toString("utf8")).toBe(f.document.toString("utf8"));
      expect(read.txid).toBe(f.docTxid);
      expect(read.headTxid).toBe(f.headTxid);
    }
  });

  it("a surface the head does not name is missing, not empty", async () => {
    const f = await fixture();
    const read = await readSurface({ surface: "board-week", address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: networkFor(f) });
    expect(read).toEqual({ status: "missing", surface: "board-week", headTxid: f.headTxid });
  });

  it("a document that opens under the wrong surface is corrupt", async () => {
    const f = await fixture();
    // The head names the document's txid, but the indexer serves the HEAD's
    // own hex for it — an envelope of the wrong surface.
    f.hexByTxid.set(f.docTxid, f.hexByTxid.get(f.headTxid) as string);
    const read = await readSurface({ surface: "board-latest", address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: networkFor(f) });
    expect(read.status).toBe("corrupt");
  });

  it("both indexers down is unreachable — never an empty archive", async () => {
    const dead = (async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;
    const read = await readSurface({ surface: "board-latest", address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: dead });
    expect(read.status).toBe("unreachable");
    if (read.status === "unreachable") {
      for (const base of INDEXER_BASES) expect(read.detail).toContain(base);
    }
  });

  it("the second indexer answers when the first refuses", async () => {
    const f = await fixture();
    const network = networkFor(f);
    const flaky = (async (url: RequestInfo | URL) => {
      if (String(url).startsWith(INDEXER_BASES[0])) return refuse(500);
      return network(url as never);
    }) as typeof fetch;
    const read = await readSurface({ surface: "board-latest", address: ADDRESS, keyHex: SEAL_KEY, fetchImpl: flaky });
    expect(read.status).toBe("ok");
  });
});

describe("the two parsers agree", () => {
  it("the reader and the writer accept and refuse the same payloads", () => {
    const good = Buffer.from(JSON.stringify({ v: 1, surfaces: { "board-latest": "a".repeat(64) } }));
    expect(parseHeadPayload(new Uint8Array(good))).toEqual(parseHeadPayloadMjs(good));
    const bad = Buffer.from(JSON.stringify({ v: 2, surfaces: {} }));
    expect(() => parseHeadPayload(new Uint8Array(bad))).toThrow();
    expect(() => parseHeadPayloadMjs(bad)).toThrow();
  });
});

describe("the reader and the writer name surfaces the same way", () => {
  it("every surface name the publisher writes is the one the seams read", () => {
    expect(SURFACE.board).toBe(BOARD_SURFACE);
    expect(SURFACE.done).toBe(DONE_SURFACE);
    expect(SURFACE.gardening).toBe(GARDENING_SURFACE);
    expect(SURFACE.report("2026-09-01")).toBe(reportSurface("2026-09-01"));
    expect(SURFACE.week("2026-08-30")).toBe(weekSurface("2026-08-30"));
  });
});
