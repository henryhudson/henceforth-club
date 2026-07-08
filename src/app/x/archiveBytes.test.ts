import { describe, expect, it } from "vitest";
import { estimateArchiveBytes } from "./archiveBytes";
import type { XArchive } from "./parseArchive";

const post = (id: string, text: string) => ({ id, at: "2012-09-02T00:00:00Z", text });

describe("estimateArchiveBytes", () => {
  it("is zero for an archive with no posts", () => {
    expect(estimateArchiveBytes({ profile: { handle: "a" }, posts: [] })).toBe(0);
  });

  it("counts bytes, not characters — an emoji is four bytes, not one", () => {
    const plain: XArchive = { profile: { handle: "a" }, posts: [post("1", "x")] };
    const emoji: XArchive = { profile: { handle: "a" }, posts: [post("1", "\u{1F600}")] };
    expect(estimateArchiveBytes(emoji)).toBe(estimateArchiveBytes(plain) + 3);
  });

  it("grows with the number of posts", () => {
    const one: XArchive = { profile: { handle: "a" }, posts: [post("1", "hello")] };
    const two: XArchive = { profile: { handle: "a" }, posts: [post("1", "hello"), post("2", "hello")] };
    expect(estimateArchiveBytes(two)).toBeGreaterThan(estimateArchiveBytes(one));
  });
});
