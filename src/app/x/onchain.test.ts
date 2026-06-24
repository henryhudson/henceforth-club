import { describe, it, expect } from "vitest";
import {
  extractPushdata,
  socialArchiveFromScripts,
  socialArchiveToXArchive,
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
    { id: "2", at: "2020-01-02", text: "@bob yes", replyToId: "9" },
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
  });
});
