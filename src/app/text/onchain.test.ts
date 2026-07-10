import { describe, it, expect } from "vitest";
import {
  extractPushdata,
  socialArchiveFromScripts,
  socialArchiveToXArchive,
  ordfsUrl,
  stitchToXArchive,
} from "./onchain";

// Build an OP_RETURN script hex (OP_FALSE OP_RETURN <push>...) from string data,
// using the real minimal-pushdata encoding so we exercise the parser for real.
function opReturnScript(...datas: string[]): string {
  let s = "006a"; // OP_FALSE OP_RETURN
  for (const d of datas) {
    const bytes = Buffer.from(d, "utf8");
    const n = bytes.length;
    if (n < 0x4c) s += n.toString(16).padStart(2, "0");
    else if (n <= 0xff) s += "4c" + n.toString(16).padStart(2, "0");
    else
      s +=
        "4d" +
        (n & 0xff).toString(16).padStart(2, "0") +
        ((n >> 8) & 0xff).toString(16).padStart(2, "0");
    s += bytes.toString("hex");
  }
  return s;
}

const archiveJSON = JSON.stringify({
  v: 1,
  source: "x",
  handle: "henry",
  profile: { displayName: "Henry H", bio: "builder", location: " London " },
  posts: [
    { id: "1", at: "2020-01-01", text: "hello world" },
    {
      id: "2",
      at: "2020-01-02",
      text: "@bob yes",
      replyToId: "9",
      parent: { author: "bob", text: "what do you think?" },
    },
  ],
});

describe("extractPushdata", () => {
  it("pulls every pushed chunk out of an OP_RETURN script", () => {
    const script = opReturnScript("B", archiveJSON);
    const strs = extractPushdata(script).map((c) => Buffer.from(c).toString("utf8"));
    expect(strs).toContain("B");
    expect(strs).toContain(archiveJSON);
  });

  it("handles OP_PUSHDATA2 for payloads over 255 bytes", () => {
    const big = "x".repeat(600);
    const strs = extractPushdata(opReturnScript(big)).map((c) =>
      Buffer.from(c).toString("utf8"),
    );
    expect(strs).toContain(big);
  });
});

describe("socialArchiveFromScripts", () => {
  it("finds the archive JSON among several pushdatas (B:// wrapper)", () => {
    const script = opReturnScript(
      "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut",
      archiveJSON,
      "application/json",
      "utf-8",
      "x.json",
    );
    const sa = socialArchiveFromScripts([script]);
    expect(sa?.handle).toBe("henry");
    expect(sa?.posts).toHaveLength(2);
  });

  it("returns null when no pushdata is a social archive", () => {
    expect(socialArchiveFromScripts([opReturnScript("just a plain note")])).toBeNull();
  });

  it("ignores JSON that is not a social archive (no posts/handle)", () => {
    const notArchive = JSON.stringify({ hello: "world" });
    expect(socialArchiveFromScripts([opReturnScript(notArchive)])).toBeNull();
  });
});

describe("socialArchiveToXArchive", () => {
  it("maps the on-chain shape to the renderable shape", () => {
    const sa = socialArchiveFromScripts([opReturnScript(archiveJSON)])!;
    const x = socialArchiveToXArchive(sa);
    expect(x.profile.handle).toBe("henry");
    expect(x.profile.displayName).toBe("Henry H");
    expect(x.profile.location).toBe("London"); // trimmed
    expect(x.posts).toHaveLength(2);
    expect(x.posts[1].replyToId).toBe("9");
    expect(x.posts[1].parent).toEqual({ author: "bob", text: "what do you think?" });
    expect(x.posts[0].parent).toBeUndefined();
  });

  it("tags each post with the txid of the archive that carried it", () => {
    const sa = socialArchiveFromScripts([opReturnScript(archiveJSON)])!;
    const x = socialArchiveToXArchive(sa, "abc123");
    expect(x.posts.every((p) => p.txid === "abc123")).toBe(true);
  });

  it("leaves posts untagged when no txid is given (a preview archive)", () => {
    const sa = socialArchiveFromScripts([opReturnScript(archiveJSON)])!;
    const x = socialArchiveToXArchive(sa);
    expect(x.posts.every((p) => p.txid === undefined)).toBe(true);
  });
});

