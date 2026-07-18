import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import { authenticateBearer, bearerToken } from "./auth";

/** A minimal in-memory stand-in for the Upstash client — token resolution is
 * one `get` on `kudos:token:<token>`. */
function fakeRedis(tokens: Record<string, string>): Redis {
  return {
    get: async (key: string) => tokens[key] ?? null,
  } as unknown as Redis;
}

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/folklore/float", { headers });
}

describe("bearerToken — where the token rides", () => {
  it("reads an Authorization bearer header, case-insensitively", () => {
    expect(bearerToken(request({ authorization: "Bearer abc123" }))).toBe("abc123");
    expect(bearerToken(request({ authorization: "bearer abc123" }))).toBe("abc123");
  });

  it("reads the kudos_token cookie among other cookies", () => {
    expect(
      bearerToken(request({ cookie: "board_session=zzz; kudos_token=abc123; other=1" })),
    ).toBe("abc123");
  });

  it("prefers the header over the cookie — the pasted recovery string wins", () => {
    expect(
      bearerToken(
        request({ authorization: "Bearer fromheader", cookie: "kudos_token=fromcookie" }),
      ),
    ).toBe("fromheader");
  });

  it("is null with no header and no cookie, and for a malformed header", () => {
    expect(bearerToken(request())).toBeNull();
    expect(bearerToken(request({ authorization: "Basic abc" }))).toBeNull();
    expect(bearerToken(request({ cookie: "other=1" }))).toBeNull();
  });
});

describe("authenticateBearer", () => {
  it("authenticates a known token to its profile", async () => {
    const redis = fakeRedis({ "kudos:token:abc123": "henry" });
    const result = await authenticateBearer(request({ authorization: "Bearer abc123" }), redis);
    expect(result).toEqual({ kind: "authenticated", profile: "henry", token: "abc123" });
  });

  it("reports no-token when the request carries none — even without Redis", async () => {
    expect(await authenticateBearer(request(), null)).toEqual({ kind: "no-token" });
  });

  it("reports unknown-token for a token Redis has never issued", async () => {
    const redis = fakeRedis({});
    const result = await authenticateBearer(request({ authorization: "Bearer nope" }), redis);
    expect(result).toEqual({ kind: "unknown-token" });
  });

  it("reports unavailable when a token is presented but Redis is not configured", async () => {
    const result = await authenticateBearer(request({ authorization: "Bearer abc" }), null);
    expect(result).toEqual({ kind: "unavailable" });
  });
});
