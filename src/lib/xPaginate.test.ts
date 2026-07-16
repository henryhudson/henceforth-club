import { describe, it, expect } from "vitest";
import { DEFAULT_MAX_PAGES, POSTS_PER_PAGE, fetchAllUserTweets } from "./xPaginate";

type Page = {
  data?: unknown[];
  includes?: { media?: unknown[] };
  meta?: { next_token?: string };
  ok?: boolean;
};

/** A fetch stub that returns each queued page in turn (default ok: true). */
function pagedFetch(pages: Page[], urls?: string[]): typeof fetch {
  let i = 0;
  return (async (url: string) => {
    urls?.push(url);
    const page = pages[i++] ?? { ok: false };
    return { ok: page.ok ?? true, json: async () => page } as Response;
  }) as typeof fetch;
}

/** A timeline that always offers another cursor — the shape that used to cost $16. */
function endlessFetch(counter: { calls: number }): typeof fetch {
  return (async () => {
    counter.calls += 1;
    return {
      ok: true,
      json: async () => ({
        data: Array.from({ length: POSTS_PER_PAGE }, (_, i) => ({ id: `${counter.calls}-${i}` })),
        meta: { next_token: "always-another" },
      }),
    } as Response;
  }) as typeof fetch;
}

// The pagination MECHANICS. These pass an explicit page budget: before 2026-07-08
// the default was X's 32-page ceiling, which meant one unauthenticated request
// could read 3,200 posts and cost sixteen dollars.
describe("fetchAllUserTweets mechanics", () => {
  it("accumulates tweets across pages until there is no next_token", async () => {
    const fetchFn = pagedFetch([
      { data: [{ id: "1" }, { id: "2" }], meta: { next_token: "A" } },
      { data: [{ id: "3" }], meta: {} },
    ]);
    const { data } = await fetchAllUserTweets<{ id: string }>("u", "t", "tweet.fields=created_at", fetchFn, 2);
    expect(data.map((t) => t.id)).toEqual(["1", "2", "3"]);
  });

  it("requests 100 per page and passes the pagination_token on later pages", async () => {
    const urls: string[] = [];
    const fetchFn = pagedFetch(
      [
        { data: [{ id: "1" }], meta: { next_token: "TOKEN123" } },
        { data: [{ id: "2" }], meta: {} },
      ],
      urls,
    );
    await fetchAllUserTweets("u", "t", "tweet.fields=x", fetchFn, 2);
    expect(urls[0]).toContain("max_results=100");
    expect(urls[0]).not.toContain("pagination_token");
    expect(urls[1]).toContain("pagination_token=TOKEN123");
  });

  it("threads since_id onto EVERY page of a bounded read", async () => {
    // The bound is what stops a full re-archive re-reading (and re-paying X
    // for) posts already on chain. It must ride every page, not just the
    // first — a cursor without the bound would walk back into paid-for
    // territory on page two.
    const urls: string[] = [];
    const fetchFn = pagedFetch(
      [
        { data: [{ id: "9" }], meta: { next_token: "MORE" } },
        { data: [{ id: "8" }], meta: {} },
      ],
      urls,
    );
    await fetchAllUserTweets("u", "t", "tweet.fields=x", fetchFn, 2, "12345");
    expect(urls[0]).toContain("since_id=12345");
    expect(urls[1]).toContain("since_id=12345");
  });

  it("omits since_id entirely when no bound is given", async () => {
    const urls: string[] = [];
    const fetchFn = pagedFetch([{ data: [{ id: "1" }], meta: {} }], urls);
    await fetchAllUserTweets("u", "t", "tweet.fields=x", fetchFn, 1);
    expect(urls[0]).not.toContain("since_id");
  });

  it("accumulates media includes across pages", async () => {
    const fetchFn = pagedFetch([
      { data: [{ id: "1" }], includes: { media: [{ media_key: "m1" }] }, meta: { next_token: "A" } },
      { data: [{ id: "2" }], includes: { media: [{ media_key: "m2" }] }, meta: {} },
    ]);
    const { media } = await fetchAllUserTweets("u", "t", "x", fetchFn, 2);
    expect((media as { media_key: string }[]).map((m) => m.media_key)).toEqual(["m1", "m2"]);
  });

  it("stops on a non-ok response and keeps what it already gathered", async () => {
    const fetchFn = pagedFetch([{ data: [{ id: "1" }], meta: { next_token: "A" } }, { ok: false }]);
    const { data } = await fetchAllUserTweets<{ id: string }>("u", "t", "x", fetchFn, 2);
    expect(data.map((t) => t.id)).toEqual(["1"]);
  });
});

// The COST cap. X bills per resource returned, so a page is the unit of money.
describe("fetchAllUserTweets page cap", () => {
  it("reads ONE page by default, however many the timeline offers", async () => {
    const counter = { calls: 0 };
    const { data } = await fetchAllUserTweets("u", "t", "", endlessFetch(counter));
    expect(DEFAULT_MAX_PAGES).toBe(1);
    expect(counter.calls).toBe(1);
    expect(data).toHaveLength(POSTS_PER_PAGE);
  });

  it("a default call can never cost more than one page — 100 resources, fifty cents", async () => {
    const counter = { calls: 0 };
    const { data } = await fetchAllUserTweets("u", "t", "", endlessFetch(counter));
    expect(data.length * 0.005).toBeCloseTo(0.5);
  });

  it("reads more only when a caller asks for more", async () => {
    const counter = { calls: 0 };
    await fetchAllUserTweets("u", "t", "", endlessFetch(counter), 3);
    expect(counter.calls).toBe(3);
  });

  it("clamps to X's own 32-page ceiling, so a bad number cannot loop forever", async () => {
    const counter = { calls: 0 };
    await fetchAllUserTweets("u", "t", "", endlessFetch(counter), 9999);
    expect(counter.calls).toBe(32);
  });

  it("clamps zero or negative up to one page rather than silently reading nothing", async () => {
    const counter = { calls: 0 };
    await fetchAllUserTweets("u", "t", "", endlessFetch(counter), 0);
    expect(counter.calls).toBe(1);
  });
});
