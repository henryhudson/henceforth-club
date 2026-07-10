import { describe, expect, it } from "vitest";
import { buildExportZip } from "./buildExportZip";
import { parseXExport } from "@/lib/textJob/parseExport";

const enc = (s: string) => new TextEncoder().encode(s);

describe("buildExportZip", () => {
  it("round-trips through parseXExport exactly as a real dropped export would", () => {
    const tweets = enc(
      "window.YTD.tweet.part0 = " +
        JSON.stringify([
          { tweet: { id_str: "1", created_at: "Mon Jan 01 00:00:00 +0000 2024", full_text: "hello" } },
        ]),
    );
    const account = enc("window.YTD.account.part0 = " + JSON.stringify([{ account: { username: "henry" } }]));
    const profile = enc("window.YTD.profile.part0 = " + JSON.stringify([{ profile: {} }]));

    const zip = buildExportZip({ tweets, profile, account });
    const parsed = parseXExport(zip, 1_000_000);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("expected ok");
    expect(parsed.handle).toBe("henry");
    expect(parsed.archive.posts).toEqual([
      { id: "1", at: "Mon Jan 01 00:00:00 +0000 2024", text: "hello" },
    ]);
  });

  it("still refuses via the same route when the export has no posts", () => {
    const tweets = enc("window.YTD.tweet.part0 = []");
    const account = enc("window.YTD.account.part0 = " + JSON.stringify([{ account: { username: "henry" } }]));
    const profile = enc("window.YTD.profile.part0 = []");

    const zip = buildExportZip({ tweets, profile, account });
    expect(parseXExport(zip, 1_000_000)).toEqual({ ok: false, reason: "no-posts" });
  });
});
