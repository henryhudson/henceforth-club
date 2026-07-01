import { describe, it, expect } from "vitest";
import { archiveDigest } from "./xDigest";

describe("archiveDigest", () => {
  it("collects every post id, and media ids only for posts with inscribed media", () => {
    const digest = archiveDigest({
      source: "x",
      handle: "h",
      profile: {},
      posts: [
        { id: "1", at: "", text: "plain" },
        { id: "2", at: "", text: "photo", mediaHashes: ["0"] },
        { id: "3", at: "", text: "empty media list", mediaHashes: [] },
      ],
    });
    expect(digest.tweetIds).toEqual(["1", "2", "3"]);
    expect(digest.mediaPostIds).toEqual(["2"]);
  });

  it("digests an archive with no posts to empty sets", () => {
    const digest = archiveDigest({ source: "x", handle: "h", profile: {}, posts: [] });
    expect(digest).toEqual({ tweetIds: [], mediaPostIds: [] });
  });
});
