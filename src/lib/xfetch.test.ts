import { describe, it, expect } from "vitest";
import {
  fetchProfileHead,
  fetchXArchive,
  pagesForPostCount,
  X_TIMELINE_CEILING,
  POSTS_PER_PAGE,
  type XProfileHead,
} from "./xfetch";
import { resourcesForPosts } from "./xGate";
import { resourcesToUsd } from "./xSpend";

describe("pagesForPostCount", () => {
  it("pages the whole timeline, and never past X's own ceiling", () => {
    expect(pagesForPostCount(0)).toBe(1); // an empty account still costs one read
    expect(pagesForPostCount(1)).toBe(1);
    expect(pagesForPostCount(100)).toBe(1);
    expect(pagesForPostCount(101)).toBe(2);
    expect(pagesForPostCount(1498)).toBe(15); // henryhudson6 as of 2026-07-12
    // X will not read further back than the ceiling — asking for more buys nothing.
    expect(pagesForPostCount(X_TIMELINE_CEILING)).toBe(X_TIMELINE_CEILING / POSTS_PER_PAGE);
    expect(pagesForPostCount(50_000)).toBe(X_TIMELINE_CEILING / POSTS_PER_PAGE);
  });
});

describe("resourcesForPosts — the fee must cover the read", () => {
  it("prices a read by the posts it actually returns, plus the user object", () => {
    expect(resourcesForPosts(100)).toBe(101); // the old flat text price, derived
    expect(resourcesForPosts(1498)).toBe(1499);
    expect(resourcesForPosts(0)).toBe(1);
  });

  it("a whole-profile read costs materially more than one page — a flat fee would sell it at a loss", () => {
    const onePage = resourcesToUsd(resourcesForPosts(100));
    const wholeProfile = resourcesToUsd(resourcesForPosts(1498));
    expect(wholeProfile).toBeGreaterThan(onePage * 10);
    // The rule made literal: what we charge must cover what X charges us.
    expect(wholeProfile).toBeCloseTo(1499 * 0.005, 6);
  });

  it("media no longer doubles the bill — expansions ride the text read for free", () => {
    // Before 2026-07-12 a media read was billed at 201 resources (a second pass
    // over the same timeline). It is now the same read, so the same price.
    expect(resourcesForPosts(100)).toBeLessThan(201);
  });
});

/** A fake X API that records every URL: one user-lookup body, timeline pages after. */
function xApiFetch(urls: string[]): typeof fetch {
  return (async (url: string) => {
    urls.push(String(url));
    if (String(url).includes("/users/by/username/")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            id: "42",
            username: "henryhudson6",
            name: "Henry",
            public_metrics: { tweet_count: 150 },
          },
        }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({ data: [{ id: "1", text: "hello" }], meta: {} }),
    } as Response;
  }) as typeof fetch;
}

describe("fetchXArchive — one head per archive, and the caller supplies it", () => {
  it("a full archive reads the user object EXACTLY once — the head rides in as an argument", async () => {
    // The whole billed flow a full archive makes: size the read from the head,
    // then page the timeline. Until 2026-08-06 fetchXArchive re-read the head
    // internally, so this exact flow billed TWO user objects for one profile.
    const urls: string[] = [];
    const fetchFn = xApiFetch(urls);
    const head = await fetchProfileHead("henryhudson6", "tok", fetchFn);
    if (!head) throw new Error("the stubbed head read cannot fail");
    const result = await fetchXArchive(head, "tok", pagesForPostCount(head.postCount), fetchFn);
    expect(urls.filter((u) => u.includes("/users/by/username/"))).toHaveLength(1);
    expect(result.archive.handle).toBe("henryhudson6");
    expect(result.archive.posts.map((p) => p.text)).toEqual(["hello"]);
  });

  it("fetchXArchive itself never touches the user endpoint — the double bill is unrepresentable", async () => {
    const head: XProfileHead = {
      id: "42",
      username: "henryhudson6",
      postCount: 150,
      profile: { displayName: "Henry", accountId: "42" },
    };
    const urls: string[] = [];
    await fetchXArchive(head, "tok", 2, xApiFetch(urls));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.includes("/users/42/tweets"))).toBe(true);
  });
});
