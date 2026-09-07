import { describe, it, expect } from "vitest";
import {
  DISCOVERY,
  DOWNLOADS,
  SUBSCRIPTION_EVENTS,
  addTallies,
  buildFunnel,
  buildSubscriptionEvents,
  downloadsOnly,
  sumWindow,
  tallyByDate,
} from "./daily-reach-core.mjs";
import { parseDownloadsCsv } from "./asc-analytics.mjs";
import { coverageThrough, mergeByDate } from "./daily-reach.mjs";

// Captured from the live reports on 2026-09-07: the header lines verbatim,
// the rows trimmed to what the rules need.
const DOWNLOADS_CSV = [
  "Date\tApp Name\tApp Apple Identifier\tDownload Type\tApp Version\tDevice\tPlatform Version\tSource Type\tPage Type\tPre-Order\tTerritory\tCounts",
  "2026-09-05\tDeck Of Cards\t1520654142\tFirst-time download\t1.31\tiPhone\tiOS 26.5\tApp referrer\tProduct page\t\tGB\t1",
  "2026-09-05\tDeck Of Cards\t1520654142\tFirst-time download\t1.31\tiPhone\tiOS 26.6\tApp referrer\tProduct page\t\tJP\t1",
  "2026-09-05\tDeck Of Cards\t1520654142\tAuto-update\t1.31\tiPhone\tiOS 18.1\tApp Store search\tProduct page\t\tKH\t1",
  "2026-09-05\tDeck Of Cards\t1520654142\tFirst-time download\t1.31\tiPad\tiOS 26.5\tApp Store search\tNo page\t\tTH\t3",
  "2026-09-05\tDeck Of Cards\t1520654142\tRedownload\t1.31\tiPhone\tiOS 26.5\tApp Store search\tProduct page\t\tUS\t1",
  "2026-09-04\tDeck Of Cards\t1520654142\tFirst-time download\t1.31\tiPhone\tiOS 26.5\tWeb referrer\tProduct page\t\tGB\t2",
  "2026-09-04\tDeck Of Cards\t1520654142\tFirst-time download\t1.31\tiPhone\tiOS 26.5\tApp Store browse\tProduct page\t\tGB\t1",
  "2026-09-04\tDeck Of Cards\t1520654142\tFirst-time download\t1.31\tiPhone\tiOS 26.5\tInstitutional purchase\tNo page\t\tGB\t1",
  "2026-09-04\tDeck Of Cards\t1520654142\tManual update\t1.30\tiPad\tiOS 18.7\tApp Store search\tNo page\t\tGB\t4",
  "2026-09-04\tDeck Of Cards\t1520654142\tRestore\t1.31\tiPhone\tiOS 26.5\tApp Store search\tNo page\t\tSE\t1",
].join("\n");

const DISCOVERY_CSV = [
  "Date\tApp Name\tApp Apple Identifier\tEvent\tPage Type\tSource Type\tEngagement Type\tDevice\tPlatform Version\tTerritory\tCounts\tUnique Counts",
  "2026-09-05\tDeck Of Cards\t1520654142\tImpression\tNo page\tApp Store search\t\tiPad\tiOS 26.5\tTH\t8\t8",
  "2026-09-05\tDeck Of Cards\t1520654142\tImpression\tNo page\tApp Store browse\t\tiPhone\tiOS 26.6\tGB\t12\t9",
  "2026-09-05\tDeck Of Cards\t1520654142\tPage view\tProduct page\tApp Store search\t\tiPhone\tiOS 26.5\tGB\t3\t2",
  "2026-09-05\tDeck Of Cards\t1520654142\tPage view\tStore sheet\tApp referrer\t\tiPhone\tiOS 26.5\tUS\t1\t1",
  "2026-09-05\tDeck Of Cards\t1520654142\tTap\tNo page\tApp Store search\tGet\tiPhone\tiOS 18.7\tMA\t4\t1",
  "2026-09-04\tDeck Of Cards\t1520654142\tImpression\tNo page\tApp Store search\t\tiPad\tiOS 26.3\tID\t3\t1",
  "2026-09-04\tDeck Of Cards\t1520654142\tPage view\tDeveloper page\tApp Store search\t\tiPhone\tiOS 26.5\tGB\t1\t1",
].join("\n");

