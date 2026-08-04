import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRoot, leafHash, verifyProof } from "@/lib/ledger/merkle";
import type { Commit, Transaction } from "@/lib/ledger/types";

// Mocked at the input/output boundary only — the cookie jar and the store.
// The proof construction itself runs for real against a genuine commitment.

const cookieValue = vi.fn<() => string | undefined>(() => undefined);
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (_: string) => ({ value: cookieValue() }) }),
}));

const stored = { commits: {} as Record<string, Commit> };
vi.mock("@/lib/ledger/store", () => ({
  loadAllCommits: async () => stored.commits,
}));

const { createSession } = await import("@/lib/board-auth");
const { GET } = await import("./route");

const SECRET = "test-secret-for-the-gate";

// Five transactions: an odd count, so the tree carries a node up unchanged and
// the proofs exercise the level where a step is skipped.
const committed: Transaction[] = [
  { id: "t1", date: "2025-01-15", account: "HSBC (debit)", amount: "-49.95", description: "IPHONE PAYMENT", category: "Phone", source: "HSBC 2025-01-19" },
  { id: "t2", date: "2025-02-12", account: "Amex (credit)", amount: "-429.00", description: "APPLE STORE", category: "Equipment", source: "Amex 2025-02" },
  { id: "t3", date: "2025-03-01", account: "NatWest", amount: "-19.00", description: "GIGACLEAR WIFI", category: "Internet", source: "NatWest 2025-03" },
  { id: "t4", date: "2025-04-05", account: "HSBC (credit)", amount: "6.07", description: "APP REVENUE APRIL", category: "App revenue", source: "HSBC 2025-04" },
  { id: "t5", date: "2025-05-20", account: "HSBC (debit)", amount: "-13.00", description: "COMPANIES HOUSE FEE", category: "Statutory filing fees", source: "HSBC 2025-05" },
];

async function commitmentOf(list: Transaction[]): Promise<Commit> {
  const pairs = await Promise.all(list.map(async (t) => ({ id: t.id, leaf: await leafHash(t) })));
  pairs.sort((a, b) => (a.leaf < b.leaf ? -1 : a.leaf > b.leaf ? 1 : 0));
  const leaves = pairs.map((p) => p.leaf);
  return {
    periodId: "2025-01-01_2025-12-31",
    root: await buildRoot(leaves),
    leaves,
    transactionIds: pairs.map((p) => p.id),
    count: leaves.length,
    txid: "f".repeat(64),
    broadcastAt: "2026-08-04T00:00:00.000Z",
  };
}

const get = (id: string) => GET(new Request(`http://x/api/ledger/proof?id=${id}`));

beforeEach(async () => {
  process.env.BOARD_COOKIE_SECRET = SECRET;
  stored.commits = { "2025-01-01_2025-12-31": await commitmentOf(committed) };
  cookieValue.mockReturnValue(await createSession(SECRET, 60_000));
});

describe("the gate", () => {
  // Same reasoning as /api/ledger: the middleware matches /board only, so the
  // endpoint refuses on its own — and a refusal must carry no hashes either.
  it("refuses without a session, and leaks nothing", async () => {
    cookieValue.mockReturnValue(undefined);
    const res = await get("t1");
    expect(res.status).toBe(401);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("IPHONE");
    expect(body).not.toContain("root");
  });

  it("refuses a forged session", async () => {
    cookieValue.mockReturnValue(await createSession("the-wrong-secret", 60_000));
    expect((await get("t1")).status).toBe(401);
  });
});

describe("the proof", () => {
  it("round-trips: the served proof verifies against the committed root", async () => {
    const res = await get("t2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leaf).toBe(await leafHash(committed[1]));
    expect(await verifyProof(body.leaf, body.steps, body.root)).toBe(true);
    expect(body.txid).toBe("f".repeat(64));
    expect(body.periodLabel).toBe("01 January 2025 to 31 December 2025");
    expect(body.count).toBe(5);
  });

  it("verifies every committed transaction, including the carried-up leaf", async () => {
    for (const t of committed) {
      const body = await (await get(t.id)).json();
      expect(await verifyProof(body.leaf, body.steps, body.root)).toBe(true);
    }
  });

  it("refuses to verify a one-penny alteration", async () => {
    const body = await (await get("t2")).json();
    const tampered = await leafHash({ ...committed[1], amount: "-429.01" });
    expect(tampered).not.toBe(body.leaf);
    expect(await verifyProof(tampered, body.steps, body.root)).toBe(false);
  });

  it("says nothing about any transaction's content — the response is hashes and period metadata", async () => {
    // The disclosure boundary is the property this design exists for: a proof
    // shows one transaction was committed without showing the others.
    const body = JSON.stringify(await (await get("t3")).json());
    for (const t of committed) {
      expect(body).not.toContain(t.description);
      expect(body).not.toContain(t.amount);
      expect(body).not.toContain(t.account);
      expect(body).not.toContain(t.source);
    }
    const others = committed.filter((t) => t.id !== "t3");
    for (const t of others) expect(body).not.toContain(`"${t.id}"`);
  });

  it("wants an identifier", async () => {
    expect((await GET(new Request("http://x/api/ledger/proof"))).status).toBe(400);
  });

  it("has no proof for a transaction outside every commitment", async () => {
    expect((await get("t9")).status).toBe(404);
  });
});
