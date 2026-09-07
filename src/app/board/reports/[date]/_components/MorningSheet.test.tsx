import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Report } from "@/lib/board-data";
import MorningSheet from "./MorningSheet";
import s from "./morning.module.css";

const report: Report = {
  date: "2026-09-07",
  generatedAt: "2026-09-07T06:30:00.000Z",
  summary: { reviews: 4, confirmed: 1 },
  apps: [{ app: "site", name: "henceforth.club", headSha: "a0f8664", reviewFound: true, findings: [] }],
};

describe("The Morning Edition's sheet", () => {
  it("wears the morning stylesheet, so the packer's column rules read the house line from it", () => {
    const page = renderToStaticMarkup(<MorningSheet report={report} issue={19} />);
    const sheet = page.match(/<div class="([^"]*\ba4-print-root\b[^"]*)"/);
    expect(sheet?.[1].split(" ")).toContain(s.sheet);
  });
});
