import { beforeEach, describe, expect, it, vi } from "vitest";

let fake: {
  get: ReturnType<typeof vi.fn>;
  mget: ReturnType<typeof vi.fn>;
} | null = null;

vi.mock("@/lib/redis", () => ({
  getRedis: () => fake,
  dateKey: (d: Date = new Date()) => d.toISOString().slice(0, 10),
}));

import { GET } from "./route";

describe("GET /api/stats", () => {
  beforeEach(() => {
    fake = {
      get: vi.fn(async () => {
        throw new Error("stats must not GET one key at a time");
      }),
      mget: vi.fn(async (...keys: string[]) => keys.map((_, i) => (i === 0 ? 12 : 0))),
    };
  });

  it("reads the year of counters in one MGET, never 366 GETs", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.total).toBe(12);
    expect(fake?.get).not.toHaveBeenCalled();
    expect(fake?.mget).toHaveBeenCalledTimes(1);
    const keys = fake?.mget.mock.calls[0] ?? [];
    expect(keys[0]).toBe("views:total");
    expect(keys).toHaveLength(366);
  });
});