describe("socialArchiveToXArchive media", () => {
  const sa = {
    source: "x",
    handle: "h",
    profile: {},
    posts: [
      { id: "p1", at: "", text: "a", mediaHashes: ["0", "1"] },
      { id: "p2", at: "", text: "b" },
    ],
  };

  it("maps each media vout to an ORDFS photo url under the archive txid", () => {
    const x = socialArchiveToXArchive(sa, "abc123");
    expect(x.posts[0].media).toEqual([
      { type: "photo", url: "https://ordfs.network/abc123_0" },
      { type: "photo", url: "https://ordfs.network/abc123_1" },
    ]);
  });

  it("leaves a media-less post with no media", () => {
    expect(socialArchiveToXArchive(sa, "abc123").posts[1].media).toBeUndefined();
  });

  it("omits media when there is no txid to resolve the outpoint against", () => {
    expect(socialArchiveToXArchive(sa).posts[0].media).toBeUndefined();
  });
});

describe("ordfsUrl", () => {
  it("forms the outpoint url", () => {
    expect(ordfsUrl("abc", "2")).toBe("https://ordfs.network/abc_2");
  });
});

describe("stitchToXArchive", () => {
  it("resolves each post's media against its OWN archive's txid, newest post copy wins", () => {
    const textOnly = {
      v: 1, source: "x", handle: "h", profile: { displayName: "Old" },
      posts: [{ id: "p1", at: "", text: "a" }, { id: "p2", at: "", text: "b" }],
    };
    const mediaBackfill = {
      v: 1, source: "x", handle: "h", profile: { displayName: "New" },
      posts: [{ id: "p1", at: "", text: "a", mediaHashes: ["0"] }],
    };
    const x = stitchToXArchive([
      { archive: textOnly, txid: "TXA" },
      { archive: mediaBackfill, txid: "TXB" },
    ]);
    expect(x.profile.displayName).toBe("New");
    expect(x.posts.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    const p1 = x.posts.find((p) => p.id === "p1");
    expect(p1?.media).toEqual([{ type: "photo", url: "https://ordfs.network/TXB_0" }]);
    expect(x.posts.find((p) => p.id === "p2")?.media).toBeUndefined();
    // The newest copy's txid wins, same as its other fields.
    expect(p1?.txid).toBe("TXB");
    expect(x.posts.find((p) => p.id === "p2")?.txid).toBe("TXA");
  });

  it("keeps media from an older archive when a newer text-only copy re-carries the post", () => {
    const withMedia = {
      v: 1, source: "x", handle: "h", profile: {},
      posts: [{ id: "p1", at: "", text: "a", mediaHashes: ["0"] }],
    };
    const textOnlyRecarry = {
      v: 1, source: "x", handle: "h", profile: {},
      posts: [{ id: "p1", at: "", text: "a" }],
    };
    const x = stitchToXArchive([
      { archive: withMedia, txid: "TXA" },
      { archive: textOnlyRecarry, txid: "TXB" },
    ]);
    expect(x.posts.find((p) => p.id === "p1")?.media).toEqual([
      { type: "photo", url: "https://ordfs.network/TXA_0" },
    ]);
  });

  it("unions media across copies, newest first, without duplicates", () => {
    const older = {
      v: 1, source: "x", handle: "h", profile: {},
      posts: [{ id: "p1", at: "", text: "a", mediaHashes: ["0"] }],
    };
    const newer = {
      v: 1, source: "x", handle: "h", profile: {},
      posts: [{ id: "p1", at: "", text: "a", mediaHashes: ["1"] }],
    };
    const x = stitchToXArchive([
      { archive: older, txid: "TXA" },
      { archive: newer, txid: "TXB" },
    ]);
    expect(x.posts.find((p) => p.id === "p1")?.media).toEqual([
      { type: "photo", url: "https://ordfs.network/TXB_1" },
      { type: "photo", url: "https://ordfs.network/TXA_0" },
    ]);
  });

  it("orders posts newest-first by post id, whichever archive carried them", () => {
    const first = {
      v: 1, source: "x", handle: "h", profile: {},
      posts: [{ id: "100", at: "", text: "mid" }, { id: "99", at: "", text: "old" }],
    };
    const second = {
      v: 1, source: "x", handle: "h", profile: {},
      posts: [{ id: "101", at: "", text: "new" }],
    };
    const x = stitchToXArchive([
      { archive: first, txid: "TXA" },
      { archive: second, txid: "TXB" },
    ]);
    expect(x.posts.map((p) => p.id)).toEqual(["101", "100", "99"]);
  });
});

