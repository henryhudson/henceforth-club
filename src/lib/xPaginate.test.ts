import { describe, it, expect } from "vitest";
import { fetchAllUserTweets } from "./xPaginate";

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

describe("fetchAllUserTweets", () => {
  it("accumulates tweets across pages until there is no next_token", async () => {
    const fetchFn = pagedFetch([
      { data: [{ id: "1" }, { id: "2" }], meta: { next_token: "A" } },
      { data: [{ id: "3" }], meta: {} },
    ]);
    const { data } = await fetchAllUserTweets<{ id: string }>("u", "t", "tweet.fields=created_at", fetchFn);
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
    await fetchAllUserTweets("u", "t", "tweet.fields=x", fetchFn);
    expect(urls[0]).toContain("max_results=100");
    expect(urls[0]).not.toContain("pagination_token");
    expect(urls[1]).toContain("pagination_token=TOKEN123");
  });

  it("accumulates media includes across pages", async () => {
    const fetchFn = pagedFetch([
      { data: [{ id: "1" }], includes: { media: [{ media_key: "m1" }] }, meta: { next_token: "A" } },
      { data: [{ id: "2" }], includes: { media: [{ media_key: "m2" }] }, meta: {} },
    ]);
    const { media } = await fetchAllUserTweets("u", "t", "x", fetchFn);
    expect((media as { media_key: string }[]).map((m) => m.media_key)).toEqual(["m1", "m2"]);
  });

  it("stops on a non-ok response and keeps what it already gathered", async () => {
    const fetchFn = pagedFetch([
      { data: [{ id: "1" }], meta: { next_token: "A" } },
      { ok: false },
    ]);
    const { data } = await fetchAllUserTweets<{ id: string }>("u", "t", "x", fetchFn);
    expect(data.map((t) => t.id)).toEqual(["1"]);
  });
});
