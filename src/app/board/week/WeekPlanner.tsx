"use client";

import { useEffect, useState } from "react";

type Task = string | { label: string; start?: number; end?: number; done?: boolean };
type PlanDay = { date: string; weekday: string; isReviewDay: boolean; tasks: Task[] };

// Henry's planner palette — one highlighter colour per day.
const DAY_COLOR: Record<string, string> = {
  Sun: "#f87171", // red
  Mon: "#4ade80", // green
  Tue: "#c084fc", // purple
  Wed: "#fb923c", // orange
  Thu: "#ffffff", // white
  Fri: "#60a5fa", // blue
  Sat: "#fde047", // yellow
};

const norm = (t: Task): { label: string; start?: number; end?: number; done?: boolean } =>
  typeof t === "string" ? { label: t } : t;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

// 0–24h timeline geometry.
const PX_PER_HOUR = 15;
const BODY_H = 24 * PX_PER_HOUR;
const GRID_HOURS = [0, 4, 8, 12, 16, 20, 24];

export default function WeekPlanner({ days, weekOf }: { days: PlanDay[]; weekOf: string }) {
  const storageKey = `board-weekplan:${weekOf}`;
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(storageKey) ?? "{}")); } catch { /* first visit */ }
    setReady(true);
  }, [storageKey]);

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage off */ }
      return next;
    });

  return (
    <div className="mt-3 overflow-x-auto pb-2">
      <div className="grid min-w-[760px] grid-cols-7 gap-2">
        {days.map((day) => {
          const tasks = day.tasks.map(norm);
          return (
            <div key={day.date} className="flex flex-col overflow-hidden rounded-md border border-card-border bg-card-bg/20">
              <div
                className="flex items-baseline justify-between gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
                style={{ color: "#1c1917", backgroundColor: DAY_COLOR[day.weekday] ?? "#e5e7eb", borderBottom: "1px solid var(--color-card-border)" }}
              >
                <span>{day.weekday}{day.isReviewDay ? " ★" : ""}</span>
                <span className="font-normal opacity-70">{day.date.slice(5)}</span>
              </div>

              <ul className="space-y-1.5 p-2">
                {tasks.length === 0 && <li className="text-xs text-muted">&mdash;</li>}
                {tasks.map((t, i) => {
                  const id = `${day.date}:${i}`;
                  const checked = ready && !!done[id];
                  return (
                    <li key={i}>
                      <label className="flex cursor-pointer items-start gap-1.5 text-xs leading-snug">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(id)}
                          className="mt-0.5 shrink-0"
                          style={{ accentColor: "var(--color-accent-green)" }}
                        />
                        <span className={(checked || t.done) ? "text-muted line-through" : "text-foreground"}>
                          {t.start != null && <span className="mr-1 font-bold text-muted">{hh(t.start)}</span>}
                          {t.label}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

                <div className="relative mx-2 mb-2 mt-auto" style={{ height: BODY_H }}>
                  {GRID_HOURS.map((h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-card-border/40" style={{ top: h * PX_PER_HOUR }}>
                      <span className="absolute -top-1.5 left-0 text-[9px] text-muted">{hh(h)}</span>
                    </div>
                  ))}
                  {tasks
                    .filter((t) => t.start != null && t.end != null)
                    .map((t, i) => {
                      const top = (t.start as number) * PX_PER_HOUR;
                      const height = Math.max(13, ((t.end as number) - (t.start as number)) * PX_PER_HOUR - 2);
                      return (
                        <div
                          key={i}
                          title={`${hh(t.start as number)}–${hh(t.end as number)} ${t.label}`}
                          className="absolute right-0 left-8 overflow-hidden rounded-sm px-1 py-0.5 text-[9px] leading-tight"
                          style={{ top, height, backgroundColor: (DAY_COLOR[day.weekday] ?? "#cbd5e1") + "66", color: "#1c1917" }}
                        >
                          <span className="font-bold">{hh(t.start as number)}</span> {t.label}
                        </div>
                      );
                    })}
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
