import { promises as fs } from "fs";
import path from "path";
import { getRedis } from "@/lib/redis";
import type { PlanItem } from "@/app/board/report/PlanChecklist";

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
  notToday?: string;
  decisions?: string;
};
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
};

const DIR = path.join(process.cwd(), "content/board/reports");

export async function listDates(): Promise<string[]> {
  const redis = getRedis();
  if (redis) {
    const dates = await redis.smembers("board:report:dates");
    if (dates && dates.length) return [...dates].sort().reverse();
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
  const redis = getRedis();
  if (redis) {
    const r = await redis.get<Report>(`board:report:${date}`);
    if (r) return r;
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
    wins: string[]; misses: string[]; nextWeek: NextItem[];
  };
  sales: { perApp: AppSales[]; drivers: { app: string; lever: string; rationale: string; action: string }[]; note?: string; source?: string };
};

const WEEKS_DIR = path.join(process.cwd(), "content/board/weeks");

export async function listWeeks(): Promise<string[]> {
  const redis = getRedis();
  if (redis) {
    const ws = await redis.smembers("board:weeks");
    if (ws && ws.length) return [...ws].sort().reverse();
  }
  try {
    const files = await fs.readdir(WEEKS_DIR);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort().reverse();
  } catch { return []; }
}

export async function loadWeek(date: string): Promise<WeekReport | null> {
  const redis = getRedis();
  if (redis) {
    const w = await redis.get<WeekReport>(`board:week:${date}`);
    if (w) return w;
  }
  try { return JSON.parse(await fs.readFile(path.join(WEEKS_DIR, `${date}.json`), "utf8")) as WeekReport; }
  catch { return null; }
}
