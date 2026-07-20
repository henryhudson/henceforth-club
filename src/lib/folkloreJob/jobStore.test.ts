import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedExport } from "./parseExport";
import type { Quote } from "./quote";
import { MAX_CONCURRENT_JOBS, QUOTE_EXPIRY_MINUTES, RESERVED_ARCHIVE_JOBS } from "./constants";
import { createJob, getJob, getPayload, advance, listJobsInState } from "./jobStore";

// A fake Redis good enough to exercise jobStore's real logic: get/set/del,
// a keys() scan (jobStore never uses a secondary index — the job count is
// always tiny), and an eval() that reimplements the same compare-and-swap
// contract the guarded write script asks the real server to run atomically.
function makeFakeRedis() {
  const store = new Map<string, unknown>();
  return {
    store,
    async get<T>(key: string): Promise<T | null> {
      return store.has(key) ? (structuredClone(store.get(key)) as T) : null;
    },
    async set(key: string, value: unknown): Promise<"OK"> {
      store.set(key, structuredClone(value));
      return "OK";
    },
    async del(key: string): Promise<number> {
      return store.delete(key) ? 1 : 0;
    },
    async keys(pattern: string): Promise<string[]> {
      const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    },
    async mget<T>(...keys: string[]): Promise<T> {
      return keys.map((k) => (store.has(k) ? structuredClone(store.get(k)) : null)) as unknown as T;
    },
    async eval<TArgs extends unknown[], TData>(
      _script: string,
      keys: string[],
      args: TArgs,
    ): Promise<TData> {
      const [key] = keys;
      const [nextValueJson, expectedVersionStr] = args as unknown as [string, string];
      const current = store.get(key) as { version: number } | undefined;
      if (!current || current.version !== Number(expectedVersionStr)) {
        return 0 as unknown as TData;
      }
      store.set(key, JSON.parse(nextValueJson));
      return 1 as unknown as TData;
    },
  };
}

let fakeRedis: ReturnType<typeof makeFakeRedis> | null = null;

vi.mock("@/lib/redis", () => ({
  getRedis: () => fakeRedis,
}));

beforeEach(() => {
  fakeRedis = makeFakeRedis();
});

function parsedFixture(handle = "henry"): Extract<ParsedExport, { ok: true }> {
  return {
    ok: true,
    handle,
    archive: { v: 1, source: "x", handle, profile: {}, posts: [] },
    archiveBytes: 100,
    contentHash: "hash123",
  };
}

/** What a route hands createJob: the parsed export plus the durable `kind`
 * the worker will classify by. */
function archiveInput(handle = "henry") {
  return { ...parsedFixture(handle), kind: "archive" as const };
}

const quoteFixture: Quote = { feeSats: 500, premiumSats: 9_290_000, priceSats: 9_290_500 };
const NOW = 1_700_000_000_000;

