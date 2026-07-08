import { describe, expect, it } from "vitest";
import { editionIndex, verdictLine } from "./report-helpers";

describe("verdictLine", () => {
  it("orders confirmed, rejected, abstained, already fixed", () => {
    const findings = [
      { verdict: "agree" }, { verdict: "agree" },
      { verdict: "reject" }, { verdict: "abstain" }, { verdict: "already-resolved" },
    ];
    expect(verdictLine(findings)).toBe("2 confirmed · 1 rejected · 1 abstained · 1 already fixed");
  });
  it("omits zero buckets", () => {
    expect(verdictLine([{ verdict: "reject" }])).toBe("1 rejected");
  });
  it("reads 'no findings' for an empty list", () => {
    expect(verdictLine([])).toBe("no findings");
  });
  it("counts unknown verdicts as abstained", () => {
    expect(verdictLine([{ verdict: "shrug" }])).toBe("1 abstained");
  });
});

describe("editionIndex", () => {
  it("interleaves newest-first with correct hrefs", () => {
    const out = editionIndex(["2026-07-02", "2026-06-30"], ["2026-07-01"]);
    expect(out).toEqual([
      { type: "daily", date: "2026-07-02", href: "/board/reports/2026-07-02" },
      { type: "weekly", date: "2026-07-01", href: "/board/reports/week/2026-07-01" },
      { type: "daily", date: "2026-06-30", href: "/board/reports/2026-06-30" },
    ]);
  });
  it("puts the weekly first on an equal date", () => {
    const out = editionIndex(["2026-06-29"], ["2026-06-29"]);
    expect(out.map((e) => e.type)).toEqual(["weekly", "daily"]);
  });
});
