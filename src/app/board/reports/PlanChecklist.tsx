"use client";

import { useEffect, useState } from "react";

export type PlanItem = { id: string; tag: string; title: string; detail: string };

// Map the per-item tag chip to the site's existing accent tokens. App tags get
// their brand accent; operational tags stay neutral. Unknown tags fall back to
// the neutral style, so a new tag never breaks the render.
const TAG_CLASS: Record<string, string> = {
  hansard: "border-accent-green/60 text-accent-green",
  henceforth: "border-accent-warm/60 text-accent-warm",
  deck: "border-accent/60 text-accent",
  site: "border-accent/60 text-accent",
};
const TAG_DEFAULT = "border-card-border text-muted";

/**
 * The morning plan-of-action, rendered as a tickable checklist. Checked state
 * is persisted to localStorage keyed by the report date, so ticking an item on
 * the phone survives a reload (and is per-day, matching the local HTML report).
 */
export default function PlanChecklist({
  date,
  items,
}: {
  date: string;
  items: PlanItem[];
}) {
  const KEY = `board-plan:${date}`;
  // First render is empty (server has no localStorage) — hydrate after mount.
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
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

  const done = items.filter((i) => checked[i.id]).length;

  return (
    <div>
      <p className="mb-5 text-sm text-muted">
        Board progress:{" "}
        <span className="font-semibold text-foreground">{done}</span> / {items.length}{" "}
        cleared — options weighted by value, not a quota.
      </p>
      <ol className="flex flex-col">
        {items.map((it) => {
          const tagCls = TAG_CLASS[it.tag] ?? TAG_DEFAULT;
          const isDone = !!checked[it.id];
          return (
            <li
              key={it.id}
              className="flex gap-3 border-b border-card-border py-4 last:border-b-0"
            >
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => toggle(it.id)}
                aria-label={it.title}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-accent-green"
              />
              <div className="flex-1">
                <p
                  className={`font-semibold leading-snug ${
                    isDone ? "text-muted line-through" : "text-foreground"
                  }`}
                >
                  <span
                    className={`mr-2 rounded-full border px-2 py-0.5 align-[1px] text-[10px] font-bold uppercase tracking-wide ${tagCls}`}
                  >
                    {it.tag}
                  </span>
                  {it.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted print:hidden">{it.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
