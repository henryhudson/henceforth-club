import { describe, it, expect } from "vitest";
import { parseDownloadsCsv } from "./asc-analytics.mjs";

describe("parseDownloadsCsv", () => {
  it("sums download Counts per date and excludes non-download types", () => {
    const csv = [
      "Date\tApp Name\tDownload Type\tTerritory\tCounts",
      "2026-06-28\tDeck\tFirst-time download\tUS\t4",
      "2026-06-28\tDeck\tRedownload\tGB\t2",
      "2026-06-28\tDeck\tUpdate\tUS\t40",   // updates are not downloads
      "2026-06-27\tDeck\tFirst-time download\tUS\t5",
    ].join("\n");
    const byDate = parseDownloadsCsv(csv);
    expect(byDate["2026-06-28"]).toBe(6);
    expect(byDate["2026-06-27"]).toBe(5);
  });

  it("returns empty for an empty or column-less report", () => {
    expect(parseDownloadsCsv("")).toEqual({});
    expect(parseDownloadsCsv("Foo\tBar\n1\t2")).toEqual({});
  });
});
