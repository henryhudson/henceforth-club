import { beforeEach, describe, expect, it, vi } from "vitest";
import { BSM, PrivateKey, Utils } from "@bsv/sdk";
import { registrationMessage } from "@/lib/xBinding";
import type { LiveBinding } from "@/lib/xBindingLive";

// In-memory fakes for the input/output boundaries.
const store = {
  archives: new Map(),
  owners: new Map(),
  lists: new Map(),
  handles: new Map(),
  warms: [] as string[],
  live: { kind: "verified" } as LiveBinding,
  liveCalls: 0,
  livePostId: "",
  board: new Map<string, number>(),
  refusals: [] as unknown[],
};

vi.mock("@/lib/whatsonchain", () => ({
  fetchTxArchive: async (txid: string) => store.archives.get(txid) ?? null,
}));
vi.mock("@/lib/xArchiveCache", () => ({
  warmArchiveCache: async (handle: string) => { store.warms.push(handle); },
}));
// `after` demands a live request scope, which a unit test doesn't have — run
// the task inline instead, so the tests can observe what was scheduled.
vi.mock("next/server", async (orig) => ({
  ...(await orig() as object),
  after: (task: () => unknown) => { void task(); },
}));
vi.mock("@/lib/xDigest", () => ({ archiveDigest: () => ({}), setTxDigest: async () => {} }));
vi.mock("@/lib/xIndex", () => ({
  getXTxids: async (h: string) => store.lists.get(h.toLowerCase()) ?? [],
  appendXTxid: async (h: string, t: string) => { const k = h.toLowerCase(); store.lists.set(k, [...(store.lists.get(k) ?? []), t]); return true; },
  setXTxids: async (h: string, t: string[]) => { store.lists.set(h.toLowerCase(), t); return true; },
  stampHandle: async (h: string, atMs: number) => { store.handles.set(h.toLowerCase(), atMs); return true; },
}));
// X itself is an I/O boundary — the live read is faked, never performed.
vi.mock("@/lib/xBindingLive", () => ({
  verifyBindingPost: async (input: { postId: string }) => { store.liveCalls++; store.livePostId = input.postId; return store.live; },
}));
// The board seed, faked as the `nx` write it really is: a handle already on
// the board keeps whatever score kudos have since given it.
vi.mock("@/lib/folkloreBoard", () => ({
  seedProfileOnBoard: async (handle: string, score: number) => {
    const member = `profile:${handle.toLowerCase()}`;
    if (store.board.has(member)) return false;
    store.board.set(member, score);
    return true;
  },
}));
// The durable refusal record — every non-200 the route sends must land one.
vi.mock("@/lib/xRefusalLog", () => ({
  logRefusal: async (refusal: unknown) => { store.refusals.push(refusal); return true; },
}));
vi.mock("@/lib/xOwner", async (orig) => ({
  ...(await orig()),
  getOwner: async (h: string) => store.owners.get(h.toLowerCase()) ?? null,
  setOwner: async (h: string, o: unknown) => { store.owners.set(h.toLowerCase(), o); return true; },
}));

import { POST } from "./route";

const TXID = "a".repeat(64);
const HANDLE = "henryhudson6";

