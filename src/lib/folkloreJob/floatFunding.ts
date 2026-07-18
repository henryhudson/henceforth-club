// The £2 leg landing as kudos: when a paid archive job completes, the
// buyer's float funds with FLOAT_KUDOS (2,000) and an opaque bearer token
// issues — the profile's only identity, set as a cookie and shown once as a
// recovery string. Thin Redis edge in the house style: null-Redis answers as
// values, never throws; randomness is a parameter.
//
// Exactly-once by construction: the issue is claimed with a single atomic
// set-if-absent on the job id before anything is credited. Claim then fund,
// in that order — a crash between the two can only leave a claim without its
// credit (visible in the books as an issue marker with no funded counter,
// healable by reconcile), never a float funded twice, which would be minting.

import type { Redis } from "@upstash/redis";
import { getRedis } from "@/lib/redis";
import { FLOAT_KUDOS } from "@/lib/kudos/constants";
import { fundFloat } from "@/lib/kudos/float";
import type { TextJob } from "./jobs";

const issueKey = (jobId: string) => `kudos:issue:${jobId}`;
const tokenKey = (token: string) => `kudos:token:${token}`;

export type IssueFloatResult =
  | { kind: "issued"; token: string; kudos: number }
  | { kind: "already-issued" }
  | { kind: "no-float-leg" }
  | { kind: "unavailable" };

type PricedJob = Pick<TextJob, "jobId" | "handle" | "feeSats" | "premiumSats" | "priceSats">;

/**
 * The £2 leg derived from the untouched record schema: price minus fee minus
 * premium. Exactly zero for a £1-era record (fee plus premium was the whole
 * price), exactly the float leg for a £2-era one; a corrupt or incomplete
 * decomposition reads as no leg rather than a negative or NaN amount.
 */
export function floatLegSats(job: Pick<PricedJob, "feeSats" | "premiumSats" | "priceSats">): number {
  const { feeSats, premiumSats, priceSats } = job;
  if (![feeSats, premiumSats, priceSats].every(Number.isSafeInteger)) return 0;
  const leg = priceSats - feeSats - premiumSats;
  return leg > 0 ? leg : 0;
}

/** An opaque 128-bit bearer token, hex-encoded — the recovery string is this
 * token verbatim. Injected in tests; never called inside pure code. */
function defaultRecoveryToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fund a completed job's kudos float, exactly once. The caller gates on the
 * job being done and on KUDOS_ENABLED — this function owns only the money
 * movement and its idempotence.
 */
export async function issueFloatOnCompletion(
  job: PricedJob,
  randomToken: () => string = defaultRecoveryToken,
  redis: Redis | null = getRedis(),
): Promise<IssueFloatResult> {
  if (floatLegSats(job) <= 0) return { kind: "no-float-leg" };
  if (!redis) return { kind: "unavailable" };

  const token = randomToken();
  const claimed = await redis.set(issueKey(job.jobId), token, { nx: true });
  if (claimed === null) return { kind: "already-issued" };

  const profile = job.handle.toLowerCase();
  await redis.set(tokenKey(token), profile);
  await fundFloat(profile, FLOAT_KUDOS, redis);
  return { kind: "issued", token, kudos: FLOAT_KUDOS };
}
