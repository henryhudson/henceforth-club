import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/lib/board-auth";

// The redis store and the cookie jar are faked; the SESSION CHECK is the real
// verifySession over a real HMAC, so the gate is proved against the
// cryptography rather than against a stub of it.
const store = new Map<string, unknown>();
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({ get: async (key: string) => store.get(key) ?? null }),
}));

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "board_session" && cookieValue !== undefined
        ? { value: cookieValue }
        : undefined,
  }),
}));

import { GET } from "./route";

const SECRET = "test-cookie-secret";
const PDF_BYTES = "%PDF-1.4 not a real filing";

function call(year = "2024", slug = "ct600") {
  return GET(new Request(`https://henceforth.club/board/taxes/${year}/${slug}`), {
    params: Promise.resolve({ year, slug }),
  });
}

describe("board taxes document route", () => {
  beforeEach(async () => {
    process.env.BOARD_COOKIE_SECRET = SECRET;
    store.clear();
    store.set("board:taxes:file:2024:ct600", {
      name: "HENCEFORTH_BITCOIN_LIMITED_CT6002024.pdf",
      b64: Buffer.from(PDF_BYTES).toString("base64"),
    });
    // The index is what the listing page renders from, and it is now also what
    // decides whether a document may be served at all.
    store.set("board:taxes:index", {
      generated: "2026-08-02T00:00:00.000Z",
      periods: [
        {
          year: "2024",
          period: "1 February 2024 to 31 December 2024",
          files: [{ slug: "ct600", name: "HENCEFORTH_BITCOIN_LIMITED_CT6002024.pdf", title: "CT600" }],
        },
      ],
    });
    cookieValue = await createSession(SECRET, 60_000);
  });

  it("rejects a request with no session cookie", async () => {
    cookieValue = undefined;
    expect((await call()).status).toBe(401);
  });

  it("rejects a token signed with a different secret", async () => {
    cookieValue = await createSession("some-other-secret", 60_000);
    expect((await call()).status).toBe(401);
  });

  it("rejects an expired token even with the right signature", async () => {
    cookieValue = await createSession(SECRET, -1);
    expect((await call()).status).toBe(401);
  });

  it("404s a signed-in request for a document that is not published", async () => {
    expect((await call("2024", "nonexistent")).status).toBe(404);
  });

  it("serves the PDF privately and uncacheably to a signed-in request", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(PDF_BYTES);
  });

  // Unpublishing must actually unpublish. The publisher only ever writes, so
  // removing a filing from the source folder rewrites the index without it and
  // leaves the document key behind forever. Serving from the key alone meant
  // the document stayed retrievable at its URL after it had been withdrawn.
  it("refuses a document the index no longer lists, even though its key survives", async () => {
    store.set("board:taxes:index", {
      generated: "2026-08-02T00:00:00.000Z",
      periods: [{ year: "2024", period: "…", files: [] }],
    });
    expect((await call()).status).toBe(404);
  });

  it("refuses every document when the index is missing entirely", async () => {
    // Fail closed: no index means the question "is this published?" cannot be
    // answered, and an unanswered question must not serve a private filing.
    store.delete("board:taxes:index");
    expect((await call()).status).toBe(404);
  });

  // Both accounting periods contain a file called
  // HENCEFORTH_BITCOIN_LIMITED_CT6002024.pdf, and they are genuinely different
  // documents. Saving both links wrote one over the other.
  it("qualifies the download filename with the period so the two CT600s do not collide", async () => {
    const res = await call("2024", "ct600");
    expect(res.headers.get("Content-Disposition")).toContain(
      'filename="2024-HENCEFORTH_BITCOIN_LIMITED_CT6002024.pdf"',
    );
  });
});
