import { describe, it, expect } from "vitest";
import * as logout from "./route";

// Regression pin for the 2026-07-05 session-drop bug: the navbar's Sign out was
// a <Link> to a cookie-clearing GET, and the router's Link prefetch executed it —
// signing the user out on page render, never on click. State changes live on
// POST, which nothing prefetches.
describe("board logout route", () => {
  it("exports no GET — a prefetchable GET that clears cookies signs users out on Link prefetch", () => {
    expect("GET" in logout).toBe(false);
  });

  it("POST clears both board cookies", async () => {
    const res = await logout.POST(
      new Request("https://henceforth.club/board/logout", { method: "POST" }),
    );
    const cookies = res.headers.getSetCookie();
    expect(
      cookies.some((c) => c.startsWith("board_session=;") && c.toLowerCase().includes("max-age=0")),
    ).toBe(true);
    expect(
      cookies.some((c) => c.startsWith("board_signed_in=;") && c.toLowerCase().includes("max-age=0")),
    ).toBe(true);
  });

  it("POST redirects home with 303 so the browser follows with a GET (not a re-POST)", async () => {
    const res = await logout.POST(
      new Request("https://henceforth.club/board/logout", { method: "POST" }),
    );
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location") ?? "", "https://henceforth.club").pathname).toBe("/");
  });
});
