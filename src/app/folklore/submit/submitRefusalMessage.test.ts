import { describe, expect, it } from "vitest";
import { submitRefusalMessage } from "./submitRefusalMessage";

describe("submitRefusalMessage", () => {
  it("names the caps for the oversize refusals", () => {
    expect(submitRefusalMessage("title-too-long")).toContain("300");
    expect(submitRefusalMessage("comment-too-long")).toContain("10,000");
  });

  it("maps every field refusal to specific copy", () => {
    expect(submitRefusalMessage("bad-url")).toContain("http");
    expect(submitRefusalMessage("bad-title")).toContain("title");
    expect(submitRefusalMessage("bad-text")).toContain("comment");
    expect(submitRefusalMessage("bad-parent")).toContain("64-character");
    expect(submitRefusalMessage("unknown-parent")).toContain("not on the board");
  });

  it("folds every attribution refusal into one honest line", () => {
    for (const reason of ["bad-by", "unsigned-by", "unbound-by", "bad-signature"]) {
      expect(submitRefusalMessage(reason)).toContain("attribution");
    }
  });

  it("says when to retry a throttle, in seconds when the server said so", () => {
    expect(submitRefusalMessage("too-many-submissions", 90)).toContain("90 seconds");
    expect(submitRefusalMessage("too-many-submissions")).toContain("shortly");
    expect(submitRefusalMessage("too-many-submissions", Number.NaN)).toContain("shortly");
    expect(submitRefusalMessage("too-many-submissions", 0)).toContain("shortly");
  });

  it("is honest that nothing was charged on the service refusals", () => {
    expect(submitRefusalMessage("price-unavailable")).toContain("Nothing was charged");
    expect(submitRefusalMessage("store-unavailable")).toContain("nothing was submitted");
    expect(submitRefusalMessage("at-capacity")).toContain("try again");
  });

  it("gives an unrecognised reason an honest generic message", () => {
    expect(submitRefusalMessage("some-future-reason")).toContain("Nothing was charged");
    expect(submitRefusalMessage(undefined)).toContain("try again");
  });
});
