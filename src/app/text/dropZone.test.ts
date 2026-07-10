import { describe, expect, it } from "vitest";
import { dropFailureMessage, selectArchiveFiles } from "./dropZone";

const file = (name: string) => ({ name }) as File;

describe("selectArchiveFiles", () => {
  it("finds the three files X gives you, whatever else is in the folder", () => {
    const picked = selectArchiveFiles([
      file("manifest.js"), file("tweets.js"), file("account.js"), file("profile.js"),
    ]);
    expect(picked.ok).toBe(true);
    if (picked.ok) expect(picked.tweets.name).toBe("tweets.js");
  });

  it("is not fooled by tweets-media.js when tweets.js is absent", () => {
    const picked = selectArchiveFiles([file("tweets-media.js"), file("profile.js"), file("account.js")]);
    expect(picked).toEqual({ ok: false, reason: "missing-tweets" });
  });

  it("names the file that is missing rather than shrugging", () => {
    expect(selectArchiveFiles([file("tweets.js"), file("account.js")]))
      .toEqual({ ok: false, reason: "missing-profile" });
    expect(selectArchiveFiles([file("tweets.js"), file("profile.js")]))
      .toEqual({ ok: false, reason: "missing-account" });
    expect(selectArchiveFiles([])).toEqual({ ok: false, reason: "nothing-dropped" });
  });
});

describe("dropFailureMessage", () => {
  it("tells the visitor what to do, not merely what went wrong", () => {
    expect(dropFailureMessage("missing-tweets")).toContain("tweets.js");
    expect(dropFailureMessage("nothing-dropped")).toContain("data");
    expect(dropFailureMessage("unparseable")).toContain("browser");
  });

  it("never blames the visitor", () => {
    const reasons = ["nothing-dropped", "missing-tweets", "missing-profile", "missing-account", "unparseable"] as const;
    for (const reason of reasons) {
      expect(dropFailureMessage(reason).toLowerCase()).not.toContain("you failed");
      expect(dropFailureMessage(reason).toLowerCase()).not.toContain("invalid");
    }
  });
});
