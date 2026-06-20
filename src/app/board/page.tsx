import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";

type Card = {
  id: string;
  col: string;
  kind: string;
  phase?: string;
  apps: string[];
  title: string;
  desc?: string;
  source?: string;
};
type Board = { generated: string; cards: Card[] };

const COLUMNS = [
  { id: "backlog", name: "Backlog" },
  { id: "todo", name: "To Do" },
  { id: "inprogress", name: "In Progress" },
  { id: "review", name: "Review" },
  { id: "done", name: "Done" },
];

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

// Per-card-kind accent (mirrors the local kanban): green = review finding,
// amber = decision, accent = gate, muted = task.
function kindClasses(kind: string): string {
  switch (kind) {
    case "finding":
      return "border-l-[#3da87a]";
    case "gate":
      return "border-l-accent";
    case "dep":
      return "border-l-accent-warm";
    default:
      return "border-l-card-border";
  }
}

async function loadBoard(): Promise<Board | null> {
  try {
    const file = path.join(process.cwd(), "content/board/latest.json");
    return JSON.parse(await fs.readFile(file, "utf8")) as Board;
  } catch {
    return null;
  }
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const { app = "all" } = await searchParams;
  const board = await loadBoard();

  if (!board) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16 text-center text-muted">
        No board data yet — run <code className="text-accent">/hh</code> to populate it.
      </main>
    );
  }

  const inScope = (c: Card) =>
    app === "all" || c.apps.includes("*") || c.apps.includes(app);
  const cards = board.cards.filter(inScope);
  const done = cards.filter((c) => c.col === "done").length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Morning Board</h1>
        <span className="text-sm text-muted">
          {done}/{cards.length} done · updated {board.generated}
        </span>
      </div>

      {/* Per-app filter */}
      <div className="mb-8 flex flex-wrap gap-2">
        {APP_FILTERS.map((f) => {
          const active = f.id === app;
          return (
            <Link
              key={f.id}
              href={f.id === "all" ? "/board" : `/board?app=${f.id}`}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-accent-green bg-accent-green/10 text-accent-green"
                  : "border-card-border bg-card-bg/50 text-muted hover:text-foreground"
              }`}
            >
              {f.name}
            </Link>
          );
        })}
      </div>

      {/* Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.col === col.id);
          return (
            <section
              key={col.id}
              className="flex min-w-[260px] flex-1 flex-col rounded-xl border border-card-border bg-card-bg/30 p-3"
            >
              <h2 className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
                {col.name}
                <span className="rounded-full bg-card-border/60 px-2 text-[11px] text-foreground">
                  {colCards.length}
                </span>
              </h2>
              <div className="flex flex-col gap-2.5">
                {colCards.map((c) => (
                  <article
                    key={c.id}
                    className={`rounded-lg border border-card-border border-l-4 bg-card-bg/60 p-3 ${kindClasses(c.kind)}`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded bg-card-border/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                        {c.phase || c.kind}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted">{c.kind}</span>
                    </div>
                    <p className="text-sm font-semibold leading-snug text-foreground">{c.title}</p>
                    {c.source && (
                      <p className="mt-1 text-[11px] italic text-muted">from {c.source}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(c.apps.includes("*") ? ["All apps"] : c.apps.map((a) => APP_NAME[a] ?? a)).map(
                        (label) => (
                          <span
                            key={label}
                            className="rounded border border-card-border px-1.5 text-[10px] text-muted"
                          >
                            {label}
                          </span>
                        ),
                      )}
                    </div>
                    {c.desc && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] text-muted hover:text-foreground">
                          details
                        </summary>
                        <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
                          {c.desc}
                        </p>
                      </details>
                    )}
                  </article>
                ))}
                {colCards.length === 0 && (
                  <p className="px-1 py-2 text-xs text-muted/50">—</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
