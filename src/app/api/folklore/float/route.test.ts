import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthenticateBearer = vi.fn();
const mockReadFloat = vi.fn();

vi.mock("@/lib/kudos/auth", () => ({
  authenticateBearer: (...args: unknown[]) => mockAuthenticateBearer(...args),
}));
vi.mock("@/lib/kudos/float", () => ({
  readFloat: (...args: unknown[]) => mockReadFloat(...args),
}));

import { GET } from "./route";

const request = () => new Request("http://x/api/folklore/float");

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("KUDOS_ENABLED", "true");
  mockAuthenticateBearer.mockReset();
  mockReadFloat.mockReset();
  mockAuthenticateBearer.mockResolvedValue({
    kind: "authenticated",
    profile: "henry",
    token: "token-abc",
  });
  mockReadFloat.mockResolvedValue(1500);
});

describe("GET /api/folklore/float", () => {
  it("refuses cleanly while KUDOS_ENABLED is not exactly \"true\" — nothing kudos-shaped is reachable", async () => {
    vi.stubEnv("KUDOS_ENABLED", "");
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "not-available" });
    expect(mockAuthenticateBearer).not.toHaveBeenCalled();

    vi.stubEnv("KUDOS_ENABLED", "1");
    expect((await GET(request())).status).toBe(503);
  });

  it("answers the bearer's own balance", async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, profile: "henry", float: 1500 });
    expect(mockReadFloat).toHaveBeenCalledWith("henry");
  });

  it("refuses a request with no bearer token", async () => {
    mockAuthenticateBearer.mockResolvedValue({ kind: "no-token" });
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, reason: "no-token" });
    expect(mockReadFloat).not.toHaveBeenCalled();
  });

  it("refuses a token the platform never issued", async () => {
    mockAuthenticateBearer.mockResolvedValue({ kind: "unknown-token" });
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, reason: "unknown-token" });
  });

  it("reports unavailable when Redis is not configured", async () => {
    mockAuthenticateBearer.mockResolvedValue({ kind: "unavailable" });
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "unavailable" });
  });
});