const EVENTS_CSV = [
  "Event Date\tApp Name\tApp Apple Identifier\tEvent Group\tEvent Name\tSubscription Name\tSubscription Identifier\tSubscription Duration\tBilling Frequency\tBilling Period\tSubscription Group\tSubscription Group Identifier\tOffer Type\tOffer Name\tOffer ID\tVanity Code\tOffer Pricing\tOffer Duration\tPlan Change Type\tPrevious Subscription Name\tPrevious Subscription Identifier\tFamily Sharing\tCancellation Reason\tChurn Tenure\tPaid Service Days Recovered\tApp Download Source Type\tPage Type\tPre-Order\tOriginal Purchase Device\tTerritory\tCounts",
  ...[
    ["2026-09-05", "Offer start", "Free trial start activation", "2"],
    ["2026-09-05", "Voluntary churn", "Voluntary churn from free trial", "1"],
    ["2026-09-03", "Paid subscription from offer", "Full price from free trial", "1"],
    ["2026-09-03", "Voluntary churn", "Voluntary churn from full price", "1"],
    ["2026-09-01", "Involuntary churn", "Involuntary churn from billing retry", "1"],
    ["2026-09-01", "Renewal", "Full price renewal", "3"],
    ["2026-09-01", "Paid subscription start", "Full price subscription start activation", "1"],
    ["2026-08-31", "Enter billing issue", "Billing retry from full price", "1"],
  ].map(
    ([date, group, name, n]) =>
      `${date}\tDeck Of Cards\t1520654142\t${group}\t${name}\tMonthly Subscription\t6737259655\t1 month\tMonthly\t\tMultiplayer Subscription\t21566842\tIntroductory offer\t\t\t\tFree trial\t1 week\t\tMonthly Subscription\t6737259655\tIndividual\t\t\t\tApp Store search\tNo page\t\tiPhone\tUS\t${n}`,
  ),
].join("\n");

describe("tallyByDate with the downloads rule", () => {
  it("counts first-time downloads and redownloads by source; updates and restores are not downloads", () => {
    expect(tallyByDate(DOWNLOADS_CSV, DOWNLOADS.classify)).toEqual({
      "2026-09-05": { referrer: 2, search: 4 },
      "2026-09-04": { webReferrer: 2, browse: 1, other: 1 },
    });
  });

  it("agrees with the downloads table's own parser on the same report", () => {
    const [instance] = downloadsOnly([{ processingDate: "2026-09-06", byDate: tallyByDate(DOWNLOADS_CSV, DOWNLOADS.classify) }]);
    expect(instance.byDate).toEqual(parseDownloadsCsv(DOWNLOADS_CSV));
  });

  it("returns empty for an empty or column-less report", () => {
    expect(tallyByDate("", DOWNLOADS.classify)).toEqual({});
    expect(tallyByDate("Foo\tBar\n1\t2", DOWNLOADS.classify)).toEqual({});
  });
});

describe("tallyByDate with the discovery rule", () => {
  it("reads impressions and page views as Counts, page views across every page type, and drops taps", () => {
    expect(tallyByDate(DISCOVERY_CSV, DISCOVERY.classify)).toEqual({
      "2026-09-05": { impressions: 20, pageViews: 4 },
      "2026-09-04": { impressions: 3, pageViews: 1 },
    });
  });
});

describe("tallyByDate with the subscription event rule", () => {
  it("dates rows by Event Date and keeps trial starts, conversions and paid churn only", () => {
    expect(tallyByDate(EVENTS_CSV, SUBSCRIPTION_EVENTS.classify, SUBSCRIPTION_EVENTS.dateColumn)).toEqual({
      "2026-09-05": { trialsStarted: 2 },
      "2026-09-03": { conversions: 1, lapsed: 1 },
      "2026-09-01": { lapsed: 1 },
    });
  });
});

