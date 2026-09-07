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

describe("The numbers square reads the funnel", () => {
  const withReach: Report = {
    ...report,
    reach: {
      dataThrough: "2026-09-05",
      perApp: [
        {
          app: "deck",
          yesterday: { date: "2026-09-05", count: 11 },
          week: { "2026-09-04": 8, "2026-09-05": 11 },
          rating: { average: 4.43, count: 7 },
          funnel: {
            through: "2026-09-05",
            week: {
              impressions: 6562,
              pageViews: 136,
              conversion: 0.375,
              sources: { search: 26, browse: 1, referrer: 6, webReferrer: 3, other: 0 },
            },
            yesterday: null,
          },
          subscriptions: {
            date: "2026-09-05",
            paying: 8,
            trial: 0,
            monthly: 4,
            yearly: 4,
            events: { through: "2026-09-05", days: 28, trialsStarted: 15, conversions: 2, lapsed: 2 },
          },
        },
        {
          app: "hansard",
          yesterday: { date: "2026-09-05", count: null },
          week: { "2026-09-04": 1 },
          rating: { average: 5, count: 1 },
        },
      ],
    },
  };
  const page = renderToStaticMarkup(<MorningSheet report={withReach} issue={20} />);
  const text = page.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("prints each app's week as impressions, page views and downloads per page view", () => {
    expect(text).toContain("Deck of Cards 6,562 136 37.5%");
  });

  it("prints em dashes, never zeros, for an app whose funnel was not read", () => {
    expect(text).toContain("The Hansard — — —");
  });

  it("names the funnel's own date only when it lags the store data", () => {
    expect(text).not.toContain("Funnel through");
    const lagging: Report = {
      ...withReach,
      reach: {
        ...withReach.reach!,
        perApp: withReach.reach!.perApp.map((a) =>
          a.funnel ? { ...a, funnel: { ...a.funnel, through: "2026-09-04" } } : a,
        ),
      },
    };
    const laggingText = renderToStaticMarkup(<MorningSheet report={lagging} issue={20} />)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    expect(laggingText).toContain("Store data through 2026-09-05. Funnel through 2026-09-04.");
  });

  it("prints Deck's trials started, converted and paying lapsed over the 28 days", () => {
    expect(text).toContain("Deck trials, 28 days to 2026-09-05: 15 started · 2 converted · 2 paying lapsed.");
    expect(text).toContain("Deck subscriptions: 8 paying (4 monthly, 4 yearly), 0 in trial.");
  });
});
