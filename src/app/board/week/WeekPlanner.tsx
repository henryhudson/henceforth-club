"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanDay } from "@/lib/board-data";
import type { ShippedCard } from "@/lib/report-helpers";

// Published tasks may still carry `start`/`end` (the tick route preserves them);
// no week has ever set one, and nothing renders them.
const norm = (t: PlanDay["tasks"][number]): { label: string; done: boolean } =>
  typeof t === "string" ? { label: t, done: false } : { label: t.label, done: t.done ?? false };

// Amber wash + glow that lifts today out of the rail. Root tokens, not the
// --color-* aliases, so the print block's palette override reaches them too.
const TODAY_SURFACE = {
  background:
    "linear-gradient(165deg, color-mix(in srgb, var(--accent-warm) 14%, transparent), transparent 48%), var(--card-bg)",
  boxShadow: "0 0 0 1px var(--accent-warm-glow), 0 8px 28px rgba(0, 0, 0, 0.35)",
};

export default function WeekPlanner({
  days,
  weekKey,
  shipped,
}: {
  days: PlanDay[];
  weekKey: string;
  shipped: Record<string, ShippedCard[]>;
}) {
  // Optimistic overrides on top of the server's `done` state; the tick persists to Upstash.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const rail = useRef<HTMLDivElement>(null);
  const todayCard = useRef<HTMLDivElement>(null);

  const todayISO = new Date().toLocaleDateString("en-CA");
  // Dimming reads as emphasis only next to today, so an archived week renders
  // at full strength rather than uniformly grey.
  const showsToday = days.some((d) => d.date === todayISO);

  // The rail is wider than a phone — open it on today rather than on Sunday.
  // Panning the rail itself, not scrollIntoView, which also scrolls the page
  // down to fit the full height of a tall card. Landing on today's own snap
  // point, since any offset between two of them is snapped away.
  useEffect(() => {
    const track = rail.current;
    const card = todayCard.current;
    if (!track || !card) return;
    track.scrollLeft += card.getBoundingClientRect().left - track.getBoundingClientRect().left;
  }, []);

  const tick = (dayDate: string, index: number, next: boolean) => {
    setOverrides((o) => ({ ...o, [`${dayDate}:${index}`]: next }));
    fetch("/api/board/week/tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week: weekKey, day: dayDate, index, done: next }),
    }).catch(() => { /* keep the optimistic state; reconciles on reload */ });
  };

  return (
    <div
      ref={rail}
      className="mt-3 flex snap-x snap-proximity items-stretch gap-2 overflow-x-auto pb-2 text-[12.5px] print:grid print:grid-cols-4 print:overflow-visible"
    >
      {days.map((day) => {
        const tasks = day.tasks.map(norm);
        const done = tasks.map((t, i) => overrides[`${day.date}:${i}`] ?? t.done);
        const doneCount = done.filter(Boolean).length;
        const isToday = day.date === todayISO;
        const isPast = showsToday && day.date < todayISO;
        const shippedToday = shipped[day.date] ?? [];

        return (
          <div
            key={day.date}
            ref={isToday ? todayCard : undefined}
            className={`flex snap-start flex-col gap-2 border p-3 print:min-w-0 ${
              isToday
                ? "min-w-[148px] flex-[1.55_1_140px] border-accent-warm/50"
                : "min-w-[118px] flex-[1_1_0] border-card-border bg-card-bg/40 text-[11.5px]"
            } ${isPast ? "border-card-border/50 bg-card-bg/20 saturate-[0.85]" : ""}`}
            style={isToday ? TODAY_SURFACE : undefined}
          >
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className={`tracking-[0.02em] ${isToday ? "text-[18px] text-accent-warm" : "text-[15px]"}`}>
                {day.weekday}
              </span>
              <span className="text-[10.5px] text-muted">{day.date.slice(5).replace("-", "·")}</span>
              {isToday ? (
                <span className="border border-accent-warm/45 bg-accent-warm-glow px-1.5 py-px text-[9px] uppercase tracking-[0.12em] text-accent-warm">
                  today
                </span>
              ) : day.isReviewDay ? (
                <span className="border border-card-border-hover px-1.5 py-px text-[9px] uppercase tracking-[0.12em] text-muted">
                  review
                </span>
              ) : null}
              <span className={`ml-auto text-[10px] tabular-nums ${isToday ? "text-accent-warm" : "text-muted"}`}>
                {tasks.length > 0 ? `${doneCount}/${tasks.length}` : "—"}
              </span>
            </div>

            <div className="h-0.5 overflow-hidden bg-card-border" aria-hidden>
              <div
                className={`h-full ${isToday ? "bg-accent-warm" : "bg-accent-green"}`}
                style={{ width: `${tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0}%` }}
              />
            </div>

            {shippedToday.length > 0 && (
              <details open={isToday} className="text-[10.5px] text-muted">
                <summary className="cursor-pointer">
                  <span className="text-accent-green">✓</span> {shippedToday.length} shipped
                </summary>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {shippedToday.map((c) => (
                    <li key={c.id} className="line-clamp-2 border-l-2 border-accent-green/40 pl-1.5">
                      {c.title}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {tasks.length === 0 ? (
              <p className="flex-1 text-[11px] italic text-muted">clear</p>
            ) : (
              <ul className="flex flex-1 flex-col gap-[7px]">
                {tasks.map((t, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-[7px] leading-snug">
                      <input
                        type="checkbox"
                        checked={done[i]}
                        onChange={() => tick(day.date, i, !done[i])}
                        className="mt-0.5 shrink-0"
                        style={{ accentColor: "var(--accent-green)" }}
                      />
                      <span
                        className={`break-words ${
                          done[i] ? "text-muted line-through" : "text-foreground"
                        }`}
                      >
                        {t.label}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
