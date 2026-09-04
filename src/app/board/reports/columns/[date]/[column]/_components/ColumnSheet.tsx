import Link from "next/link";
import type { ColumnPageModel } from "@/lib/board-columns";
import { longDate } from "@/lib/report-helpers";
import s from "./columns.module.css";

/** One column of the board as a printed list: the nameplate, the column's
 *  name as its standfirst, the dateline, then every card newest first in two
 *  columns of type that flow over as many pages as they need. A card is its
 *  title, its phase, a chip line of apps and date, and the first sentence
 *  of its latest note. Nothing is trimmed and nothing is clipped. */
export default function ColumnSheet({ model }: { model: ColumnPageModel }) {
  const { date, cards, total, window: win } = model;
  const shown = cards.length;
  const cardWord = (n: number) => (n === 1 ? "card" : "cards");

  return (
    <>
      {/* The nameplate wears the same blackletter as The Morning Edition;
          Georgia stands in until the face loads. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap"
      />
      {/* A running foot on every printed page: the column, the date and the
          page count, set by the page's own margin boxes. */}
      <style>{`
        @page {
          size: A4;
          margin: 12mm 12mm 14mm;
          @bottom-center {
            content: "The Board · ${model.label.replace(/"/g, "'")} · ${longDate(date)} · page " counter(page) " of " counter(pages);
            font: 5.5pt/1 -apple-system, 'Helvetica Neue', Helvetica, sans-serif;
            letter-spacing: .06em;
            text-transform: uppercase;
            color: #111;
          }
        }
      `}</style>
      <div className={s.sheet}>
        <div className={s.folio}>
          <span>{longDate(date)}</span>
          <span>Deck of Cards · Henceforth · The Hansard · henceforth.club</span>
          <span>
            <Link href={`/board/reports/board/${date}`}>The Board sheet</Link> ·{" "}
            <Link href={`/board/reports/${date}`}>The Morning Edition</Link> · printed, not inscribed
          </span>
        </div>
        <div className={s.nameplate}>The Board</div>
        <div className={s.standfirst}>{model.label}</div>
        <div className={s.dateline}>
          As the board stood{model.stamp ? <> at <b>{model.stamp}</b></> : null} · <b>{shown}</b>
          {win && !win.all ? <> of {total}</> : null} {cardWord(win && !win.all ? total : shown)} · newest first
        </div>
        {win && (
          <p className={s.window}>
            {win.all ? (
              <>
                The whole done pile, {total} {cardWord(total)}.{" "}
                <Link href={`/board/reports/columns/${date}/done`}>The last thirty days</Link>
              </>
            ) : (
              <>
                Done in the thirty days to {longDate(date)}, from {longDate(win.since)}: {shown} of {total}.{" "}
                <Link href={`/board/reports/columns/${date}/done?all=1`}>The whole pile</Link>
              </>
            )}
          </p>
        )}

        <div className={s.list}>
          {cards.length === 0 && <p className={s.nothing}>Nothing in this column.</p>}
          {cards.map((c) => (
            <article key={c.id} className={s.card}>
              <h2 className={s.cardTitle}>{c.title}</h2>
              {c.phase && <p className={s.cardPhase}>{c.phase}</p>}
              <p className={s.chips}>
                {c.apps.join(" · ")}
                {c.when && (
                  <>
                    {c.apps.length > 0 ? " · " : ""}
                    {c.when}
                  </>
                )}
              </p>
              {c.note && <p className={s.note}>{c.note}</p>}
            </article>
          ))}
        </div>

        <p className={s.credit}>
          Set in Georgia, seven point upon eight; agate matter at five and a half point. Drawn from the board as
          published and printed on demand, every card, on as many pages as the column takes.
        </p>
      </div>
    </>
  );
}
