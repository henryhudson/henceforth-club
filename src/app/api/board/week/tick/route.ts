import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/board-auth";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

// Persist a planner tick. Gated by the same board session the pages use, so it
// is not modifiable by the public. Marks (or clears) `done` on one major event
// in the published week, which both renders it struck-through and makes the
// daily roll-forward leave it behind instead of carrying it to today.
export async function POST(req: Request) {
  const secret = process.env.BOARD_COOKIE_SECRET ?? "";
  const token = (await cookies()).get("board_session")?.value;
  if (!secret || !(await verifySession(token, secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { week?: string; day?: string; index?: number; done?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { week, day, index, done } = body;
  if (typeof week !== "string" || typeof day !== "string" || typeof index !== "number") {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "no store" }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = await redis.get<any>(`board:week:${week}`);
  const dayEntry = w?.retro?.weekPlan?.find((d: { date: string }) => d.date === day);
  const task = dayEntry?.tasks?.[index];
  if (task === undefined) return NextResponse.json({ error: "no task" }, { status: 404 });

  const base: { label: string; start?: number; end?: number } = { label: typeof task === "string" ? task : task.label };
  if (typeof task === "object") {
    if (task.start != null) base.start = task.start;
    if (task.end != null) base.end = task.end;
  }
  dayEntry.tasks[index] = done ? { ...base, done: true } : base;
  await redis.set(`board:week:${week}`, w);
  return NextResponse.json({ ok: true });
}
