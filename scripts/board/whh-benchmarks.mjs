// The weekly benchmarks: the instruments the review measures every Sunday so
// the week is judged against numbers ("everything needs to be faster and
// smoother each week", Henry, 2026-08-10). Booked as a separate appointment
// and missed five Sundays running (16 Aug, 23 Aug, 30 Aug, 6 Sep, 12 Sep);
// from 13 September 2026 it is a step of the weekly run, and the run FAILS
// when no instrument could be read, so the table cannot lapse quietly again.
//
// Three instruments, each named whether or not it could be measured:
//   1. continuous integration: the median wall time per workflow per repository
//      over the reviewed week, read from GitHub through the gh command;
//   2. site routes: time to first byte for the club's public routes, sampled
//      live at run time;
//   3. the render pipeline: pass times for the sheets and the episode cuts,
//      which nothing records yet, so the row says so.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export const REPOS = [
  { key: "deck", name: "Deck of Cards", repo: "henryhudson/DaDeckOfCards" },
  { key: "henceforth", name: "Henceforth", repo: "henryhudson/Henceforth" },
  { key: "hansard", name: "Hansard", repo: "henryhudson/Hansard" },
  { key: "site", name: "henceforth.club", repo: "henryhudson/henceforth-club" },
];

export const ROUTES = [
  "https://henceforth.club/",
  "https://henceforth.club/learn",
  "https://henceforth.club/board/login",
];

export function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

/**
 * Pure. One row per repository and workflow: how many runs completed in the
 * window, the median minutes of the green ones (creation to completion, so a
 * queue on the Mac mini counts, because that is the time Henry waits), and
 * how many ended red. A repository with no runs still gets a row, so the
 * table says "quiet" rather than omitting it.
 */
export function ciMedians(runsByRepo, repos = REPOS) {
  const rows = [];
  for (const { key, name } of repos) {
    const runs = (runsByRepo[key] ?? []).filter((r) => r.status === "completed");
    if (runs.length === 0) {
      rows.push({ key, name, workflow: null, runs: 0, medianMinutes: null, failed: 0 });
      continue;
    }
    const byWorkflow = new Map();
    for (const r of runs) {
      const list = byWorkflow.get(r.name) ?? [];
      list.push(r);
      byWorkflow.set(r.name, list);
    }
    for (const [workflow, list] of [...byWorkflow.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const minutes = list
        .filter((r) => r.conclusion === "success")
        .map((r) => (new Date(r.updatedAt) - new Date(r.createdAt)) / 60000);
      rows.push({
        key, name, workflow,
        runs: list.length,
        medianMinutes: round1(median(minutes)),
        failed: list.filter((r) => r.conclusion === "failure").length,
      });
    }
  }
  return rows;
}

/** Pure. One row per route: the median and the worst of its samples, in whole milliseconds. */
export function routeMedians(samples) {
  const byUrl = new Map();
  for (const s of samples) {
    const list = byUrl.get(s.url) ?? [];
    list.push(s);
    byUrl.set(s.url, list);
  }
  return [...byUrl.entries()].map(([url, list]) => {
    const ok = list.filter((s) => s.ms != null);
    return {
      url,
      path: new URL(url).pathname,
      samples: list.length,
      medianMs: ok.length ? Math.round(median(ok.map((s) => s.ms))) : null,
      worstMs: ok.length ? Math.round(Math.max(...ok.map((s) => s.ms))) : null,
      status: ok[0]?.status ?? list[0]?.status ?? null,
    };
  });
}

/**
 * Pure. The table: every instrument present, measured or missing by name.
 * Throws when nothing at all was measured, which fails the weekly run: the
 * point of folding the table into the run is that it can no longer lapse.
 */
export function buildBenchmarks({ ci, routes, measuredAt }) {
  const ciRows = ci ?? [];
  const routeRows = routes ?? [];
  const instruments = [
    {
      key: "continuous-integration",
      name: "Continuous integration, median minutes per workflow",
      unit: "minutes",
      status: ciRows.length ? "measured" : "missing",
      rows: ciRows,
      note: ciRows.length ? "Creation to completion, so time queued on the Mac mini counts." : "GitHub could not be read this run.",
    },
    {
      key: "site-routes",
      name: "Site routes, time to first byte",
      unit: "milliseconds",
      status: routeRows.some((r) => r.medianMs != null) ? "measured" : "missing",
      rows: routeRows,
      note: routeRows.some((r) => r.medianMs != null) ? "Three samples a route from this machine at run time." : "The site could not be reached this run.",
    },
    {
      key: "render-pipeline",
      name: "Render pipeline, pass times for the sheets and the episode cuts",
      unit: "seconds",
      status: "missing",
      rows: [],
      note: "Nothing records them yet: render-pdf.mjs and the episode pipeline log no timings.",
    },
  ];
  const measured = instruments.filter((i) => i.status === "measured").length;
  if (measured === 0) {
    throw new Error("The benchmark table is empty: no instrument could be read, and the weekly review does not run without it.");
  }
  return { measuredAt, instruments, measured, missing: instruments.length - measured };
}

// ── I/O ────────────────────────────────────────────────────────────────────

/** GitHub through the gh command, which is signed in on this machine. */
export async function fetchRuns(repo, since, exec = execFileP) {
  const { stdout } = await exec("gh", [
    "run", "list", "--repo", repo, "--limit", "100", "--created", `>=${since}`,
    "--json", "name,conclusion,status,createdAt,updatedAt",
  ]);
  return JSON.parse(stdout);
}

/** Time to first byte of the page itself: redirects are followed as a browser would (the apex 307s to www), and the clock stops when the final response headers arrive, not when the body ends. */
export async function sampleRoute(url, fetchImpl = fetch) {
  const started = performance.now();
  try {
    const res = await fetchImpl(url, { redirect: "follow", headers: { "user-agent": "whh-benchmarks" } });
    const ms = performance.now() - started;
    try { await res.arrayBuffer(); } catch { /* the body is not the measurement */ }
    return { url, ms, status: res.status };
  } catch (error) {
    return { url, ms: null, status: null, error: String(error?.message ?? error) };
  }
}

export async function measureBenchmarks({ since, measuredAt, repos = REPOS, routes = ROUTES, samplesPerRoute = 3, exec, fetchImpl }) {
  const runsByRepo = {};
  for (const r of repos) {
    try { runsByRepo[r.key] = await fetchRuns(r.repo, since, exec); }
    catch { runsByRepo[r.key] = null; }
  }
  const anyRead = Object.values(runsByRepo).some((v) => Array.isArray(v));
  const ci = anyRead ? ciMedians(runsByRepo, repos) : [];
  const samples = [];
  for (const url of routes) {
    for (let i = 0; i < samplesPerRoute; i++) samples.push(await sampleRoute(url, fetchImpl));
  }
  return buildBenchmarks({ ci, routes: routeMedians(samples), measuredAt });
}
