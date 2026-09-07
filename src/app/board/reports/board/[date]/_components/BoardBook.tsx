import type { BoardBookModel, BookPage, PlanPageModel } from "@/lib/board-book";
import { longDate } from "@/lib/report-helpers";
import { ColumnCards } from "@/app/board/reports/columns/[date]/[column]/_components/ColumnSheet";
import BoardSheet from "./BoardSheet";
import s from "./book.module.css";

/** A plan as a dated list: a group a week or a month, a box a line, the
 *  done lines ticked. */
function Plan({ plan, empty }: { plan: PlanPageModel | null; empty: string }) {
  if (!plan || plan.groups.length === 0) return <p className={s.nothing}>{empty}</p>;
  return (
    <div className={s.plan}>
      {plan.groups.map((g) => (
        <div key={g.label} className={s.group}>
          <div className={s.groupLabel}>{g.label}</div>
          <ul className={s.lines}>
            {g.lines.map((l, i) => (
              <li key={i} className={l.done ? `${s.line} ${s.lineDone}` : s.line}>
                <span className={s.box} aria-hidden>
                  {l.done ? "☑" : "☐"}
                </span>
                <span className={s.when}>{l.when}</span>
                <span>{l.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The line under a page's title: the board's own count of a column, or a
 *  plan's own title. */
function standfirst(page: BookPage): string | null {
  if (page.kind === "plan") return page.plan?.title ?? null;
  const { stamp, cards } = page.list;
  return `As the board stood${stamp ? ` at ${stamp}` : ""} · ${cards.length} ${cards.length === 1 ? "card" : "cards"} · newest first`;
}

/** The Board as a book: the front sheet as it stands, then To do, In
 *  progress, The month and The year, each starting a page of print and
 *  flowing over as many pages as it needs, with a running foot that counts
 *  the book's pages. On the web the pages follow the front down the grey
 *  ground, each reachable by its own anchor. */
export default function BoardBook({ model, date }: { model: BoardBookModel; date: string }) {
  return (
    <div className={s.book}>
      <BoardSheet model={model.front} />
      {/* The book's pages of print: their margins and the running foot in the
          page's own margin box, counted by the browser at print time. The
          front is the first page and keeps the sheet's own margin of nought;
          this rule follows the sheet's so it wins the cascade for the rest. */}
      <style>{`
        @page {
          size: A4;
          margin: 12mm 12mm 14mm;
          @bottom-center {
            content: "The Board · ${longDate(date)} · page " counter(page) " of " counter(pages);
            font: 5.5pt/1 -apple-system, 'Helvetica Neue', Helvetica, sans-serif;
            letter-spacing: .06em;
            text-transform: uppercase;
            color: #111;
          }
        }
        @page :first {
          margin: 0;
          @bottom-center { content: none; }
        }
      `}</style>
      {model.pages.map((page, i) => {
        const line = standfirst(page);
        return (
          <section key={page.id} id={page.id} className={s.page}>
            <div className={s.folio}>
              <span>{longDate(date)}</span>
              <span>
                <b>The Board</b> · {page.title}
              </span>
              <span>Deck of Cards · Henceforth · The Hansard · henceforth.club</span>
            </div>
            <h1 className={s.title}>{page.title}</h1>
            {line && <div className={s.standfirst}>{line}</div>}
            {page.kind === "plan" && page.plan?.note && <p className={s.note}>{page.plan.note}</p>}
            {page.kind === "cards" ? (
              <ColumnCards cards={page.list.cards} empty={page.empty} />
            ) : (
              <Plan plan={page.plan} empty={page.empty} />
            )}
            {i === model.pages.length - 1 && (
              <p className={s.credit}>
                Set in Georgia, seven point upon eight; agate matter at five and a half point. Drawn from the board as
                published and printed on demand: the working set on the front, then every card to do and in hand, then
                the month and the year, on as many pages as they take.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