function archive(handle: string, ...extraPostTexts: string[]) {
  return { v: 1, source: "x", handle, profile: {}, posts: [
    { id: "1", at: "2012-09-02T00:00:00Z", text: "gm" },
    ...extraPostTexts.map((text, i) => ({ id: String(i + 2), at: "2013-01-01T00:00:00Z", text })),
  ] };
}
function claimFor(handle: string, txid: string) {
  const priv = PrivateKey.fromRandom();
  const pub = priv.toPublicKey();
  const address = pub.toAddress();
  const signature = BSM.sign(Utils.toArray(registrationMessage(handle, txid), "utf8"), priv, "base64") as string;
  return { address, pubkey: pub.toString(), signature };
}
const post = (body: unknown) => POST(new Request("http://x/api/x/register", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => { store.archives.clear(); store.owners.clear(); store.lists.clear(); store.handles.clear(); store.warms.length = 0; store.live = { kind: "verified" }; store.liveCalls = 0; store.livePostId = ""; store.board.clear(); store.refusals.length = 0; });

describe("POST /api/x/register", () => {
  it("still accepts an unsigned registration for an unclaimed handle (backward compatible)", async () => {
    store.archives.set(TXID, archive(HANDLE));
    const res = await post({ handle: HANDLE, txid: TXID });
    expect(res.status).toBe(200);
    expect(store.lists.get(HANDLE)).toEqual([TXID]);
    expect(store.owners.get(HANDLE)).toBeUndefined(); // no owner, no tick
    expect(store.handles.has(HANDLE)).toBe(true); // stamped into the public directory
    expect(store.warms).toEqual([HANDLE]); // the cache stitch is paid here, never by a page view
  });

  it("establishes ownership and RESETS the feed when a valid claim arrives", async () => {
    store.lists.set(HANDLE, ["stranger-txid"]); // pre-claim pollution
    const c = claimFor(HANDLE, TXID);
    store.archives.set(TXID, archive(HANDLE, `Verifying my Henceforth identity: ${c.address}`));
    const res = await post({ handle: HANDLE, txid: TXID, address: c.address, pubkey: c.pubkey, signature: c.signature });
    expect(res.status).toBe(200);
    expect(store.lists.get(HANDLE)).toEqual([TXID]); // reset — stranger-txid dropped
    expect(store.liveCalls).toBe(1); // the reset is gated on X confirming the post
    expect((store.owners.get(HANDLE) as { address: string }).address).toBe(c.address);
    expect(store.handles.has(HANDLE)).toBe(true); // a claim that resets the feed is also a registration
    expect(store.warms).toEqual([HANDLE]); // the reset feed's cache rebuilds here too
  });

  it("names the post that carries the binding line, not one that merely mentions the address", async () => {
    // The decoy holds both the prefix and the address, but in unrelated places:
    // it commits to nothing. Only the prefix-anchored reading is the binding,
    // so a second, looser predicate would send X the wrong permalink to verify
    // and record it as the evidence of ownership.
    const c = claimFor(HANDLE, TXID);
    store.archives.set(TXID, archive(
      HANDLE,
      `paid ${c.address} for lunch. Verifying my Henceforth identity: soon`,
      `Verifying my Henceforth identity: ${c.address}`,
    ));

    const res = await post({ handle: HANDLE, txid: TXID, address: c.address, pubkey: c.pubkey, signature: c.signature });

    expect(res.status).toBe(200);
    expect(store.livePostId).toBe("3");
    expect((store.owners.get(HANDLE) as { bindingPostId: string }).bindingPostId).toBe("3");
  });

  it("refuses to establish when the live binding post is not authored by the handle", async () => {
    // A fabricated archive: the attacker inscribes a binding line for their own
    // address under someone else's handle. Everything local passes — the
    // signature is real, the address matches the archive — because the archive
    // is the attacker's own writing. Only X can say who posted it.
    store.lists.set(HANDLE, ["paid-archive-txid"]); // the handle's real, paid-for feed
    store.live = { kind: "wrong-author", author: "attacker" };
    const c = claimFor(HANDLE, TXID);
    store.archives.set(TXID, archive(HANDLE, `Verifying my Henceforth identity: ${c.address}`));

    const res = await post({ handle: HANDLE, txid: TXID, address: c.address, pubkey: c.pubkey, signature: c.signature });

    expect(res.status).toBe(422);
    expect(store.owners.get(HANDLE)).toBeUndefined(); // no ownership seized
    expect(store.lists.get(HANDLE)).toEqual(["paid-archive-txid"]); // and the paid feed NOT reset
    expect(store.warms).toEqual([]);
  });

  it("returns 503 and records nothing when X is unreachable", async () => {
    store.lists.set(HANDLE, ["paid-archive-txid"]);
    store.live = { kind: "unreachable" };
    const c = claimFor(HANDLE, TXID);
    store.archives.set(TXID, archive(HANDLE, `Verifying my Henceforth identity: ${c.address}`));

    const res = await post({ handle: HANDLE, txid: TXID, address: c.address, pubkey: c.pubkey, signature: c.signature });

    expect(res.status).toBe(503); // transient, so the app retries — never a silent establish
    expect(store.owners.get(HANDLE)).toBeUndefined();
    expect(store.lists.get(HANDLE)).toEqual(["paid-archive-txid"]);
  });

  it("refuses to establish when X serves no such post", async () => {
    store.live = { kind: "not-found" };
    const c = claimFor(HANDLE, TXID);
    store.archives.set(TXID, archive(HANDLE, `Verifying my Henceforth identity: ${c.address}`));

    const res = await post({ handle: HANDLE, txid: TXID, address: c.address, pubkey: c.pubkey, signature: c.signature });

    expect(res.status).toBe(422);
    expect(store.owners.get(HANDLE)).toBeUndefined();
  });

  it("rejects an unsigned registration once the handle is claimed, leaving the directory untouched", async () => {
    store.owners.set(HANDLE, { address: "1OWNER", pubkey: "x", boundAt: 1, bindingTxid: TXID, bindingPostId: "1" });
    store.archives.set(TXID, archive(HANDLE));
    const res = await post({ handle: HANDLE, txid: TXID });
    expect(res.status).toBe(403);
    expect(store.handles.has(HANDLE)).toBe(false);
    expect(store.warms).toEqual([]); // nothing registered, nothing warmed
  });

  it("rejects a claim whose signature is not by the committed address", async () => {
    const c = claimFor(HANDLE, TXID);
    const wrong = claimFor(HANDLE, TXID); // different key
    store.archives.set(TXID, archive(HANDLE, `Verifying my Henceforth identity: ${c.address}`));
    const res = await post({ handle: HANDLE, txid: TXID, address: c.address, pubkey: wrong.pubkey, signature: wrong.signature });
    expect(res.status).toBe(403);
  });

  it("rejects a claim when the archive carries no binding tweet for that address", async () => {
    const c = claimFor(HANDLE, TXID);
    store.archives.set(TXID, archive(HANDLE)); // no binding post
    const res = await post({ handle: HANDLE, txid: TXID, address: c.address, pubkey: c.pubkey, signature: c.signature });
    expect(res.status).toBe(422);
  });

  it("lets the established owner append another archive with their signature", async () => {
    const priv = PrivateKey.fromRandom(); const pub = priv.toPublicKey(); const address = pub.toAddress();
    store.owners.set(HANDLE, { address, pubkey: pub.toString(), boundAt: 1, bindingTxid: TXID, bindingPostId: "1" });
    store.lists.set(HANDLE, [TXID]);
    const DELTA = "d".repeat(64);
    const signature = BSM.sign(Utils.toArray(registrationMessage(HANDLE, DELTA), "utf8"), priv, "base64") as string;
    store.archives.set(DELTA, archive(HANDLE));
    const res = await post({ handle: HANDLE, txid: DELTA, address, pubkey: pub.toString(), signature });
    expect(res.status).toBe(200);
    expect(store.lists.get(HANDLE)).toEqual([TXID, DELTA]); // appended, not reset
    expect(store.liveCalls).toBe(0); // an append repeats no binding tweet, so it asks X nothing
    expect(store.warms).toEqual([HANDLE]); // the delta extension is paid here, never by a page view
  });
});

describe("registration lands a board card, so the board is never behind the directory", () => {
  it("seeds a profile card for a handle registering after go-live", async () => {
    // Before this, seedProfileOnBoard's only non-test caller was a hand-run
    // script — so any handle archiving after that script last ran was absent
    // from /folklore permanently, while having paid for the listing.
    store.archives.set(TXID, archive(HANDLE));
    expect((await post({ handle: HANDLE, txid: TXID })).status).toBe(200);
    expect(store.board.get(`profile:${HANDLE}`)).toBe(0);
  });

  it("seeds one for a handle that establishes ownership with a signed claim", async () => {
    const c = claimFor(HANDLE, TXID);
    store.archives.set(TXID, archive(HANDLE, `Verifying my Henceforth identity: ${c.address}`));
    const res = await post({ handle: HANDLE, txid: TXID, address: c.address, pubkey: c.pubkey, signature: c.signature });
    expect(res.status).toBe(200);
    expect(store.board.get(`profile:${HANDLE}`)).toBe(0);
  });

  it("never resets a score kudos have moved — re-registering is idempotent", async () => {
    store.archives.set(TXID, archive(HANDLE));
    await post({ handle: HANDLE, txid: TXID });
    store.board.set(`profile:${HANDLE}`, 42); // kudos arrive

    const DELTA = "d".repeat(64);
    store.archives.set(DELTA, archive(HANDLE));
    expect((await post({ handle: HANDLE, txid: DELTA })).status).toBe(200);
    expect(store.board.get(`profile:${HANDLE}`)).toBe(42);
  });

  it("seeds nothing when the registration itself was refused", async () => {
    store.archives.set(TXID, archive("someone-else"));
    expect((await post({ handle: HANDLE, txid: TXID })).status).toBe(422);
    expect(store.board.size).toBe(0);
  });
});

describe("every refusal leaves a durable record, and the answer it records is unchanged", () => {
  it("a refusal returns the same body as ever AND logs {at, handle, txid, reason, status}", async () => {
    // No archive behind the txid — the commonest real refusal.
    const res = await post({ handle: HANDLE, txid: TXID });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, reason: "no-archive-in-tx" });
    expect(store.refusals).toEqual([{
      at: expect.any(Number),
      handle: HANDLE,
      txid: TXID,
      reason: "no-archive-in-tx",
      status: 422,
    }]);
  });

  it("even a request that never yields a handle is recorded — with empty fields, not skipped", async () => {
    const res = await POST(new Request("http://x/api/x/register", { method: "POST", body: "not json" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-json" });
    expect(store.refusals).toEqual([{ at: expect.any(Number), handle: "", txid: "", reason: "bad-json", status: 400 }]);
  });

  it("a live-binding refusal records the reason the app was sent, not the internal kind", async () => {
    store.live = { kind: "wrong-author", author: "attacker" };
    const c = claimFor(HANDLE, TXID);
    store.archives.set(TXID, archive(HANDLE, `Verifying my Henceforth identity: ${c.address}`));

    const res = await post({ handle: HANDLE, txid: TXID, address: c.address, pubkey: c.pubkey, signature: c.signature });

    expect(res.status).toBe(422);
    expect(store.refusals).toEqual([expect.objectContaining({ reason: "binding-post-not-by-handle", status: 422 })]);
  });

  it("a success records nothing", async () => {
    store.archives.set(TXID, archive(HANDLE));
    expect((await post({ handle: HANDLE, txid: TXID })).status).toBe(200);
    expect(store.refusals).toEqual([]);
  });
});
