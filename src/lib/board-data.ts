import { promises as fs } from "fs";
import path from "path";
import { getRedis } from "@/lib/redis";
import {
  ARCHIVE_ADDRESS_DEFAULT,
  SURFACE,
  readFromHead,
  reportDateOf,
  resolveHead,
  weekDateOf,
  type HeadResolution,
} from "./chain-archive";
import type { PlanItem } from "@/app/board/reports/PlanChecklist";
import type { Card } from "@/app/board/BoardClient";

export type Finding = {
  refId: string;
  title: string;
  kind: string;
  verdict: string;
  confidence: string;
  evidence: string;
  falsification?: string;
  recommendation?: string;
};
export type AppReport = {
  app: string;
  name: string;
  headSha: string;
  reviewFound: boolean;
  findings: Finding[];
  note?: string;
};
export type Plan = {
  lead?: string;
  note?: string;
  items: PlanItem[];
  notToday?: string | string[];
  decisions?: string | string[];
};
export type ArticleSection = { heading: string; body: string };
export type Article = { headline: string; lede: string; sections: ArticleSection[] };
export type ReachYesterday = { date: string | null; count: number | null };
export type ReachApp = {
  app: string;
  yesterday: ReachYesterday;
  week?: Record<string, number>;
  rating?: { average: number | null; count: number };
  subscriptions?: { date: string; paying: number; trial: number; monthly: number; yearly: number };
};
export type Reach = {
  dataThrough?: string | null;
  perApp: ReachApp[];
  site?: { yesterday: number | null; week: number | null; total: number };
};
export type Decision = { card: string; proposal: string; why: string };
export type Emergency = {
  tag: string;
  title: string;
  why: string;
  card?: string;
};
export type AppStoreRow = {
  app: string;
  status: string;
  version: string;
  daysSince: number | null;
  readyToShip: string;
  blocker: string;
};
export type AppStore = {
  shipDay: string;
  rule: string;
  apps: AppStoreRow[];
};
export type Report = {
  date: string;
  generatedAt: string;
  summary: Record<string, number>;
  emergencies?: Emergency[];
  appStore?: AppStore;
  apps: AppReport[];
  plan?: Plan;
  article?: Article;
  reach?: Reach;
  decisions?: Decision[];
};

const DIR = path.join(process.cwd(), "content/board/reports");

// ---- The chain, tried first ----
//
// The archive address's newest inscription is the index (src/lib/chain-archive.ts).
// Every seam below asks the chain first and falls back to the store, then the
// local file, so a rollback is a change of order, never a migration.
//
// A cold chain read is two or three indexer calls, and the design rule is that
// no reader ever waits on one. The board pages are cookie-gated and rendered
// per request, so the edge cache cannot hold them; the memo lives in the
// function instance instead, and a warm instance shares one resolved head and
// one copy of each document across its window. Sixty seconds: publishes
// happen a few times a day, a reader a minute behind is fine, and a reader
// ten minutes behind on ship day is not. A failed chain read is memoised too,
// so a dead indexer is not hammered on every request while the store serves.
const CHAIN_MEMO_MS = 60_000;
// The in-flight promise is memoised, not the settled value, so two seams
// asked in the same instant (the board's two halves, say) share one head
// resolution instead of racing past an empty memo into two.
const chainMemo = new Map<string, { until: number; value: Promise<unknown> }>();
export function resetChainMemoForTests(): void {
  chainMemo.clear();
}
async function memoised<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = chainMemo.get(key);
  if (hit && hit.until > Date.now()) return hit.value as Promise<T>;
  const value = load();
  chainMemo.set(key, { until: Date.now() + CHAIN_MEMO_MS, value });
  try {
    return await value;
  } catch (e) {
    chainMemo.delete(key); // a thrown load is not a result worth keeping for a minute
    throw e;
  }
}

/** Chain reads happen only where the archive key is configured; without it
 *  the seams behave exactly as before. */
function archive(): { address: string; keyHex: string } | null {
  const keyHex = process.env.BOARD_ARCHIVE_KEY;
  return keyHex ? { address: process.env.BOARD_ARCHIVE_ADDRESS ?? ARCHIVE_ADDRESS_DEFAULT, keyHex } : null;
}

