"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlanDay } from "@/lib/board-data";
import "./morning-board.css";
import type { Freshness } from "@/lib/board-freshness";

export type Card = {
  id: string;
  col: string;
  kind: string;
  phase?: string;
  apps: string[];
  title: string;
  desc?: string;
  source?: string;
  rev?: number;
  movedAt?: string;
  doneAt?: string;
};

export type WeekSlice = {
  weekEnd: string;
  generatedAt?: string;
  stateOfUnion?: string;
  weekPlan: PlanDay[];
};

const COLUMNS = [
  { id: "backlog", name: "Backlog" },
  { id: "todo", name: "To do" },
  { id: "inprogress", name: "In progress" },
  { id: "review", name: "Review" },
] as const;

const COL_IDS = [...COLUMNS.map((c) => c.id), "done"];

const APP_FILTERS = [
  { id: "all", name: "Overall" },
  { id: "deck", name: "Deck" },
  { id: "henceforth", name: "Henceforth" },
  { id: "hansard", name: "Hansard" },
  { id: "site", name: "Site" },
];

const APP_HUE: Record<string, string> = {
  henceforth: "var(--mb-henceforth)",
  deck: "var(--mb-deck)",
  hansard: "var(--mb-hansard)",
  site: "var(--mb-site)",
  "*": "var(--mb-any)",
};

const STORE = "henceforth-board-web-v1";
const THEME_KEY = "henceforth-board-theme";

function kindClass(kind: string): string {
  if (kind === "gate") return "gate";
  if (kind === "finding") return "finding";
  return "";
}

function kindMark(kind: string): string {
  switch (kind) {
    case "finding":
      return "▲";
    case "gate":
      return "◆";
    case "feature":
      return "●";
    case "dep":
      return "⇣";
    default:
      return "—";
  }
}

function reconcile(
  data: Card[],
  saved: Record<string, { col: string; rev: number; movedAt?: string; doneAt?: string }>,
): Card[] {
  return data.map((c) => {
    const prev = saved[c.id];
    const dRev = c.rev ?? 0;
    if (prev && COL_IDS.includes(prev.col) && prev.rev >= dRev) {
      if (!prev.movedAt) return { ...c, col: prev.col };
      return { ...c, col: prev.col, movedAt: prev.movedAt, doneAt: prev.doneAt };
    }
    return { ...c };
  });
}

function shortTitle(t: string): string {
  const words = t.split(/\s+/);
  return words.length <= 8 ? t : words.slice(0, 8).join(" ") + " …";
}

function taskLabel(t: string | { label: string; done?: boolean }): string {
  return typeof t === "string" ? t : t.label;
}

function taskDone(t: string | { label: string; done?: boolean }): boolean {
  return typeof t !== "string" && t.done === true;
}

