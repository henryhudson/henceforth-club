import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Commit, Transaction } from "@/lib/ledger/types";

// Mocked at the input/output boundary only — the cookie jar and the store.
// The gate logic itself, which is what these tests are about, runs for real.

const cookieValue = vi.fn<() => string | undefined>(() => undefined);
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (_: string) => ({ value: cookieValue() }) }),
}));

const stored = { transactions: [] as Transaction[], commits: {} as Record<string, Commit> };
vi.mock("@/lib/ledger/store", () => ({
  loadTransactions: async () => stored.transactions,
  saveTransactions: async (list: Transaction[]) => { stored.transactions = list; },
  loadCommit: async (periodId: string) => stored.commits[periodId] ?? null,
  saveCommit: async () => {},
  loadAllCommits: async () => stored.commits,
}));

const { createSession } = await import("@/lib/board-auth");
const { DELETE, GET, PATCH, POST } = await import("./route");

const SECRET = "test-secret-for-the-gate";

const row = (over: Partial<Transaction> = {}): Transaction => ({
  id: "L0001", date: "2025-08-19", account: "HSBC (debit)", amount: "-19.00",
  description: "GIGACLEAR WIFI", category: "Internet", source: "HSBC 2025-08-19", ...over,
});

const post = (transactions: Partial<Transaction>[]) =>
  POST(new Request("http://x/api/ledger", { method: "POST", body: JSON.stringify({ transactions }) }));

beforeEach(async () => {
  process.env.BOARD_COOKIE_SECRET = SECRET;
  stored.transactions = [row()];
  stored.commits = {};
  cookieValue.mockReturnValue(await createSession(SECRET, 60_000));
});

describe("the gate", () => {
  // src/middleware.ts matches ["/board", "/board/:path*"] and does NOT cover
  // /api. Without the endpoint's own check this serves the company accounts
  // to anyone. Every method is asserted, because one unguarded method is
  // as good as none.
  it("refuses every method without a session, and leaks nothing", async () => {
    cookieValue.mockReturnValue(undefined);

    const responses = await Promise.all([
      GET(),
      post([row()]),
      PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ transaction: row() }) })),
      DELETE(new Request("http://x/api/ledger?id=L0001", { method: "DELETE" })),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
      const body = JSON.stringify(await res.json());
      expect(body).not.toContain("GIGACLEAR");
      expect(body).not.toContain("19.00");
    }
  });

  it("refuses a forged session", async () => {
    cookieValue.mockReturnValue(await createSession("the-wrong-secret", 60_000));
    expect((await GET()).status).toBe(401);
  });

  it("refuses an expired session", async () => {
    cookieValue.mockReturnValue(await createSession(SECRET, -1));
    expect((await GET()).status).toBe(401);
  });

  it("refuses everything when no secret is configured", async () => {
    // An unset secret must fail closed, never open.
    delete process.env.BOARD_COOKIE_SECRET;
    expect((await GET()).status).toBe(401);
  });

  it("serves the ledger to a valid session", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).transactions).toHaveLength(1);
  });
});

describe("writes", () => {
  it("rejects an invalid row before it reaches the store", async () => {
    const res = await post([{ ...row(), id: undefined, amount: "-19" }]);
    expect(res.status).toBe(400);
    expect((await res.json()).errors[0]).toContain("row 1");
    expect(stored.transactions).toHaveLength(1);
  });

  it("appends and keeps the ledger in date order", async () => {
    const res = await post([{ ...row(), id: undefined, date: "2025-01-05" }]);
    expect(res.status).toBe(200);
    expect(stored.transactions.map((t) => t.date)).toEqual(["2025-01-05", "2025-08-19"]);
  });

  it("assigns identifiers that do not collide with each other", async () => {
    await post([
      { ...row(), id: undefined, description: "ONE" },
      { ...row(), id: undefined, description: "TWO" },
      { ...row(), id: undefined, description: "THREE" },
    ]);
    const ids = stored.transactions.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never lets a caller choose its own identifier on update", async () => {
    // Rewriting an identifier would silently break the Merkle leaf it names.
    await PATCH(new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ transaction: { ...row(), id: "L0001", description: "EDITED" } }),
    }));
    expect(stored.transactions[0].id).toBe("L0001");
    expect(stored.transactions[0].description).toBe("EDITED");
  });
});

describe("a committed period is read-only", () => {
  const committed: Commit = {
    periodId: "2025-01-01_2025-12-31", root: "deadbeef", leaves: [], transactionIds: [],
    count: 1, txid: "abc", broadcastAt: "2026-07-30T00:00:00.000Z",
  };

  beforeEach(() => { stored.commits = { [committed.periodId]: committed }; });

  it("refuses an insert into it", async () => {
    const res = await post([{ ...row(), id: undefined }]);
    expect(res.status).toBe(409);
    expect(stored.transactions).toHaveLength(1);
  });

  it("refuses an edit inside it", async () => {
    const res = await PATCH(new Request("http://x", {
      method: "PATCH", body: JSON.stringify({ transaction: row({ amount: "-20.00" }) }),
    }));
    expect(res.status).toBe(409);
    expect(stored.transactions[0].amount).toBe("-19.00");
  });

  it("refuses a delete inside it", async () => {
    const res = await DELETE(new Request("http://x/api/ledger?id=L0001", { method: "DELETE" }));
    expect(res.status).toBe(409);
    expect(stored.transactions).toHaveLength(1);
  });

  it("refuses moving a row OUT of it into an open period", async () => {
    // The escape hatch worth closing: if only the destination were checked,
    // a row could be lifted out of a committed period and break its root.
    stored.commits = { [committed.periodId]: committed };
    const res = await PATCH(new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ transaction: row({ date: "2026-03-01" }) }),
    }));
    expect(res.status).toBe(409);
    expect(stored.transactions[0].date).toBe("2025-08-19");
  });

  it("still allows work in an open period", async () => {
    const res = await post([{ ...row(), id: undefined, date: "2026-03-01" }]);
    expect(res.status).toBe(200);
    expect(stored.transactions).toHaveLength(2);
  });
});
