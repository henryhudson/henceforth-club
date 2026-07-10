import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { parseXExport } from "./parseExport";
import { socialArchiveFromScripts } from "@/app/text/onchain";

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, "fixtures", name)));

// Same minimal-pushdata OP_RETURN encoding as src/app/text/onchain.test.ts,
// so the round trip below exercises the real reader, not a shortcut.
function opReturnScript(data: string): string {
  let s = "006a"; // OP_FALSE OP_RETURN
  const bytes = Buffer.from(data, "utf8");
  const n = bytes.length;
  if (n < 0x4c) s += n.toString(16).padStart(2, "0");
  else if (n <= 0xff) s += "4c" + n.toString(16).padStart(2, "0");
  else
    s +=
      "4d" +
      (n & 0xff).toString(16).padStart(2, "0") +
      ((n >> 8) & 0xff).toString(16).padStart(2, "0");
  s += bytes.toString("hex");
  return s;
}

describe("parseXExport", () => {
  it("parses a real-shape export into the archive the showroom reader accepts", () => {
    const result = parseXExport(fixture("real-export.zip"), 1_000_000);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.archive.posts).toHaveLength(3);

    const script = opReturnScript(JSON.stringify(result.archive));
    const read = socialArchiveFromScripts([script]);
    expect(read?.posts).toEqual(result.archive.posts);
    expect(read?.handle).toBe(result.archive.handle);
  });

  it("refuses an archive over the byte budget with too-large", () => {
    const result = parseXExport(fixture("oversize-export.zip"), 500);
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("refuses a zip without a tweets file", () => {
    const result = parseXExport(fixture("no-tweets.zip"), 1_000_000);
    expect(result).toEqual({ ok: false, reason: "no-tweets-file" });
  });

  it("hashes deterministically — same zip, same contentHash", () => {
    const zip = fixture("real-export.zip");
    const a = parseXExport(zip, 1_000_000);
    const b = parseXExport(zip, 1_000_000);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.contentHash).toBe(b.contentHash);
  });

  it("refuses an unreadable zip with bad-zip", () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(parseXExport(garbage, 1_000_000)).toEqual({ ok: false, reason: "bad-zip" });
  });

  it("refuses a tweets file with no posts in it", () => {
    // Same shape a real archive without any tweets would carry.
    const zip = zipSync({
      "data/tweets.js": strToU8("window.YTD.tweets.part0 = [];\n"),
    });
    expect(parseXExport(zip, 1_000_000)).toEqual({ ok: false, reason: "no-posts" });
  });

  // The handle rides through job creation into an irreversible broadcast; the
  // parser is the only gate before the visitor pays, so a missing or invalid
  // handle must refuse here — never fall back silently.
  const someTweets =
    'window.YTD.tweets.part0 = [ { "tweet": { "id_str": "1", ' +
    '"created_at": "Mon Jan 01 12:00:00 +0000 2024", "full_text": "hello" } } ];\n';

  const accountJS = (username: string) =>
    `window.YTD.account.part0 = [ { "account": { "username": ${JSON.stringify(username)} } } ];\n`;

  it("refuses a zip with tweets but no account file with no-handle", () => {
    const zip = zipSync({ "data/tweets.js": strToU8(someTweets) });
    expect(parseXExport(zip, 1_000_000)).toEqual({ ok: false, reason: "no-handle" });
  });

  it("refuses a malformed account file with no-handle", () => {
    const zip = zipSync({
      "data/tweets.js": strToU8(someTweets),
      "data/account.js": strToU8("window.YTD.account.part0 = not json at all"),
    });
    expect(parseXExport(zip, 1_000_000)).toEqual({ ok: false, reason: "no-handle" });
  });

  it("refuses a username that is not a valid handle with no-handle", () => {
    for (const bad of ["not a handle!", "", "sixteen_chars_xx"]) {
      const zip = zipSync({
        "data/tweets.js": strToU8(someTweets),
        "data/account.js": strToU8(accountJS(bad)),
      });
      expect(parseXExport(zip, 1_000_000)).toEqual({ ok: false, reason: "no-handle" });
    }
  });

  it("refuses a tweets file that is not an array with bad-zip, without throwing", () => {
    const zip = zipSync({
      "data/tweets.js": strToU8("window.YTD.tweets.part0 = {};\n"),
      "data/account.js": strToU8(accountJS("fixturehandle")),
    });
    expect(parseXExport(zip, 1_000_000)).toEqual({ ok: false, reason: "bad-zip" });
  });
});
