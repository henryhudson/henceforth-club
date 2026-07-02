"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
};

const COLUMNS = [
  { id: "backlog", name: "Backlog" },
  { id: "todo", name: "To Do" },
  { id: "inprogress", name: "In Progress" },
  { id: "review", name: "Review" },
  { id: "done", name: "Done" },
];
const COL_IDS = COLUMNS.map((c) => c.id);

const APP_FILTERS = [
  { id: "all", name: "Overall" },
  { id: "deck", name: "Deck of Cards" },
  { id: "henceforth", name: "Henceforth" },
  { id: "hansard", name: "Hansard" },
  { id: "provenance", name: "Provenance" },
  { id: "site", name: "Website / Infra" },
];
const APP_NAME: Record<string, string> = {
  deck: "Deck of Cards",
  henceforth: "Henceforth",
  hansard: "Hansard",
  provenance: "Provenance",
  site: "Website / Infra",
};

const STORE = "henceforth-board-web-v1";

function kindBorder(kind: string): string {
  switch (kind) {
    case "finding":
      return "border-l-[#3da87a]";
    case "gate":
      return "border-l-accent";
    case "dep":
      return "border-l-accent-warm";
    default:
      return "border-l-card-border-hover";
  }
}

// Per-card last-writer-wins: keep the locally-saved column only when the saved
// rev is >= the data-file rev (i.e. /hh hasn't touched the card since you moved
// it); otherwise the data file wins. Mirrors the local kanban.
function reconcile(data: Card[], saved: Record<string, { col: string; rev: number }>): Card[] {
  return data.map((c) => {
    const prev = saved[c.id];
    const dRev = c.rev ?? 0;
    if (prev && COL_IDS.includes(prev.col) && prev.rev >= dRev) {
      return { ...c, col: prev.col };
    }
    return { ...c };
  });
}

export default function BoardClient({
  generated,
  initialCards,
}: {
  generated: string;
  initialCards: Card[];
}) {
  // First render uses the server data verbatim (no hydration mismatch); local
  // placements are merged in after mount.
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [filter, setFilter] = useState("all");
  const [mobileCol, setMobileCol] = useState("backlog");
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setCards(reconcile(initialCards, JSON.parse(raw)));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: Card[]) {
    const map: Record<string, { col: string; rev: number }> = {};
    for (const c of next) map[c.id] = { col: c.col, rev: c.rev ?? 0 };
    try {
      localStorage.setItem(STORE, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function move(id: string, targetCol: string) {
    setCards((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, col: targetCol } : c));
      persist(next);
      return next;
    });
  }

  const inScope = (c: Card) =>
    filter === "all" || c.apps.includes("*") || c.apps.includes(filter);
  const shown = cards.filter(inScope);
  const count = (col: string) => shown.filter((c) => c.col === col).length;
  const done = shown.filter((c) => c.col === "done").length;

  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Morning Board</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            {done}/{shown.length} done · updated {generated}
          </span>
          <Link href="/board/reports" className="text-accent-green underline">
            Reports →
          </Link>
          <Link href="/board/docs" className="text-accent-green underline">
            Plans &amp; specs →
          </Link>
          <Link href="/board/week" className="text-accent-green underline">This week →</Link>
        </div>
      </div>

      {/* Per-app filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {APP_FILTERS.map((f) => {
          const active = f.id === filter;
          const n =
            f.id === "all"
              ? cards.length
              : cards.filter((c) => c.apps.includes("*") || c.apps.includes(f.id)).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                active
                  ? "border-accent-green bg-accent-green/10 text-accent-green"
                  : "border-card-border bg-card-bg/60 text-muted hover:text-foreground"
              }`}
            >
              {f.name} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile: one column at a time, switched by tabs */}
      <div className="md:hidden">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {COLUMNS.map((col) => (
            <button
              key={col.id}
              onClick={() => setMobileCol(col.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                mobileCol === col.id
                  ? "border-foreground bg-foreground/5 text-foreground"
                  : "border-card-border bg-card-bg/60 text-muted"
              }`}
            >
              {col.name} <span className="opacity-60">{count(col.id)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {shown
            .filter((c) => c.col === mobileCol)
            .map((c) => (
              <CardView key={c.id} card={c} onMove={move} />
            ))}
          {count(mobileCol) === 0 && <p className="py-6 text-center text-sm text-muted/50">Nothing here.</p>}
        </div>
      </div>

      {/* Desktop: all columns side by side, draggable */}
      <div className="hidden gap-4 overflow-x-auto pb-4 md:flex">
        {COLUMNS.map((col) => (
          <section
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dragId && move(dragId, col.id)}
            className="flex min-w-[300px] flex-1 flex-col rounded-2xl border border-card-border bg-card-bg/40 p-3"
          >
            <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-bold uppercase tracking-wide text-muted">
              {col.name}
              <span className="rounded-full bg-card-border px-2 text-xs text-foreground">
                {count(col.id)}
              </span>
            </h2>
            <div className="flex flex-col gap-3">
              {shown
                .filter((c) => c.col === col.id)
                .map((c) => (
                  <CardView
                    key={c.id}
                    card={c}
                    onMove={move}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
              {count(col.id) === 0 && <p className="px-1 py-3 text-sm text-muted/40">—</p>}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function CardView({
  card,
  onMove,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  card: Card;
  onMove: (id: string, col: string) => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const ci = COL_IDS.indexOf(card.col);
  const left = ci > 0 ? COLUMNS[ci - 1] : null;
  const right = ci < COLUMNS.length - 1 ? COLUMNS[ci + 1] : null;
  const apps = card.apps.includes("*")
    ? ["All apps"]
    : card.apps.map((a) => APP_NAME[a] ?? a);

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-xl border border-card-border border-l-4 bg-card-bg/80 p-4 shadow-sm transition-shadow ${kindBorder(
        card.kind,
      )} ${draggable ? "cursor-grab active:cursor-grabbing hover:shadow-md" : ""} ${
        card.col === "done" ? "opacity-70" : ""
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded bg-card-border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">
          {card.phase || card.kind}
        </span>
        <span className="text-[11px] uppercase tracking-wide text-muted">{card.kind}</span>
      </div>
      <p className="text-base font-semibold leading-snug text-foreground">{card.title}</p>
      {card.source && <p className="mt-1 text-xs italic text-muted">from {card.source}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {apps.map((label) => (
          <span
            key={label}
            className="rounded border border-card-border px-1.5 text-xs text-muted"
          >
            {label}
          </span>
        ))}
      </div>
      {card.desc && (
        <details className="mt-2.5">
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">details</summary>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{card.desc}</p>
        </details>
      )}
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => left && onMove(card.id, left.id)}
          disabled={!left}
          className="rounded-md border border-card-border px-2 py-0.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-0"
        >
          ← {left?.name}
        </button>
        <button
          onClick={() => right && onMove(card.id, right.id)}
          disabled={!right}
          className="rounded-md border border-card-border px-2 py-0.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-0"
        >
          {right?.name} →
        </button>
      </div>
    </article>
  );
}
