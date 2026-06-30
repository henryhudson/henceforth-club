"use client";

import { useEffect, useState } from "react";

type PlanDay = { date: string; weekday: string; isReviewDay: boolean; tasks: string[] };

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
        {days.map((day) => (
          <div key={day.date} className="flex flex-col overflow-hidden rounded-md border border-card-border bg-card-bg/20">
            <div
              className="flex items-baseline justify-between gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: "#1c1917", backgroundColor: DAY_COLOR[day.weekday] ?? "#e5e7eb", borderBottom: "1px solid var(--color-card-border)" }}
            >
              <span>{day.weekday}{day.isReviewDay ? " ★" : ""}</span>
              <span className="font-normal opacity-70">{day.date.slice(5)}</span>
            </div>
            <ul className="flex-1 space-y-1.5 p-2">
              {day.tasks.length === 0 && <li className="text-xs text-muted">&mdash;</li>}
              {day.tasks.map((task, i) => {
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
                      <span className={checked ? "text-muted line-through" : "text-foreground"}>{task}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
