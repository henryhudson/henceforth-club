import { describe, expect, it } from "vitest";
import { validateComment, validateLink } from "../linkRecord";
import { MAP_PREFIX } from "../mapPost";
import { classifyTx, sourceLabel, titleFor } from "./classify";

const PAGE = "ab".repeat(32);
const OTHER = "cd".repeat(32);

function push(s: string): string {
  const bytes = new TextEncoder().encode(s);
  return `${bytes.length.toString(16).padStart(2, "0")}${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function script(parts: string[]): string {
  return "6a" + parts.map(push).join("");
}
function jsonScript(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const header = [0x4d, bytes.length & 0xff, (bytes.length >> 8) & 0xff];
  return "6a" + [...header, ...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("classifyTx", () => {
  it("comments redirect to parent", () => {
    const rec = validateComment(OTHER, "hi");
    expect(classifyTx([jsonScript(rec)], PAGE)).toEqual({ kind: "comment", parent: OTHER });
  });

  it("a stamp points at another target", () => {
    const rec = validateLink(OTHER, "listed");
    expect(classifyTx([jsonScript(rec)], PAGE)).toEqual({ kind: "stamp", target: OTHER });
  });

  it("reads a MAP post", () => {
    const hex = script([MAP_PREFIX, "SET", "app", "twetch", "type", "post", "text", "hello"]);
    const c = classifyTx([hex], PAGE);
    expect(c.kind).toBe("map");
    if (c.kind !== "map") throw new Error("expected map");
    expect(c.source).toBe("twetch");
    expect(c.post.text).toBe("hello");
  });

  it("legacy https links stay links", () => {
    const rec = validateLink("https://example.com/a", "A title");
    expect(classifyTx([jsonScript(rec)], PAGE)).toEqual({ kind: "legacy-link", record: rec });
  });

  it("unknown scripts are opaque, not a miss", () => {
    expect(classifyTx([script(["not-a-protocol"])], PAGE)).toEqual({ kind: "opaque" });
  });
});



describe("titleFor", () => {
  const short = `${PAGE.slice(0, 6)}…${PAGE.slice(-4)}`;

  it("names a legacy link by its title and a map post by its text", () => {
    const link = validateLink("https://example.org/a", "A titled link");
    if (!link) throw new Error("expected record");
    expect(titleFor({ kind: "legacy-link", record: link }, PAGE)).toBe("A titled link");
    expect(titleFor({ kind: "map", post: { text: "  hello  " } as never, source: "twetch" }, PAGE)).toBe("hello");
    expect(titleFor({ kind: "map", post: { text: "   " } as never, source: "twetch" }, PAGE)).toBe(short);
  });

  it("never calls a post or an opaque transaction an archived profile", () => {
    expect(titleFor({ kind: "opaque" }, PAGE)).toBe(short);
    expect(titleFor({ kind: "archive", archive: {} as never }, PAGE)).toBe(`Archived profile — ${short}`);
    expect(titleFor({ kind: "comment", parent: OTHER }, PAGE)).toContain("comment");
    expect(titleFor({ kind: "stamp", target: OTHER }, PAGE)).toContain("stamp");
  });
});

describe("sourceLabel", () => {
  it("names the known apps and archive sources, and passes an unknown app string through", () => {
    expect(sourceLabel("twetch")).toBe("Twetch");
    expect(sourceLabel("treechat")).toBe("Treechat");
    expect(sourceLabel("x")).toBe("X");
    expect(sourceLabel("folklore")).toBe("Folklore");
    expect(sourceLabel("hodlocker")).toBe("hodlocker");
  });
});
