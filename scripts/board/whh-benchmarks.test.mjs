import { describe, expect, it } from "vitest";
import { buildBenchmarks, ciMedians, median, routeMedians, measureBenchmarks } from "./whh-benchmarks.mjs";

const run = (name, minutes, conclusion = "success", status = "completed") => ({
  name, conclusion, status,
  createdAt: "2026-09-10T08:00:00Z",
  updatedAt: new Date(Date.parse("2026-09-10T08:00:00Z") + minutes * 60000).toISOString(),
});

describe("median", () => {
  it("takes the middle value, or the mean of the two middles", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("ciMedians", () => {
  const repos = [{ key: "deck", name: "Deck of Cards", repo: "x/deck" }, { key: "hansard", name: "Hansard", repo: "x/hansard" }];

  it("gives one row per workflow with the median of the GREEN runs and the count of red ones", () => {
    const rows = ciMedians({
      deck: [run("Tests", 2.0), run("Tests", 15.0), run("Tests", 3.0), run("Tests", 40.0, "failure"), run("Tests", 1.0, "cancelled", "in_progress")],
      hansard: [],
    }, repos);
    expect(rows).toEqual([
      { key: "deck", name: "Deck of Cards", workflow: "Tests", runs: 4, medianMinutes: 3, failed: 1 },
      { key: "hansard", name: "Hansard", workflow: null, runs: 0, medianMinutes: null, failed: 0 },
    ]);
  });

  it("keeps a repository whose only runs were red, with no median", () => {
    const rows = ciMedians({ deck: [run("Tests", 9, "failure")] }, repos.slice(0, 1));
    expect(rows[0]).toMatchObject({ runs: 1, medianMinutes: null, failed: 1 });
  });
});

describe("routeMedians", () => {
  it("collapses samples per route into a median and a worst, in whole milliseconds", () => {
    const rows = routeMedians([
      { url: "https://henceforth.club/", ms: 120.4, status: 200 },
      { url: "https://henceforth.club/", ms: 80.2, status: 200 },
      { url: "https://henceforth.club/", ms: 300.9, status: 200 },
      { url: "https://henceforth.club/learn", ms: null, status: null, error: "down" },
    ]);
    expect(rows).toEqual([
      { url: "https://henceforth.club/", path: "/", samples: 3, medianMs: 120, worstMs: 301, status: 200 },
      { url: "https://henceforth.club/learn", path: "/learn", samples: 1, medianMs: null, worstMs: null, status: null },
    ]);
  });
});

describe("buildBenchmarks", () => {
  it("names every instrument, measured or missing, and counts them", () => {
    const table = buildBenchmarks({
      ci: [{ key: "deck", name: "Deck of Cards", workflow: "Tests", runs: 4, medianMinutes: 3, failed: 1 }],
      routes: [],
      measuredAt: "2026-09-13T09:00:00Z",
    });
    expect(table.instruments.map((i) => [i.key, i.status])).toEqual([
      ["continuous-integration", "measured"],
      ["site-routes", "missing"],
      ["render-pipeline", "missing"],
    ]);
    expect(table.measured).toBe(1);
    expect(table.missing).toBe(2);
    expect(table.instruments[2].note).toMatch(/Nothing records them yet/);
  });

  it("FAILS when nothing at all was measured, so the table cannot lapse quietly", () => {
    expect(() => buildBenchmarks({ ci: [], routes: [], measuredAt: "2026-09-13T09:00:00Z" }))
      .toThrow(/does not run without it/);
  });
});

describe("measureBenchmarks", () => {
  it("reads GitHub through gh and samples each route three times, then builds the table", async () => {
    const calls = [];
    const exec = async (cmd, args) => {
      calls.push([cmd, args[3]]);
      return { stdout: JSON.stringify([run("Tests", 4), run("Tests", 6)]) };
    };
    const fetchImpl = async () => ({ status: 200, arrayBuffer: async () => new ArrayBuffer(0) });
    const table = await measureBenchmarks({
      since: "2026-09-07", measuredAt: "2026-09-13T09:00:00Z",
      repos: [{ key: "deck", name: "Deck of Cards", repo: "x/deck" }],
      routes: ["https://henceforth.club/"],
      exec, fetchImpl,
    });
    expect(calls).toEqual([["gh", "x/deck"]]);
    expect(table.instruments[0].rows[0]).toMatchObject({ workflow: "Tests", runs: 2, medianMinutes: 5 });
    expect(table.instruments[1].rows[0]).toMatchObject({ path: "/", samples: 3, status: 200 });
    expect(table.measured).toBe(2);
  });

  it("still builds the table when GitHub cannot be read, from the routes alone", async () => {
    const exec = async () => { throw new Error("gh: not signed in"); };
    const fetchImpl = async () => ({ status: 200, arrayBuffer: async () => new ArrayBuffer(0) });
    const table = await measureBenchmarks({
      since: "2026-09-07", measuredAt: "2026-09-13T09:00:00Z",
      repos: [{ key: "deck", name: "Deck of Cards", repo: "x/deck" }],
      routes: ["https://henceforth.club/"], exec, fetchImpl,
    });
    expect(table.instruments[0].status).toBe("missing");
    expect(table.instruments[1].status).toBe("measured");
  });
});
