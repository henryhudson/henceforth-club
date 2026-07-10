// The Upstash skin around the pure job state machine (jobs.ts). Every
// function here follows the house null-Redis convention: when Redis isn't
// configured, a read answers empty (null / []) and a write refuses as a
// value — nothing throws.

import { getRedis } from "@/lib/redis";
import { applyEvent, type JobEvent, type JobState, type TextJob } from "./jobs";
import type { ParsedExport } from "./parseExport";
import type { Quote } from "./quote";
import { MAX_CONCURRENT_JOBS, QUOTE_EXPIRY_MINUTES } from "./constants";

type Redis = NonNullable<ReturnType<typeof getRedis>>;
type Ok = { ok: true; job: TextJob };
type Refused = { ok: false; refused: string };
type Archive = Extract<ParsedExport, { ok: true }>["archive"];

const JOB_PREFIX = "x:job:";
const PAYLOAD_PREFIX = "x:job:payload:";
const jobKey = (jobId: string) => `${JOB_PREFIX}${jobId}`;
const payloadKey = (jobId: string) => `${PAYLOAD_PREFIX}${jobId}`;

/** Jobs in these states still occupy one of the four concurrent custody
 * slots; sweeping/done/swept jobs have released (or are releasing) theirs. */
const ACTIVE_STATES: readonly JobState[] = ["quoted", "awaiting-payment", "funded", "inscribed"];

type StoredJob = TextJob & { version: number };

function stripVersion(stored: StoredJob): TextJob {
  const { version, ...job } = stored;
  void version;
  return job;
}

/**
 * Writes `next` to `key` only if the record stored there right now still
 * carries `expectedVersion` — the compare-and-swap that keeps two workers
 * from interleaving writes to the same job. Runs as one atomic script
 * server-side, so the check-then-set can't itself race.
 */
const guardedWriteScript = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local decoded = cjson.decode(current)
if decoded.version ~= tonumber(ARGV[2]) then return 0 end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`;

async function writeIfVersionMatches(
  redis: Redis,
  key: string,
  expectedVersion: number,
  next: StoredJob,
): Promise<boolean> {
  const wrote = await redis.eval<[string, string], number>(
    guardedWriteScript,
    [key],
    [JSON.stringify(next), String(expectedVersion)],
  );
  return wrote === 1;
}

/** Every job record currently in Redis. A plain key scan, not a secondary
 * index — MAX_CONCURRENT_JOBS keeps the live set tiny, so there is nothing
 * here worth indexing yet. */
async function allStoredJobs(redis: Redis): Promise<StoredJob[]> {
  const keys = await redis.keys(`${JOB_PREFIX}*`);
  const jobKeys = keys.filter((k) => !k.startsWith(PAYLOAD_PREFIX));
  if (jobKeys.length === 0) return [];
  const values = await redis.mget<(StoredJob | null)[]>(...jobKeys);
  return values.filter((v): v is StoredJob => v !== null);
}

export async function createJob(
  parsed: Extract<ParsedExport, { ok: true }>,
  quote: Quote,
  nowMs: number,
): Promise<Ok | { ok: false; refused: "at-capacity" | "store-unavailable" }> {
  const redis = getRedis();
  if (!redis) return { ok: false, refused: "store-unavailable" };

  const jobs = await allStoredJobs(redis);
  // This check and the write below are not atomic: two simultaneous creates can
  // both pass here and briefly overshoot MAX_CONCURRENT_JOBS. That is an
  // accepted exposure bound (a soft ceiling on live custody), not a consistency
  // invariant worth a lock — the worst case is one extra ephemeral job.
  const activeCount = jobs.filter((j) => ACTIVE_STATES.includes(j.state)).length;
  if (activeCount >= MAX_CONCURRENT_JOBS) {
    return { ok: false, refused: "at-capacity" };
  }

  const job: TextJob = {
    jobId: crypto.randomUUID(),
    handle: parsed.handle,
    contentHash: parsed.contentHash,
    feeSats: quote.feeSats,
    premiumSats: quote.premiumSats,
    priceSats: quote.priceSats,
    state: "quoted",
    createdAtMs: nowMs,
    expiresAtMs: nowMs + QUOTE_EXPIRY_MINUTES * 60_000,
  };

  await redis.set(jobKey(job.jobId), { ...job, version: 0 });
  await redis.set(payloadKey(job.jobId), parsed.archive);
  return { ok: true, job };
}

export async function getJob(jobId: string): Promise<TextJob | null> {
  const redis = getRedis();
  if (!redis) return null;
  const stored = await redis.get<StoredJob>(jobKey(jobId));
  return stored ? stripVersion(stored) : null;
}

export async function advance(jobId: string, event: JobEvent, nowMs: number): Promise<Ok | Refused> {
  const redis = getRedis();
  if (!redis) return { ok: false, refused: "store-unavailable" };

  const stored = await redis.get<StoredJob>(jobKey(jobId));
  if (!stored) return { ok: false, refused: "not-found" };

  const { version, ...job } = stored;
  const result = applyEvent(job, event, nowMs);
  if (!result.ok) return result;

  const wrote = await writeIfVersionMatches(redis, jobKey(jobId), version, {
    ...result.job,
    version: version + 1,
  });
  if (!wrote) return { ok: false, refused: "version-conflict" };

  if (result.job.state === "done" || result.job.state === "swept") {
    await redis.del(payloadKey(jobId));
  }

  return { ok: true, job: result.job };
}

/**
 * The archive payload stashed alongside a job at createJob — the exact bytes
 * the worker will inscribe. Never routed through the api routes (those never
 * return the archive itself); this is the worker's own read, so a `.mjs`
 * runner needs the same null-Redis convention as every other read here: an
 * unconfigured store, an unknown job, and an already-deleted payload (a job
 * that reached done or swept) are all just null, never a throw.
 */
export async function getPayload(jobId: string): Promise<Archive | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<Archive>(payloadKey(jobId));
}

export async function listJobsInState(state: JobState): Promise<TextJob[]> {
  const redis = getRedis();
  if (!redis) return [];
  const jobs = await allStoredJobs(redis);
  return jobs.filter((j) => j.state === state).map(stripVersion);
}
