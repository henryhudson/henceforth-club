import { promises as fs } from "fs";
import path from "path";
import { getRedis } from "@/lib/redis";
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
  site?: { yesterday: number | null; week: number; total: number };
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

export async function listDates(): Promise<string[]> {
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

export type Board = { generated: string; cards: Card[]; log?: string };

// The gardening schedule, published from Henry's laptop by publish.mjs —
// Upstash-only (the source file lives outside the repo, so there is no local
// content fallback). The diary selection lives in src/lib/gardening.ts.
export async function loadGardening(): Promise<import("./gardening").Gardening | null> {
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
  let storeFailed = false;
  try {
    const redis = getRedis();
    if (redis) {
      const data = await redis.get<Board>("board:latest");
      if (data) return { status: "ok", board: data };
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