describe("addTallies and sumWindow", () => {
  it("adds keywise, keeping keys only one side carries", () => {
    expect(addTallies({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({ a: 1, b: 5, c: 4 });
  });

  it("sums the dates inside the window and reads an absent date as zero", () => {
    const merged = { "2026-09-01": { a: 1 }, "2026-09-03": { a: 2, b: 1 }, "2026-09-09": { a: 50 } };
    expect(sumWindow(merged, "2026-09-01", "2026-09-07")).toEqual({ a: 3, b: 1 });
    expect(sumWindow(merged, "2026-09-04", "2026-09-07")).toEqual({});
  });
});

describe("the daily rules hold for tallies", () => {
  it("lets the newest instance restate a date's tally whole instead of adding to it", () => {
    const merged = mergeByDate([
      { processingDate: "2026-09-06", byDate: { "2026-09-04": { search: 2 }, "2026-09-05": { referrer: 1 } } },
      { processingDate: "2026-09-05", byDate: { "2026-09-04": { search: 1, browse: 1 } } },
    ]);
    expect(merged).toEqual({ "2026-09-04": { search: 2 }, "2026-09-05": { referrer: 1 } });
    expect(coverageThrough([{ processingDate: "2026-09-06", byDate: merged }])).toBe("2026-09-05");
  });
});

describe("buildFunnel", () => {
  const downloads = {
    through: "2026-09-05",
    merged: {
      "2026-08-29": { search: 9 }, // outside the week: the floor is through minus six
      "2026-08-30": { search: 1 },
      "2026-09-02": { search: 3, browse: 1 },
      "2026-09-05": { referrer: 2, search: 4 },
    },
  };
  const discovery = {
    through: "2026-09-05",
    merged: {
      "2026-08-29": { impressions: 900, pageViews: 40 },
      "2026-08-30": { impressions: 100, pageViews: 2 },
      "2026-09-02": { impressions: 300, pageViews: 10 },
      "2026-09-05": { impressions: 20, pageViews: 4 },
    },
  };

  it("sums the week to the report's coverage: impressions, page views, downloads per page view, downloads by source", () => {
    expect(buildFunnel("2026-09-06", downloads, discovery)).toEqual({
      through: "2026-09-05",
      week: {
        impressions: 420,
        pageViews: 16,
        conversion: 0.6875,
        sources: { search: 8, browse: 1, referrer: 2, webReferrer: 0, other: 0 },
      },
      yesterday: {
        impressions: 20,
        pageViews: 4,
        conversion: 1.5,
        sources: { search: 4, browse: 0, referrer: 2, webReferrer: 0, other: 0 },
      },
    });
  });

  it("reads the funnel through the older of the two reports, so both halves cover the same dates", () => {
    const lagging = { ...discovery, through: "2026-09-04" };
    const funnel = buildFunnel("2026-09-06", downloads, lagging);
    expect(funnel.through).toBe("2026-09-04");
    // 2026-08-29 to 2026-09-04: the 5th falls out of both halves.
    expect(funnel.week).toEqual({
      impressions: 1300,
      pageViews: 52,
      conversion: 0.2692,
      sources: { search: 13, browse: 1, referrer: 0, webReferrer: 0, other: 0 },
    });
  });

  it("reads an unprocessed yesterday as null, never zeros", () => {
    expect(buildFunnel("2026-09-07", downloads, discovery).yesterday).toBeNull();
  });

  it("reads a quiet yesterday inside coverage as real zeros with no conversion", () => {
    const quiet = buildFunnel("2026-09-04", downloads, discovery).yesterday;
    expect(quiet).toEqual({
      impressions: 0,
      pageViews: 0,
      conversion: null,
      sources: { search: 0, browse: 0, referrer: 0, webReferrer: 0, other: 0 },
    });
  });

  it("is null when either report has no coverage: absence is not a funnel of zeros", () => {
    expect(buildFunnel("2026-09-06", downloads, { through: null, merged: {} })).toBeNull();
    expect(buildFunnel("2026-09-06", { through: null, merged: {} }, discovery)).toBeNull();
  });
});

describe("buildSubscriptionEvents", () => {
  it("sums the last 28 processed days, a day without events being zero", () => {
    const events = {
      through: "2026-09-05",
      merged: {
        "2026-08-08": { trialsStarted: 9 }, // the day before the window
        "2026-08-09": { trialsStarted: 1 },
        "2026-08-21": { conversions: 1, lapsed: 1 },
        "2026-09-05": { trialsStarted: 2 },
      },
    };
    expect(buildSubscriptionEvents(events)).toEqual({
      through: "2026-09-05",
      days: 28,
      trialsStarted: 3,
      conversions: 1,
      lapsed: 1,
    });
  });

  it("is null without coverage", () => {
    expect(buildSubscriptionEvents({ through: null, merged: {} })).toBeNull();
  });
});
