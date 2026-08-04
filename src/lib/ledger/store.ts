import { getRedis } from "@/lib/redis";
import { PERIODS } from "./periods";
import type { Commit, Transaction } from "./types";

// The only module in src/lib/ledger that performs input or output. It is kept
// deliberately free of logic: everything worth asserting lives in money.ts,
// periods.ts, validate.ts and merkle.ts, all of which are testable without a
// store. Testing this file would mean mocking Redis, which would assert only
// that the mock was called.

const TRANSACTIONS_KEY = "ledger:transactions";
const commitKey = (periodId: string) => `ledger:commit:${periodId}`;

export async function loadTransactions(): Promise<Transaction[]> {
  const redis = getRedis();
  if (!redis) return [];
  return (await redis.get<Transaction[]>(TRANSACTIONS_KEY)) ?? [];
}

export async function saveTransactions(list: Transaction[]): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("no store configured");
  await redis.set(TRANSACTIONS_KEY, list);
}

export async function loadCommit(periodId: string): Promise<Commit | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get<Commit>(commitKey(periodId))) ?? null;
}

export async function saveCommit(commit: Commit): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("no store configured");
  await redis.set(commitKey(commit.periodId), commit);
}

/** Commitments keyed by period identifier; periods with none are absent. */
export async function loadAllCommits(): Promise<Record<string, Commit>> {
  const entries = await Promise.all(
    PERIODS.map(async (p) => [p.id, await loadCommit(p.id)] as const),
  );
  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, Commit] => entry[1] !== null),
  );
}