async function chainHead(): Promise<HeadResolution | null> {
  const config = archive();
  if (!config) return null;
  return memoised("head", () => resolveHead(config));
}

async function chainDocument<T>(surface: string): Promise<T | null> {
  const config = archive();
  if (!config) return null;
  return memoised(`surface:${surface}`, async () => {
    const resolved = await chainHead();
    if (!resolved || resolved.status !== "ok") return null;
    const read = await readFromHead({ resolved, surface, keyHex: config.keyHex });
    if (read.status !== "ok") return null;
    try {
      return JSON.parse(Buffer.from(read.document).toString("utf8")) as T;
    } catch {
      return null;
    }
  });
}

/** The transaction the head names for a surface, or null when the chain is
 *  not consulted, has no head, or does not name it. */
export async function chainSurfaceTxid(surface: string): Promise<string | null> {
  const resolved = await chainHead();
  if (!resolved || resolved.status !== "ok") return null;
  return resolved.head.surfaces[surface] ?? null;
}

/** The dates the head names under a surface prefix, newest first; null when
 *  the chain is not consulted or has nothing to say. */
async function chainDates(dateOf: (surface: string) => string | null): Promise<string[] | null> {
  const resolved = await chainHead();
  if (!resolved || resolved.status !== "ok") return null;
  const dates = Object.keys(resolved.head.surfaces).map(dateOf).filter((d): d is string => d !== null);
  return dates.length ? dates.sort().reverse() : null;
}

export async function listDates(): Promise<string[]> {
  const fromChain = await chainDates(reportDateOf);
  if (fromChain) return fromChain;
  try {
    const redis = getRedis();
    if (redis) {
      const dates = await redis.smembers("board:report:dates");
      if (dates && dates.length) return [...dates].sort().reverse();
    }
  } catch {
    // Cap or transport failure: files still serve.
  }
  try {
    const files = await fs.readdir(DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function loadReport(date: string): Promise<Report | null> {
  const fromChain = await chainDocument<Report>(SURFACE.report(date));
  if (fromChain) return fromChain;
  try {
    const redis = getRedis();
    if (redis) {
      const r = await redis.get<Report>(`board:report:${date}`);
      if (r) return r;
    }
  } catch {
    // Cap or transport failure: files still serve.
  }
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, `${date}.json`), "utf8")) as Report;
  } catch {
    return null;
  }
}

export type NextItem = { tag: string; title: string; detail: string };
export type Reflag = { signature: string; app: string; title: string; timesFlagged: number; firstSeen: string; status: string };
export type Stuck = { id: string; title: string; app: string; col: string; firstSeen: string };
export type AppSales = {
  app: string; name: string;
  units: { thisWeek: number; lastWeek: number; deltaPct: number | null };
  proceeds: { thisWeek: number; lastWeek: number; currency: string | null; deltaPct: number | null };
};
export type WeekDay = { date: string; weekday: string; reviews: number; hasReport: boolean };
export type PlanDay = { date: string; weekday: string; isReviewDay: boolean; tasks: (string | { label: string; start?: number; end?: number; done?: boolean })[] };
export type AppState = {
  app: string; name: string;
  downloads: { thisWeek: number; lastWeek: number; deltaPct: number | null } | null;
  rating: { average: number | null; count: number; version?: string | null };
  analytics: { activeUsers?: number; retention?: number; crashRate?: number } | null;
  verdict: string | null;
};
export type WeekReport = {
  weekOf: string; weekEnd: string; daysCovered: string[];
  retro: {
    totals: Record<string, number>;
    throughput: { stuck: Stuck[] };
    recurringReflags: Reflag[];
    weekStrip: WeekDay[];
    weekPlan: PlanDay[];
    appState: AppState[];
    stateOfUnion: string;
    wins: (string | NextItem)[]; misses: (string | NextItem)[]; nextWeek: NextItem[];
  };
  sales: { perApp: AppSales[]; drivers: { app: string; lever: string; rationale: string; action: string }[]; note?: string; source?: string };
};

