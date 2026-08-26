import { describe, expect, it } from "vitest";
import { B_PREFIX, MAP_PREFIX, mapPostFromScripts } from "./mapPost";

const TXID = "ab".repeat(32);

function push(s: string): string {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length >= 0x4c) {
    return `4c${bytes.length.toString(16).padStart(2, "0")}${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  return `${bytes.length.toString(16).padStart(2, "0")}${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function script(parts: string[]): string {
  return "6a" + parts.map(push).join("");
}

describe("mapPostFromScripts", () => {
  it("reads a twetch type=post with B-protocol text", () => {
    const hex = script([
      B_PREFIX,
      "hello from twetch",
      "text/plain",
      "utf-8",
      MAP_PREFIX,
      "SET",
      "app",
      "twetch",
      "type",
      "post",
    ]);
    expect(mapPostFromScripts([hex], TXID)).toEqual({
      source: "twetch",
      post: { id: TXID, at: "", text: "hello from twetch", txid: TXID },
    });
  });

  it("reads a treechat type=post", () => {
    const hex = script([
      MAP_PREFIX,
      "SET",
      "app",
      "treechat",
      "type",
      "post",
      "text",
      "upvalue is kudos",
    ]);
    expect(mapPostFromScripts([hex], TXID)?.source).toBe("treechat");
    expect(mapPostFromScripts([hex], TXID)?.post.text).toBe("upvalue is kudos");
  });

  it("returns null when type is not post", () => {
    const hex = script([MAP_PREFIX, "SET", "app", "twetch", "type", "like"]);
    expect(mapPostFromScripts([hex], TXID)).toBeNull();
  });
});
