// The Upstash skin around the pure job state machine (jobs.ts). Every
// function here follows the house null-Redis convention: when Redis isn't
// configured, a read answers empty (null / []) and a write refuses as a
// value — nothing throws.

import { getRedis } from "@/lib/redis";
import type { FolkloreRecord } from "@/app/folklore/linkRecord";
import { applyEvent, type JobEvent, type JobKind, type JobState, type TextJob } from "./jobs";
import type { EndowmentRecord } from "./pass";
import type { ParsedExport } from "./parseExport";
import type { Quote } from "./quote";
import { MAX_CONCURRENT_JOBS, QUOTE_EXPIRY_MINUTES, RESERVED_ARCHIVE_JOBS } from "./constants";

type Redis = NonNullable<ReturnType<typeof getRedis>>;
type Ok = { ok: true; job: TextJob };
type Refused = { ok: false; refused: string };
// A job's stashed payload: an archive from the export path, a single
// validated folklore record from the link board, or — since the endowed pass
// — the £3 endowment record. Same rails every way; what a job IS lives on
// the job record (`kind`), not in this payload, which is deleted the moment
// the job reaches done or swept.
type Archive = Extract<ParsedExport, { ok: true }>["archive"] | FolkloreRecord | EndowmentRecord;

const JOB_PREFIX = "x:job:";
const PAYLOAD_PREFIX = "x:job:payload:";
/** Set of job ids. Lives outside the `x:job:` prefix so a leftover KEYS scan
 * of that prefix cannot pick it up as a job record. */
const IDS_KEY = "x:jobs";
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

/** Every job record currently in Redis, via the id set — never KEYS.
 * The mini worker used to KEYS the prefix once per state per 15s tick
 * (eight scans, empty or not). That alone spent the 500,000-command month
 * in about eleven days with no visitors. */
async function allStoredJobs(redis: Redis): Promise<StoredJob[]> {
  const ids = await redis.smembers(IDS_KEY);
  if (ids.length === 0) return [];
  const values = await redis.mget<(StoredJob | null)[]>(...ids.map(jobKey));
  return values.filter((v): v is StoredJob => v !== null);
}

/**
 * One-time repair: copy leftover `x:job:<id>` keys into the id set when the
 * set is empty. The worker calls this at boot so jobs created before the
 * index existed are not stalled. An empty set with no leftover keys is a
 * real empty pipeline — KEYS is not repeated on the hot path.
 */
export async function backfillJobIndex(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const existing = await redis.smembers(IDS_KEY);
  if (existing.length > 0) return existing.length;
  const keys = await redis.keys(`${JOB_PREFIX}*`);
  const ids = keys
    .filter((k) => !k.startsWith(PAYLOAD_PREFIX))
    .map((k) => k.slice(JOB_PREFIX.length))
    .filter((id) => id.length > 0);
  if (ids.length === 0) return 0;
  await redis.sadd(IDS_KEY, ...ids);
  return ids.length;
}

export async function createJob(
  parsed: { kind: JobKind; handle: string; contentHash: string; archive: Archive; endowed?: boolean },
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
  const active = jobs.filter((j) => ACTIVE_STATES.includes(j.state));
  if (active.length >= MAX_CONCURRENT_JOBS) {
    return { ok: false, refused: "at-capacity" };
  }

  // The reservation, and the whole reason it is here rather than in the
  // route's allowance: a free submit can never take the last slot from a paid
  // one, whatever the number of addresses behind the flood. Free jobs are
  // counted against their own lower ceiling; the archive path's ceiling is
  // untouched, so it keeps exactly the capacity it always had.
  if (parsed.kind === "folklore") {
    const freeActive = active.filter((j) => j.kind === "folklore").length;
    if (freeActive >= MAX_CONCURRENT_JOBS - RESERVED_ARCHIVE_JOBS) {
      return { ok: false, refused: "at-capacity" };
    }
  }

  const job: TextJob = {
    jobId: crypto.randomUUID(),
    kind: parsed.kind,
    // The endowed marker is written once here and never changed — the worker
    // reads it to refuse the (not-yet-built) float-funded path, so it must
    // ride the record, not the deletable payload.
    ...(parsed.endowed ? { endowed: true as const } : {}),
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
  await redis.sadd(IDS_KEY, job.jobId);
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

/** Every job in one index read. The worker tick filters this snapshot eight
 * ways in memory instead of issuing eight Redis scans. */
export async function listAllJobs(): Promise<TextJob[]> {
  const redis = getRedis();
  if (!redis) return [];
  return (await allStoredJobs(redis)).map(stripVersion);
}
