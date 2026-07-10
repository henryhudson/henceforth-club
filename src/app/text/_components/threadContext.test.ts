import { describe, it, expect } from "vitest";
import { buildThreadContext } from "./threadContext";
import type { XPost } from "../parseArchive";

const p = (id: string, replyToId?: string): XPost => ({
  id,
  at: "2024-01-01T00:00:00Z",
  text: `post ${id}`,
  replyToId,
});

describe("buildThreadContext", () => {
  it("links a self-thread: a post's parent and its replies within the archive", () => {
    const posts = [p("3", "2"), p("2", "1"), p("1")];
    const [c3, c2, c1] = buildThreadContext(posts);

    // post 1 is replied to by post 2
    expect(c1.parent).toBeUndefined();
    expect(c1.replies.map((r) => r.id)).toEqual(["2"]);
    // post 2 replies to 1, and is replied to by 3
    expect(c2.parent?.id).toBe("1");
    expect(c2.replies.map((r) => r.id)).toEqual(["3"]);
    // post 3 replies to 2, nothing replies to it here
    expect(c3.parent?.id).toBe("2");
    expect(c3.replies).toEqual([]);
  });

  it("leaves the parent undefined when the replied-to post isn't in the archive", () => {
    // A reply to someone else's tweet — that tweet is not one of the account's
    // own posts, so it is never in the set. The context has no parent to show.
    const posts = [p("9", "external-id-not-here")];
    const [c] = buildThreadContext(posts);
    expect(c.parent).toBeUndefined();
    expect(c.replies).toEqual([]);
  });

  it("is index-aligned with the input array", () => {
    const posts = [p("a"), p("b", "a")];
    const ctx = buildThreadContext(posts);
    expect(ctx).toHaveLength(2);
    expect(ctx[1].parent?.id).toBe("a");
  });
});
