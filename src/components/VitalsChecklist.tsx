"use client";

import { useEffect, useState } from "react";
import type { Vital } from "@/lib/report-vitals";

/**
 * The morning's vital list, ticked. Checked state is kept per day in
 * localStorage, like the plan checklist beneath it, so a tick on the phone
 * survives a reload and tomorrow starts clean.
 */
export default function VitalsChecklist({ date, vitals }: { date: string; vitals: Vital[] }) {
  const KEY = `board-vitals:${date}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* a browser that refuses storage still ticks, it just forgets */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const done = vitals.filter((v) => checked[v.id]).length;

  return (
    <div>
      <p className="mb-3 text-center font-serif text-[12px] text-muted">
        <span className="font-semibold text-foreground">{done}</span> / {vitals.length} done
      </p>
      <ul className="flex flex-col gap-1">
        {vitals.map((v) => {
          const isDone = !!checked[v.id];
          return (
            <li key={v.id}>
              <label className="flex cursor-pointer items-baseline gap-2 py-1">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggle(v.id)}
                  className="mt-[2px] h-4 w-4 flex-none accent-accent"
                />
                <span className="font-serif text-[14px] leading-snug">
                  <span className={isDone ? "text-muted line-through" : "font-semibold text-foreground"}>
                    {v.label}
                  </span>
                  {v.source === "standing" && (
                    <span className="ml-2 align-middle font-sans text-[10px] uppercase tracking-[0.14em] text-muted">
                      every day
                    </span>
                  )}
                  {v.note && <span className="block text-[12px] text-muted">{v.note}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
