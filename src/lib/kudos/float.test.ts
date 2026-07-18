import { describe, it, expect } from "vitest";
import type { Redis } from "@upstash/redis";
import { DAILY_DUEL_CAP } from "./constants";
import {
  accrueEarned,
  debitForDuel,
  debitForTip,
  fundFloat,
  markSettled,
  readFloat,
  readHandleAccount,
  readProfileAccount,
} from "./float";

const DAY = "2026-07-18";

/** A minimal in-memory stand-in for the Upstash client — only the calls the
 * float ledger actually makes: `incr`, `decr`, `incrby`, `decrby`, `get`.
 * Every counter mutation is synchronous inside its call, exactly the atomic
 * single-command guarantee the real Redis gives. */
function fakeRedis(): Redis {
  const counters = new Map<string, number>();
  const bump = (key: string, by: number) => {
    const next = (counters.get(key) ?? 0) + by;
    counters.set(key, next);
    return next;
  };
  return {
    incr: async (key: string) => bump(key, 1),
    decr: async (key: string) => bump(key, -1),
    incrby: async (key: string, by: number) => bump(key, by),
    decrby: async (key: string, by: number) => bump(key, -by),
    get: async (key: string) => counters.get(key) ?? null,
  } as unknown as Redis;
}

/** A tiny seeded generator — the property test's randomness is a parameter,
 * so a failure replays exactly. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("fundFloat", () => {
  it("credits the float and records the funding, accumulating across calls", async () => {
    const redis = fakeRedis();

    expect(await fundFloat("alice", 2000, redis)).toEqual({ kind: "recorded", float: 2000 });
    expect(await fundFloat("alice", 500, redis)).toEqual({ kind: "recorded", float: 2500 });
    expect(await readProfileAccount("alice", redis)).toEqual({ funded: 2500, float: 2500, spent: 0 });
  });

  it("normalises the profile like the rest of the folklore keys", async () => {
    const redis = fakeRedis();
    await fundFloat("Alice", 100, redis);
    expect(await readFloat("alice", redis)).toBe(100);
  });

  it("rejects non-positive and non-integer amounts, touching nothing", async () => {
    const redis = fakeRedis();
    for (const amount of [0, -5, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(await fundFloat("alice", amount, redis)).toEqual({ kind: "invalid" });
    }
    expect(await readProfileAccount("alice", redis)).toEqual({ funded: 0, float: 0, spent: 0 });
  });

  it("is null-Redis safe: unavailable", async () => {
    expect(await fundFloat("alice", 100, null)).toEqual({ kind: "unavailable" });
  });
});

describe("debitForDuel", () => {
  it("debits the float and records the spend", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 100, redis);

    expect(await debitForDuel("alice", 30, DAY, redis)).toEqual({ kind: "recorded", float: 70 });
    expect(await readProfileAccount("alice", redis)).toEqual({ funded: 100, float: 70, spent: 30 });
  });

  it("refuses an overdraft, leaving every counter untouched", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 20, redis);

    expect(await debitForDuel("alice", 30, DAY, redis)).toEqual({ kind: "insufficient", float: 20 });
    expect(await readProfileAccount("alice", redis)).toEqual({ funded: 20, float: 20, spent: 0 });
  });

  it("pins the concurrent-debit race: the atomic decrement lets exactly one of two contending debits through", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 100, redis);

    const [first, second] = await Promise.all([
      debitForDuel("alice", 80, DAY, redis),
      debitForDuel("alice", 80, DAY, redis),
    ]);

    const kinds = [first.kind, second.kind].sort();
    expect(kinds).toEqual(["insufficient", "recorded"]);
    // The float never went spendably negative and the books balance.
    expect(await readProfileAccount("alice", redis)).toEqual({ funded: 100, float: 20, spent: 80 });
  });

  it(`caps at ${DAILY_DUEL_CAP} duels per profile per day, consuming no float on the capped result`, async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 5000, redis);

    for (let i = 0; i < DAILY_DUEL_CAP; i++) {
      expect((await debitForDuel("alice", 1, DAY, redis)).kind).toBe("recorded");
    }
    expect(await debitForDuel("alice", 1, DAY, redis)).toEqual({ kind: "capped" });
    expect(await readProfileAccount("alice", redis)).toEqual({
      funded: 5000,
      float: 5000 - DAILY_DUEL_CAP,
      spent: DAILY_DUEL_CAP,
    });
    // The cap is per day: the next day deals again.
    expect((await debitForDuel("alice", 1, "2026-07-19", redis)).kind).toBe("recorded");
  });

  it("releases the day's cap slot when the debit is insufficient", async () => {
    const redis = fakeRedis();

    expect((await debitForDuel("alice", 1, DAY, redis)).kind).toBe("insufficient");
    await fundFloat("alice", 5000, redis);
    // Every one of the day's slots is still available — the failed attempt
    // burned none.
    for (let i = 0; i < DAILY_DUEL_CAP; i++) {
      expect((await debitForDuel("alice", 1, DAY, redis)).kind).toBe("recorded");
    }
  });

  it("rejects non-positive and non-integer amounts, touching nothing", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 100, redis);
    for (const amount of [0, -5, 1.5, Number.NaN]) {
      expect(await debitForDuel("alice", amount, DAY, redis)).toEqual({ kind: "invalid" });
    }
    expect(await readProfileAccount("alice", redis)).toEqual({ funded: 100, float: 100, spent: 0 });
  });

  it("is null-Redis safe: unavailable", async () => {
    expect(await debitForDuel("alice", 1, DAY, null)).toEqual({ kind: "unavailable" });
  });
});

describe("debitForTip", () => {
  it("debits the float and records the spend with no daily cap", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", DAILY_DUEL_CAP + 100, redis);

    for (let i = 0; i < DAILY_DUEL_CAP + 50; i++) {
      expect((await debitForTip("alice", 1, redis)).kind).toBe("recorded");
    }
    expect(await readProfileAccount("alice", redis)).toEqual({
      funded: DAILY_DUEL_CAP + 100,
      float: 50,
      spent: DAILY_DUEL_CAP + 50,
    });
  });

  it("refuses an overdraft, leaving every counter untouched", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 5, redis);

    expect(await debitForTip("alice", 10, redis)).toEqual({ kind: "insufficient", float: 5 });
    expect(await readProfileAccount("alice", redis)).toEqual({ funded: 5, float: 5, spent: 0 });
  });

  it("rejects non-positive and non-integer amounts", async () => {
    const redis = fakeRedis();
    expect(await debitForTip("alice", 0, redis)).toEqual({ kind: "invalid" });
    expect(await debitForTip("alice", 2.5, redis)).toEqual({ kind: "invalid" });
  });

  it("is null-Redis safe: unavailable", async () => {
    expect(await debitForTip("alice", 1, null)).toEqual({ kind: "unavailable" });
  });
});

describe("accrueEarned", () => {
  it("accrues to the handle's unsettled earnings", async () => {
    const redis = fakeRedis();

    expect(await accrueEarned("bob", 40, redis)).toEqual({ kind: "recorded", earned: 40 });
    expect(await accrueEarned("bob", 10, redis)).toEqual({ kind: "recorded", earned: 50 });
    expect(await readHandleAccount("bob", redis)).toEqual({ earned: 50, settled: 0 });
  });

  it("rejects non-positive and non-integer amounts", async () => {
    const redis = fakeRedis();
    expect(await accrueEarned("bob", 0, redis)).toEqual({ kind: "invalid" });
    expect(await accrueEarned("bob", 0.1, redis)).toEqual({ kind: "invalid" });
    expect(await readHandleAccount("bob", redis)).toEqual({ earned: 0, settled: 0 });
  });

  it("is null-Redis safe: unavailable", async () => {
    expect(await accrueEarned("bob", 1, null)).toEqual({ kind: "unavailable" });
  });
});

describe("markSettled", () => {
  it("moves earnings from unsettled to settled, preserving their sum", async () => {
    const redis = fakeRedis();
    await accrueEarned("bob", 100, redis);

    expect(await markSettled("bob", 60, redis)).toEqual({ kind: "recorded", settled: 60 });
    expect(await readHandleAccount("bob", redis)).toEqual({ earned: 40, settled: 60 });
    expect(await markSettled("bob", 40, redis)).toEqual({ kind: "recorded", settled: 100 });
    expect(await readHandleAccount("bob", redis)).toEqual({ earned: 0, settled: 100 });
  });

  it("refuses to settle more than has accrued, leaving the accrual intact", async () => {
    const redis = fakeRedis();
    await accrueEarned("bob", 40, redis);

    expect(await markSettled("bob", 50, redis)).toEqual({ kind: "insufficient", earned: 40 });
    expect(await readHandleAccount("bob", redis)).toEqual({ earned: 40, settled: 0 });
  });

  it("rejects non-positive and non-integer amounts", async () => {
    const redis = fakeRedis();
    expect(await markSettled("bob", 0, redis)).toEqual({ kind: "invalid" });
    expect(await markSettled("bob", 5.5, redis)).toEqual({ kind: "invalid" });
  });

  it("is null-Redis safe: unavailable", async () => {
    expect(await markSettled("bob", 1, null)).toEqual({ kind: "unavailable" });
  });
});

describe("readers", () => {
  it("read zero for a profile and handle the ledger has never seen", async () => {
    const redis = fakeRedis();
    expect(await readFloat("nobody", redis)).toBe(0);
    expect(await readProfileAccount("nobody", redis)).toEqual({ funded: 0, float: 0, spent: 0 });
    expect(await readHandleAccount("nobody", redis)).toEqual({ earned: 0, settled: 0 });
  });

  it("are null-Redis safe: zeroed", async () => {
    expect(await readFloat("alice", null)).toBe(0);
    expect(await readProfileAccount("alice", null)).toEqual({ funded: 0, float: 0, spent: 0 });
    expect(await readHandleAccount("alice", null)).toEqual({ earned: 0, settled: 0 });
  });
});

describe("conservation", () => {
  const PROFILES = ["alice", "bob", "carol"] as const;

  /** The invariant of section five, checked from the stored counters alone:
   * per profile `funded = float + spent`, and globally
   * `funded = float + earned_unsettled + settled` — a kudos is never minted,
   * never double-spent, never lost to rounding. */
  async function assertConservation(redis: Redis) {
    const profiles = await Promise.all(PROFILES.map((p) => readProfileAccount(p, redis)));
    const handles = await Promise.all(PROFILES.map((p) => readHandleAccount(p, redis)));

    for (const account of profiles) {
      expect(account.funded).toBe(account.float + account.spent);
      expect(Number.isSafeInteger(account.funded)).toBe(true);
      expect(account.float).toBeGreaterThanOrEqual(0);
    }
    for (const account of handles) {
      expect(account.earned).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(account.settled)).toBe(true);
    }

    const funded = profiles.reduce((sum, a) => sum + a.funded, 0);
    const float = profiles.reduce((sum, a) => sum + a.float, 0);
    const earned = handles.reduce((sum, a) => sum + a.earned, 0);
    const settled = handles.reduce((sum, a) => sum + a.settled, 0);
    expect(funded).toBe(float + earned + settled);
  }

  it("holds after every operation of a seeded 400-operation sequence", async () => {
    const redis = fakeRedis();
    const random = seededRandom(20260718);
    const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
    const amount = (max: number) => 1 + Math.floor(random() * max);

    for (let i = 0; i < 400; i++) {
      const giver = pick(PROFILES);
      const receiver = pick(PROFILES.filter((p) => p !== giver));
      const roll = random();

      if (roll < 0.2) {
        await fundFloat(giver, amount(500), redis);
      } else if (roll < 0.55) {
        // A complete duel: the debit crowns, the winner's author accrues the
        // full amount — one economic event, two ledger touches.
        const kudos = amount(60);
        const debit = await debitForDuel(giver, kudos, pick([DAY, "2026-07-19"]), redis);
        if (debit.kind === "recorded") await accrueEarned(receiver, kudos, redis);
      } else if (roll < 0.85) {
        const tip = amount(40);
        const debit = await debitForTip(giver, tip, redis);
        if (debit.kind === "recorded") await accrueEarned(receiver, tip, redis);
      } else {
        await markSettled(pick(PROFILES), amount(80), redis);
      }

      await assertConservation(redis);
    }
  });
});