export default function BoardClient({
  generated,
  freshness,
  initialCards,
  week,
  sheetDate,
}: {
  generated: string;
  /** How old the served board is, computed on the server. */
  freshness?: Freshness;
  initialCards: Card[];
  week: WeekSlice | null;
  /** Today in London, from the server: the day's printed sheet is dated by it. */
  sheetDate: string;
}) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [filter, setFilter] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const todayISO = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const todayRef = useRef<HTMLDivElement | null>(null);
  const weekRef = useRef<HTMLElement | null>(null);
  const meridianRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setCards(reconcile(initialCards, JSON.parse(raw)));
    } catch {
      /* ignore */
    }
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "dark" || t === "light") setTheme(t);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [week]);

  useEffect(() => {
    function lightBand() {
      const m = meridianRef.current;
      const day = todayRef.current;
      const rail = weekRef.current;
      if (!m || !day || !rail) {
        if (m) m.style.background = "transparent";
        return;
      }
      const r = day.getBoundingClientRect();
      const rr = rail.getBoundingClientRect();
      const a = r.left - rr.left;
      const b = a + r.width;
      const mid = a + r.width / 2;
      m.style.background = `linear-gradient(90deg, transparent ${Math.max(0, a - 24)}px, color-mix(in srgb, var(--mb-amber) 20%, transparent) ${a}px, var(--mb-amber) ${mid}px, color-mix(in srgb, var(--mb-amber) 20%, transparent) ${b}px, transparent ${b + 24}px)`;
    }
    lightBand();
    window.addEventListener("resize", lightBand);
    const rail = weekRef.current;
    rail?.addEventListener("scroll", lightBand, { passive: true });
    return () => {
      window.removeEventListener("resize", lightBand);
      rail?.removeEventListener("scroll", lightBand);
    };
  }, [week, cards, theme]);

  function tick(dayDate: string, index: number, next: boolean) {
    setTicks((o) => ({ ...o, [`${dayDate}:${index}`]: next }));
    fetch("/api/board/week/tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week: week?.weekEnd, day: dayDate, index, done: next }),
    }).catch(() => {
      /* keep the optimistic state; reconciles on reload */
    });
  }

  function persist(next: Card[]) {
    const map: Record<string, { col: string; rev: number; movedAt?: string; doneAt?: string }> = {};
    for (const c of next)
      map[c.id] = { col: c.col, rev: c.rev ?? 0, movedAt: c.movedAt, doneAt: c.doneAt };
    try {
      localStorage.setItem(STORE, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function move(id: string, targetCol: string) {
    const now = new Date().toISOString();
    setCards((prev) => {
      const next = prev.map((c) =>
        c.id === id
          ? {
              ...c,
              col: targetCol,
              movedAt: now,
              doneAt: targetCol === "done" ? now : undefined,
            }
          : c,
      );
      persist(next);
      return next;
    });
  }

  const inScope = (c: Card) =>
    filter === "all" || c.apps.includes("*") || c.apps.includes(filter);
  const shown = cards.filter(inScope);

  const weekDates = new Set((week?.weekPlan ?? []).map((d) => d.date));
  const doneCards = shown.filter((c) => c.col === "done");
  const shippedByDay: Record<string, Card[]> = {};
  const doneArchive: Card[] = [];
  for (const c of doneCards) {
    const d = (c.doneAt || c.movedAt || "").slice(0, 10);
    if (weekDates.has(d)) (shippedByDay[d] = shippedByDay[d] || []).push(c);
    else doneArchive.push(c);
  }
  doneArchive.sort((a, b) =>
    (b.doneAt || b.movedAt || "").localeCompare(a.doneAt || a.movedAt || ""),
  );

  const todayLong = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="morning-board" data-theme={theme}>
      <div className="mb-shell">
        <header className="mb-header">
          <div className="mb-brand">
            <span className="mb-eyebrow">Henceforth Bitcoin Limited</span>
            <h1 className="mb-title">
              The <em>Morning</em> Board
            </h1>
          </div>
          <div className="mb-dateline">
            <div className="mb-today-long">{todayLong}</div>
            <div className="mb-stamps">
              board {generated.split(" · ")[0]}
              {freshness &&
                (freshness.stale ? (
                  <strong title="This board is older than a day. The store it is published from may not be accepting writes.">
                    {" · "}
                    {freshness.label}
                  </strong>
                ) : (
                  <>{` · ${freshness.label}`}</>
                ))}
              {week?.generatedAt ? ` · week ${week.generatedAt.slice(0, 10)}` : ""}
            </div>
            <div className="mb-header-actions">
              <button
                type="button"
                className="mb-chip-btn"
                onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                aria-label="Toggle light and dark theme"
              >
                theme · {theme}
              </button>
              <Link href="/board/week" className="mb-chip-btn">
                week planner
              </Link>
              <Link href="/board/reports" className="mb-chip-btn">
                reports
              </Link>
              <Link href={`/board/reports/board/${sheetDate}`} className="mb-chip-btn">
                print sheet
              </Link>
              <Link href="/board/docs" className="mb-chip-btn">
                plans
              </Link>
              <Link href="/board/taxes" className="mb-chip-btn">
                taxes
              </Link>
              <Link href="/board/ledger" className="mb-chip-btn">
                ledger
              </Link>
            </div>
          </div>
        </header>

        {week?.stateOfUnion ? (
          <div className="mb-strap-block">
            <div className="mb-strap-label">State of the union</div>
            <div className="mb-strap" title={week.stateOfUnion}>
              {week.stateOfUnion}
            </div>
          </div>
        ) : null}

        <div className="mb-legend" aria-label="App colours">
          <span className="l-henceforth">henceforth</span>
          <span className="l-deck">deck</span>
          <span className="l-hansard">hansard</span>
          <span className="l-site">site</span>
        </div>

        {week?.weekPlan && week.weekPlan.length > 0 && (
          <>
            <p className="mb-section-label">Week</p>
            <section className="mb-week" ref={weekRef} aria-label="Week planner">
              {week.weekPlan.map((day) => {
                const isToday = day.date === todayISO;
                const isPast = day.date < todayISO;
                const tasks = day.tasks ?? [];
                const doneCount = tasks.filter(taskDone).length;
                const total = tasks.length;
                const pct = total ? Math.round((doneCount / total) * 100) : 0;
                const shipped = shippedByDay[day.date] ?? [];
                return (
                  <div
                    key={day.date}
                    ref={isToday ? todayRef : undefined}
                    className={`mb-day${isToday ? " today" : isPast ? " past" : ""}`}
                  >
                    <div className="mb-day-head">
                      <span className="wd">{day.weekday}</span>
                      <span className="dn">{day.date.slice(5).replace("-", "·")}</span>
                      {isToday ? (
                        <span className="mb-tag">today</span>
                      ) : day.isReviewDay ? (
                        <span className="mb-tag review">review</span>
                      ) : null}
                      <span className="progress">
                        {total > 0 ? `${doneCount}/${total}` : "—"}
                      </span>
                    </div>
                    <div className="mb-bar" aria-hidden>
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    {shipped.length > 0 && (
                      <details open={isToday}>
                        <summary style={{ color: "var(--mb-muted)", fontSize: 10.5, cursor: "pointer" }}>
                          <span style={{ color: "var(--mb-site)" }}>✓</span> {shipped.length} shipped
                        </summary>
                        <div className="mb-cards" style={{ marginTop: 8 }}>
                          {shipped.map((c) => (
                            <MiniCard key={c.id} card={c} />
                          ))}
                        </div>
                      </details>
                    )}
                    {tasks.length === 0 ? (
                      <div className="none">clear</div>
                    ) : (
                      <ul>
                        {tasks.map((t, i) => {
                          const done = ticks[`${day.date}:${i}`] ?? taskDone(t);
                          return (
                            <li key={i} className={done ? "done" : undefined}>
                              <button
                                type="button"
                                className={`box ${done ? "" : "open"}`}
                                aria-pressed={done}
                                aria-label={done ? `Mark not done: ${taskLabel(t)}` : `Mark done: ${taskLabel(t)}`}
                                onClick={() => tick(day.date, i, !done)}
                              >
                                {done ? "✓" : "□"}
                              </button>
                              <span>{taskLabel(t)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
            <div className="mb-meridian" ref={meridianRef} aria-hidden />
          </>
        )}

        <p className="mb-section-label">Board</p>
        <div className="mb-filters">
          {APP_FILTERS.map((f) => {
            const n =
              f.id === "all"
                ? cards.length
                : cards.filter((c) => c.apps.includes("*") || c.apps.includes(f.id)).length;
            return (
              <button
                key={f.id}
                type="button"
                className={`mb-chip-btn${filter === f.id ? " active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.name} {n}
              </button>
            );
          })}
        </div>

        <section className="mb-board" aria-label="Kanban board">
          {COLUMNS.map((col) => {
            const list = shown
              .filter((c) => c.col === col.id)
              .sort((a, b) => (b.movedAt || "").localeCompare(a.movedAt || ""));
            return (
              <div
                key={col.id}
                className="mb-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && move(dragId, col.id)}
              >
                <div className="mb-col-head">
                  <span className="name">{col.name}</span>
                  <span className="n">{list.length}</span>
                  <Link
                    href={`/board/reports/columns/${sheetDate}/${col.id}`}
                    className="print"
                    title="Every card of this column, newest first, on a printable page"
                  >
                    print
                  </Link>
                </div>
                <div className="mb-cards">
                  {list.map((c) => (
                    <CardView
                      key={c.id}
                      card={c}
                      onMove={move}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => setDragId(null)}
                    />
                  ))}
                  {list.length === 0 && <p className="mb-empty">—</p>}
                </div>
              </div>
            );
          })}
        </section>

        <details className="mb-archive">
          <summary>
            done archive · {doneArchive.length}
            {doneCards.length - doneArchive.length > 0
              ? ` · ${doneCards.length - doneArchive.length} in this week`
              : ""}
            {" · "}
            <Link
              href={`/board/reports/columns/${sheetDate}/done`}
              className="print"
              title="The done pile, newest first, on a printable page: the last thirty days, or all of it"
            >
              print
            </Link>
          </summary>
          <div className="mb-cards">
            {doneArchive.map((c) => (
              <CardView
                key={c.id}
                card={c}
                onMove={move}
                onDragStart={() => setDragId(c.id)}
                onDragEnd={() => setDragId(null)}
              />
            ))}
            {doneArchive.length === 0 && <p className="mb-empty">No earlier done cards.</p>}
          </div>
        </details>
      </div>
    </div>
  );
}

function MiniCard({ card }: { card: Card }) {
  const hue = APP_HUE[card.apps[0] ?? "*"] ?? APP_HUE["*"];
  return (
    <div className="mb-card done-col" style={{ borderLeftColor: hue, cursor: "default" }}>
      <div className="title">✓ {shortTitle(card.title)}</div>
    </div>
  );
}

function CardView({
  card,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  card: Card;
  onMove: (id: string, col: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const ci = COL_IDS.indexOf(card.col);
  const left = ci > 0 ? { id: COL_IDS[ci - 1], name: COLUMNS.find((c) => c.id === COL_IDS[ci - 1])?.name ?? "←" } : null;
  const right =
    ci >= 0 && ci < COL_IDS.length - 1
      ? {
          id: COL_IDS[ci + 1],
          name:
            COL_IDS[ci + 1] === "done"
              ? "Done"
              : (COLUMNS.find((c) => c.id === COL_IDS[ci + 1])?.name ?? "→"),
        }
      : null;
  const hue = APP_HUE[card.apps[0] ?? "*"] ?? APP_HUE["*"];
  const apps = card.apps.includes("*") ? ["all"] : card.apps;
  const multi = apps.length > 1;

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`mb-card${card.col === "done" ? " done-col" : ""}`}
      style={{ borderLeftColor: hue }}
    >
      {multi && (
        <span className="mb-dots" aria-hidden>
          {apps.map((a) => (
            <i
              key={a}
              style={{
                background: APP_HUE[a] ?? APP_HUE["*"],
                color: APP_HUE[a] ?? APP_HUE["*"],
              }}
            />
          ))}
        </span>
      )}
      <div className="title">{shortTitle(card.title)}</div>
      <div className="meta">
        <span className={`kind-pill ${kindClass(card.kind)}`}>
          {kindMark(card.kind)} {card.kind || "task"}
        </span>
        {card.phase ? <span>{card.phase}</span> : null}
        {card.movedAt ? <span>{card.movedAt.slice(5, 10).replace("-", "·")}</span> : null}
        {card.col === "done" && card.doneAt ? (
          <span style={{ color: "var(--mb-site)" }}>✓ {card.doneAt.slice(0, 10)}</span>
        ) : null}
      </div>
      <div className="apps">
        {apps.map((a) => (
          <span key={a}>{a}</span>
        ))}
      </div>
      {card.desc && (
        <details>
          <summary>details</summary>
          <p className="notes">{card.desc}</p>
        </details>
      )}
      <div className="move-row">
        <button type="button" disabled={!left} onClick={() => left && onMove(card.id, left.id)}>
          ← {left?.name}
        </button>
        <button type="button" disabled={!right} onClick={() => right && onMove(card.id, right.id)}>
          {right?.name} →
        </button>
      </div>
    </article>
  );
}