const WEEKS_DIR = path.join(process.cwd(), "content/board/weeks");

export async function listWeeks(): Promise<string[]> {
  const fromChain = await chainDates(weekDateOf);
  if (fromChain) return fromChain;
  try {
    const redis = getRedis();
    if (redis) {
      const ws = await redis.smembers("board:weeks");
      if (ws && ws.length) return [...ws].sort().reverse();
    }
  } catch {
    // Cap or transport failure: files still serve.
  }
  try {
    const files = await fs.readdir(WEEKS_DIR);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort().reverse();
  } catch { return []; }
}

export async function loadWeek(date: string): Promise<WeekReport | null> {
  const fromChain = await chainDocument<WeekReport>(SURFACE.week(date));
  if (fromChain) return fromChain;
  try {
    const redis = getRedis();
    if (redis) {
      const w = await redis.get<WeekReport>(`board:week:${date}`);
      if (w) return w;
    }
  } catch {
    // Cap or transport failure: files still serve.
  }
  try { return JSON.parse(await fs.readFile(path.join(WEEKS_DIR, `${date}.json`), "utf8")) as WeekReport; }
  catch { return null; }
}

export type BoardWeek = {
  weekOf: string;
  generatedAt?: string;
  stateOfUnion?: string;
  weekPlan: PlanDay[];
};
export type Board = { generated: string; generatedAt?: string; cards: Card[]; log?: string; week?: BoardWeek };

// The gardening schedule, published from Henry's laptop by publish.mjs —
// Upstash-only (the source file lives outside the repo, so there is no local
// content fallback). The diary selection lives in src/lib/gardening.ts.
export async function loadGardening(): Promise<import("./gardening").Gardening | null> {
  const fromChain = await chainDocument<import("./gardening").Gardening>(SURFACE.gardening);
  if (fromChain) return fromChain;
  try {
    const redis = getRedis();
    if (redis) {
      const g = await redis.get<import("./gardening").Gardening>("board:gardening");
      if (g) return g;
    }
  } catch {
    // Cap or transport failure: no local schedule file in the repo.
  }
  return null;
}

/** Why the board is not here. "empty" means nothing has ever been published;
 *  "unavailable" means the store refused or failed. The difference matters to
 *  the reader: one is a missing routine, the other is a broken pipe, and the
 *  page must not blame the first for the second. */
export type BoardResult =
  | { status: "ok"; board: Board }
  | { status: "empty" }
  | { status: "unavailable" };

// Production reads the kanban from Upstash (written by /hh's publish step).
// Local dev falls back to the gitignored content file — note that content/board
// is NOT tracked, so in production this fallback never fires and the store is
// the only source.
export async function loadBoardResult(): Promise<BoardResult> {
  // The chain carries the board as two documents — the live columns and the
  // done ledger (scripts/board/chain-publish-core.mjs, splitBoard). Both or
  // neither: half a board would render a Done column that lies.
  const [latest, done] = await Promise.all([
    chainDocument<Board>(SURFACE.board),
    chainDocument<{ cards: Card[] }>(SURFACE.done),
  ]);
  if (latest && done) return { status: "ok", board: { ...latest, cards: [...latest.cards, ...done.cards] } };
  let storeFailed = false;
  try {
    const redis = getRedis();
    if (redis) {
      const data = await redis.get<Board>("board:latest");
      if (data) return { status: "ok", board: data };
    } else {
      // No store configured is a store the site cannot see, not a board that
      // was never published; the page must not send the reader to run /hh.
      storeFailed = true;
    }
  } catch {
    // Over the request cap, or the transport died. Not the same as no board.
    storeFailed = true;
  }
  try {
    const file = path.join(process.cwd(), "content/board/latest.json");
    return { status: "ok", board: JSON.parse(await fs.readFile(file, "utf8")) as Board };
  } catch {
    return storeFailed ? { status: "unavailable" } : { status: "empty" };
  }
}

export async function loadBoard(): Promise<Board | null> {
  try {
    const r = await loadBoardResult();
    return r.status === "ok" ? r.board : null;
  } catch {
    return null;
  }
}
