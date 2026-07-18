import { describe, expect, it } from "vitest";
import { postMatchesMediaFilter } from "./FeedControls";
import type { XPost } from "../parseArchive";

function post(id: string, media?: XPost["media"]): XPost {
  return { id, at: "2026-01-01", text: id, media };
}

describe("postMatchesMediaFilter", () => {
  it("all keeps every post", () => {
    expect(postMatchesMediaFilter(post("a"), "all")).toBe(true);
    expect(postMatchesMediaFilter(post("b", [{ type: "video", url: "u" }]), "all")).toBe(true);
  });

  it("media requires at least one media item", () => {
    expect(postMatchesMediaFilter(post("a"), "media")).toBe(false);
    expect(postMatchesMediaFilter(post("b", [{ type: "photo", url: "p" }]), "media")).toBe(true);
    expect(postMatchesMediaFilter(post("c", [{ type: "video/mp4", url: "v" }]), "media")).toBe(
      true,
    );
  });

  it("video matches video and animated_gif only", () => {
    expect(postMatchesMediaFilter(post("a", [{ type: "photo", url: "p" }]), "video")).toBe(false);
    expect(postMatchesMediaFilter(post("b", [{ type: "video", url: "v" }]), "video")).toBe(true);
    expect(postMatchesMediaFilter(post("c", [{ type: "video/mp4", url: "v" }]), "video")).toBe(
      true,
    );
    expect(postMatchesMediaFilter(post("d", [{ type: "animated_gif", url: "g" }]), "video")).toBe(
      true,
    );
  });
});