describe("createJob", () => {
  it("creates a job in the quoted state with expiry from constants, and stores the archive payload", async () => {
    const result = await createJob(archiveInput(), quoteFixture, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("quoted");
    expect(result.job.handle).toBe("henry");
    expect(result.job.contentHash).toBe("hash123");
    expect(result.job.feeSats).toBe(500);
    expect(result.job.premiumSats).toBe(9_290_000);
    expect(result.job.priceSats).toBe(9_290_500);
    expect(result.job.createdAtMs).toBe(NOW);
    expect(result.job.expiresAtMs).toBe(NOW + QUOTE_EXPIRY_MINUTES * 60_000);
    expect(result.job.jobId).toEqual(expect.any(String));

    const stored = await getJob(result.job.jobId);
    expect(stored).toEqual(result.job);

    const payload = await fakeRedis?.get(`x:job:payload:${result.job.jobId}`);
    expect(payload).toEqual(parsedFixture().archive);
  });

  it("refuses at MAX_CONCURRENT_JOBS active jobs (quoted/awaiting-payment/funded/inscribed)", async () => {
    for (let i = 0; i < MAX_CONCURRENT_JOBS; i++) {
      const r = await createJob(archiveInput(), quoteFixture, NOW);
      expect(r.ok).toBe(true);
    }
    const result = await createJob(archiveInput(), quoteFixture, NOW);
    expect(result).toEqual({ ok: false, refused: "at-capacity" });
  });

  it("does not count sweeping jobs toward capacity", async () => {
    for (let i = 0; i < MAX_CONCURRENT_JOBS; i++) {
      const created = await createJob(archiveInput(), quoteFixture, NOW);
      if (!created.ok) throw new Error("expected ok");
      const published = await advance(created.job.jobId, { kind: "key-published", address: "1Addr" }, NOW);
      if (!published.ok) throw new Error("expected ok");
      const expired = await advance(created.job.jobId, { kind: "expired", residueSats: 100 }, NOW);
      if (!expired.ok) throw new Error("expected ok");
      expect(expired.job.state).toBe("sweeping");
    }
    const result = await createJob(archiveInput(), quoteFixture, NOW);
    expect(result.ok).toBe(true);
  });
});

describe("the free submit path can never take the last slot", () => {
  /** What the link route hands createJob: a validated folklore record, opened
   * with no auth, no payment and no artifact behind it. */
  const folkloreInput = () => ({
    kind: "folklore" as const,
    handle: "",
    contentHash: "hash-link",
    archive: {
      v: 1 as const,
      app: "folklore" as const,
      kind: "link" as const,
      url: "https://example.com/a",
      title: "A title",
    },
  });

  it("holds RESERVED_ARCHIVE_JOBS slots back however hard the free path floods", async () => {
    // THE PROPERTY. Not "an allowance is smaller than the ceiling" — that is
    // arithmetic against an unknown number of addresses, and two addresses
    // exhaust the ceiling exactly. This is a guarantee: whatever the free path
    // does, from any number of buckets, the archive path still has slots.
    let admitted = 0;
    for (let i = 0; i < MAX_CONCURRENT_JOBS * 3; i += 1) {
      if ((await createJob(folkloreInput(), quoteFixture, NOW)).ok) admitted += 1;
    }
    expect(admitted).toBe(MAX_CONCURRENT_JOBS - RESERVED_ARCHIVE_JOBS);

    // The paid submission this pipeline exists for is quoted as if the flood
    // had never happened — and so is the next one.
    for (let i = 0; i < RESERVED_ARCHIVE_JOBS; i += 1) {
      expect((await createJob(archiveInput(), quoteFixture, NOW)).ok).toBe(true);
    }
  });

  it("refuses the free submit as at-capacity, the refusal its route already relays", async () => {
    for (let i = 0; i < MAX_CONCURRENT_JOBS - RESERVED_ARCHIVE_JOBS; i += 1) {
      expect((await createJob(folkloreInput(), quoteFixture, NOW)).ok).toBe(true);
    }
    expect(await createJob(folkloreInput(), quoteFixture, NOW)).toEqual({
      ok: false,
      refused: "at-capacity",
    });
  });

  it("leaves the archive path's own ceiling exactly where it was", async () => {
    // The reserve is one-directional: it holds slots back FROM the free path,
    // and never takes any from the paid one.
    for (let i = 0; i < MAX_CONCURRENT_JOBS; i += 1) {
      expect((await createJob(archiveInput(), quoteFixture, NOW)).ok).toBe(true);
    }
    expect(await createJob(archiveInput(), quoteFixture, NOW)).toEqual({
      ok: false,
      refused: "at-capacity",
    });
  });

  it("releases a free slot when its job finishes, like any other", async () => {
    const created = await createJob(folkloreInput(), quoteFixture, NOW);
    if (!created.ok) throw new Error("expected ok");
    await createJob(folkloreInput(), quoteFixture, NOW);
    expect((await createJob(folkloreInput(), quoteFixture, NOW)).ok).toBe(false);

    const published = await advance(created.job.jobId, { kind: "key-published", address: "1Addr" }, NOW);
    if (!published.ok) throw new Error("expected ok");
    const expired = await advance(created.job.jobId, { kind: "expired", residueSats: 100 }, NOW);
    if (!expired.ok) throw new Error("expected ok");
    expect(expired.job.state).toBe("sweeping");

    expect((await createJob(folkloreInput(), quoteFixture, NOW)).ok).toBe(true);
  });
});

describe("getJob", () => {
  it("returns null for a job that does not exist", async () => {
    expect(await getJob("no-such-job")).toBeNull();
  });
});

describe("getPayload", () => {
  it("returns the archive stored at createJob", async () => {
    const created = await createJob(archiveInput(), quoteFixture, NOW);
    if (!created.ok) throw new Error("expected ok");
    expect(await getPayload(created.job.jobId)).toEqual(parsedFixture().archive);
  });

  it("returns null for a job that does not exist", async () => {
    expect(await getPayload("no-such-job")).toBeNull();
  });

  it("returns null once the job's payload has been deleted (reaches done)", async () => {
    const created = await createJob(archiveInput(), quoteFixture, NOW);
    if (!created.ok) throw new Error("expected ok");
    const id = created.job.jobId;

    await advance(id, { kind: "key-published", address: "1Addr" }, NOW);
    await advance(id, { kind: "payment-seen", txid: "tx1", vout: 0, sats: 9_290_500, refundAddress: "1R" }, NOW);
    await advance(id, { kind: "inscribed", txid: "inscribetx" }, NOW);
    await advance(id, { kind: "registered" }, NOW);

    expect(await getPayload(id)).toBeNull();
  });

  it("returns null when Redis isn't configured", async () => {
    fakeRedis = null;
    expect(await getPayload("any")).toBeNull();
  });
});

describe("advance", () => {
  it("applies the event and persists the transition", async () => {
    const created = await createJob(archiveInput(), quoteFixture, NOW);
    if (!created.ok) throw new Error("expected ok");

    const result = await advance(created.job.jobId, { kind: "key-published", address: "1Addr" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("awaiting-payment");
    expect(result.job.address).toBe("1Addr");

    const stored = await getJob(created.job.jobId);
    expect(stored).toEqual(result.job);
  });

  it("refuses advancing a job id that does not exist", async () => {
    const result = await advance("no-such-job", { kind: "key-published", address: "1Addr" }, NOW);
    expect(result).toEqual({ ok: false, refused: "not-found" });
  });

  it("refuses an invalid transition without mutating the stored job", async () => {
    const created = await createJob(archiveInput(), quoteFixture, NOW);
    if (!created.ok) throw new Error("expected ok");

    const rejected = await advance(created.job.jobId, { kind: "registered" }, NOW);
    expect(rejected.ok).toBe(false);

    // The failed transition must not have bumped the version — a valid
    // transition from the original state still succeeds afterward.
    const result = await advance(created.job.jobId, { kind: "key-published", address: "1Addr" }, NOW);
    expect(result.ok).toBe(true);
  });

  it("deletes the archive payload once the job reaches done", async () => {
    const created = await createJob(archiveInput(), quoteFixture, NOW);
    if (!created.ok) throw new Error("expected ok");
    const id = created.job.jobId;

    await advance(id, { kind: "key-published", address: "1Addr" }, NOW);
    await advance(id, { kind: "payment-seen", txid: "tx1", vout: 0, sats: 9_290_500, refundAddress: "1R" }, NOW);
    await advance(id, { kind: "inscribed", txid: "inscribetx" }, NOW);
    expect(await fakeRedis?.get(`x:job:payload:${id}`)).not.toBeNull();

    const done = await advance(id, { kind: "registered" }, NOW);
    expect(done.ok).toBe(true);
    expect(await fakeRedis?.get(`x:job:payload:${id}`)).toBeNull();
  });

  it("deletes the archive payload once the job reaches swept", async () => {
    const created = await createJob(archiveInput(), quoteFixture, NOW);
    if (!created.ok) throw new Error("expected ok");
    const id = created.job.jobId;

    await advance(id, { kind: "key-published", address: "1Addr" }, NOW);
    const swept = await advance(id, { kind: "expired", residueSats: 0 }, NOW);
    expect(swept.ok).toBe(true);
    expect(await fakeRedis?.get(`x:job:payload:${id}`)).toBeNull();
  });

  it("guards two interleaved advances with the version field — the second is refused, and a re-read shows only the first's transition", async () => {
    const created = await createJob(archiveInput(), quoteFixture, NOW);
    if (!created.ok) throw new Error("expected ok");
    const id = created.job.jobId;

    // Both calls start from the same stored version; without the guard the
    // second would clobber the first's write with a stale read.
    const [first, second] = await Promise.all([
      advance(id, { kind: "key-published", address: "1First" }, NOW),
      advance(id, { kind: "key-published", address: "1Second" }, NOW),
    ]);

    const outcomes = [first, second];
    const succeeded = outcomes.filter((r) => r.ok);
    const refused = outcomes.filter((r) => !r.ok);
    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(1);

    const stored = await getJob(id);
    expect(stored?.state).toBe("awaiting-payment");
    // Whichever write actually landed is the one the re-read reflects —
    // no interleaved, part-first-part-second corruption.
    const winner = succeeded[0];
    if (!winner.ok) throw new Error("expected ok");
    expect(stored?.address).toBe(winner.job.address);
  });
});

describe("listJobsInState", () => {
  it("lists only jobs currently in the given state", async () => {
    const a = await createJob(archiveInput("alice"), quoteFixture, NOW);
    const b = await createJob(archiveInput("bob"), quoteFixture, NOW);
    if (!a.ok || !b.ok) throw new Error("expected ok");
    await advance(a.job.jobId, { kind: "key-published", address: "1Addr" }, NOW);

    const quoted = await listJobsInState("quoted");
    const awaiting = await listJobsInState("awaiting-payment");
    expect(quoted.map((j) => j.jobId)).toEqual([b.job.jobId]);
    expect(awaiting.map((j) => j.jobId)).toEqual([a.job.jobId]);
  });

  it("returns an empty list for a state with no jobs", async () => {
    expect(await listJobsInState("done")).toEqual([]);
  });
});

describe("when Redis isn't configured", () => {
  beforeEach(() => {
    fakeRedis = null;
  });

  it("refuses to create, and read/list calls answer empty rather than throw", async () => {
    const created = await createJob(archiveInput(), quoteFixture, NOW);
    expect(created).toEqual({ ok: false, refused: "store-unavailable" });
    expect(await getJob("any")).toBeNull();
    expect(await listJobsInState("quoted")).toEqual([]);
    const advanced = await advance("any", { kind: "registered" }, NOW);
    expect(advanced).toEqual({ ok: false, refused: "store-unavailable" });
  });
});
