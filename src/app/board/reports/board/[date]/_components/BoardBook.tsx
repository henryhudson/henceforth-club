import type { BoardBookModel, BookPage, DayPageModel, MonthPageModel, YearPageModel } from "@/lib/board-book";
import { longDate } from "@/lib/report-helpers";
import { ColumnCards } from "@/app/board/reports/columns/[date]/[column]/_components/ColumnSheet";
import BoardSheet from "./BoardSheet";
import s from "./book.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Line = { when?: string | null; label: string; done: boolean };

/** A plan's lines with a tick box each, the done ones ticked: the band above
 *  a grid, or the matter inside one of its boxes. */
function Lines({ lines, className }: { lines: Line[]; className?: string }) {
  return (
    <ul className={className ? `${s.lines} ${className}` : s.lines}>
      {lines.map((l, i) => (
        <li key={i} className={l.done ? `${s.line} ${s.lineDone}` : s.line}>
          <span className={s.tick} aria-hidden>
            {l.done ? "☑" : "☐"}
          </span>
          <span>
            {l.when && <b className={s.when}>{l.when} · </b>}
            {l.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The band above a grid, for the lines that have no box of their own. */
function Band({ label, lines, empty }: { label: string; lines: Line[]; empty?: string }) {
  if (lines.length === 0 && !empty) return null;
  return (
    <div className={s.band}>
      <div className={s.bandLabel}>{label}</div>
      {lines.length === 0 ? <p className={s.nothing}>{empty}</p> : <Lines lines={lines} className={s.bandLines} />}
    </div>
  );
}

/** The day: the week's plan for the date above, then one time line running
 *  the length of the page, midnight at its head and midnight at its foot,
 *  with a named tick at every hour and a shorter one at every half hour, and
 *  open paper for the pen beside it. Each mark is placed by the minute it
 *  falls on, as a share of the day, so the hours come out evenly spaced
 *  however tall the field is. */
function DayTimeline({ day }: { day: DayPageModel }) {
  return (
    <>
      <Band label="From the week's plan" lines={day.tasks} empty="Nothing on the week's plan for the day." />
      <div className={s.day}>
        <div className={s.timeline}>
          <div className={s.track}>
            <div className={s.timeLine} aria-hidden />
            {day.marks.map((mark) => (
              <div
                key={mark.at}
                className={mark.label ? s.mark : `${s.mark} ${s.markHalf}`}
                style={{ top: `${((mark.at / 1440) * 100).toFixed(4)}%` }}
              >
                <span className={s.markLabel}>{mark.label}</span>
                <span className={s.markTick} aria-hidden />
              </div>
            ))}
          </div>
        </div>
        <div className={s.notes}>Notes</div>
      </div>
    </>
  );
}

/** The month: a calendar of weeks, Monday to Sunday, the days outside the
 *  month greyed, each day's items inside its box. */
function MonthGrid({ month }: { month: MonthPageModel }) {
  return (
    <>
      <Band label="Also on the plan" lines={month.others} />
      <div className={s.weekdays}>
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className={`${s.grid} ${s.days}`} style={{ gridTemplateRows: `repeat(${month.weeks.length}, 1fr)` }}>
        {month.weeks.flat().map((d) => (
          <div key={d.date} className={d.inMonth ? s.box : `${s.box} ${s.boxOut}`}>
            <span className={s.boxLabel}>{d.day}</span>
            {d.items.length > 0 && <Lines lines={d.items} className={s.boxLines} />}
          </div>
        ))}
      </div>
    </>
  );
}

/** The year: twelve boxes, three across and four down, a month each. */
function YearGrid({ year }: { year: YearPageModel }) {
  return (
    <>
      <Band label="Also on the plan" lines={year.others} />
      <div className={`${s.grid} ${s.months}`}>
        {year.months.map((m) => (
          <div key={m.month} className={s.box}>
            <span className={s.boxLabel}>{m.label}</span>
            {m.items.length > 0 && <Lines lines={m.items} className={s.boxLines} />}
          </div>
        ))}
      </div>
    </>
  );
}

/** The page's heading: the column's name, or the date, the month or the
 *  year's span the grid covers. */
function heading(page: BookPage): string {
  switch (page.kind) {
    case "cards":
      return page.title;
    case "day":
      return page.day.heading;
    case "month":
      return page.month.heading;
    case "year":
      return page.year.heading;
  }
}

/** Every line a grid page carries, on its boxes and in its band. */
function linesOf(page: BookPage): Line[] {
  switch (page.kind) {
    case "cards":
      return [];
    case "day":
      return page.day.tasks;
    case "month":
      return [...page.month.weeks.flat().flatMap((d) => d.items), ...page.month.others];
    case "year":
      return [...page.year.months.flatMap((m) => m.items), ...page.year.others];
  }
}

/** The line under a page's title: the board's own count of the cards, in
 *  hand and to do together, or of the lines a grid carries and how many are
 *  done. */
function standfirst(page: BookPage, stamp: string | null): string {
  const stood = `As the board stood${stamp ? ` at ${stamp}` : ""}`;
  if (page.kind === "cards") {
    const n = page.inHand.length + page.list.cards.length;
    return `${stood} · ${n} ${n === 1 ? "card" : "cards"} · newest first`;
  }
  const lines = linesOf(page);
  return `${stood} · ${lines.length} ${lines.length === 1 ? "item" : "items"} · ${lines.filter((l) => l.done).length} done`;
}

/** The plan's note in the author's words, or the not-laid-out line when the
 *  board carries no such plan; nothing when the plan has no note. */
function note(page: BookPage): string | null {
  if (page.kind === "month") return page.month.laidOut ? page.month.note : page.empty;
  if (page.kind === "year") return page.year.laidOut ? page.year.note : page.empty;
  return null;
}

/** The Board as a book: the front sheet as it stands, then To do, the cards
 *  in hand at its top under their own label and the cards to do after,
 *  starting a page of print and flowing over as many pages as it needs, then
 *  the day as a time line with paper beside it, and the month and the year, a
 *  page of boxes each, with a running foot that counts the book's pages. On
 *  the web the pages follow the front down the grey ground, each reachable by
 *  its own anchor. */
export default function BoardBook({ model, date }: { model: BoardBookModel; date: string }) {
  return (
    <div className={s.book}>
      <BoardSheet model={model.front} />
      {/* The book's pages of print: their top and bottom margins, and the
          running foot in the page's own margin box, counted by the browser at
          print time. The sides stay at nought so every page is as wide as the
          front, which keeps the sheet's own margin of nought; the pages carry
          their 12mm sides themselves (book.module.css says why). This rule
          follows the sheet's so it wins the cascade for the rest. */}
      <style>{`
        @page {
          size: A4;
          margin: 12mm 0 14mm;
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
        const words = note(page);
        return (
          <section key={page.id} id={page.id} className={page.kind === "cards" ? s.page : `${s.page} ${s.boxes}`}>
            <div className={s.folio}>
              <span>{longDate(date)}</span>
              <span>
                <b>The Board</b> · {page.title}
              </span>
              <span>Deck of Cards · Henceforth · The Hansard · henceforth.club</span>
            </div>
            <h1 className={s.title}>{heading(page)}</h1>
            <div className={s.standfirst}>{standfirst(page, model.front.stamp)}</div>
            {words && <p className={s.note}>{words}</p>}
            {page.kind === "cards" && page.inHand.length > 0 && (
              <>
                <div className={s.bandLabel}>In hand</div>
                <ColumnCards cards={page.inHand} empty="Nothing in hand." />
              </>
            )}
            {page.kind === "cards" && <ColumnCards cards={page.list.cards} empty={page.empty} />}
            {page.kind === "day" && <DayTimeline day={page.day} />}
            {page.kind === "month" && <MonthGrid month={page.month} />}
            {page.kind === "year" && <YearGrid year={page.year} />}
            {i === model.pages.length - 1 && (
              <p className={s.credit}>
                Set in Georgia, seven point upon eight; agate matter at five and a half point. Drawn from the board as
                published and printed on demand: the working set on the front, then every card to do and in hand on as
                many pages as they take, then the day as one line from midnight to midnight with paper to write on
                beside it, and the month and the year as boxes for the pen.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
