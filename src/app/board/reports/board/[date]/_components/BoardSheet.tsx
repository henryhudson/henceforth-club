"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { trim, type BoardSheetModel, type CardLine } from "@/lib/board-sheet";
import { longDate } from "@/lib/report-helpers";
import A4Sheet from "@/app/hansard/this-week/_components/overview/A4Sheet";
import PackLayout, { Square } from "@/app/hansard/this-week/_components/overview/PackLayout";
import s from "./board.module.css";

/** Card lines: the title in bold, the phase in agate beneath, and the day's
 *  proposal when the report made one. Never the description. */
function Cards({ lines, empty }: { lines: CardLine[]; empty: string }) {
  if (lines.length === 0) return <p className={s.nothing}>{empty}</p>;
  return (
    <>
      {lines.map((c) => (
        <p key={c.id} className={s.card}>
          <span className={s.cardTitle}>{c.title}</span>
          {c.phase && <span className={s.cardPhase}>{c.phase}</span>}
          {c.decision && (
            <span className={s.proposal}>
              <span className={s.tag}>Proposed · {c.decision.proposal}</span> {c.decision.why}
            </span>
          )}
        </p>
      ))}
    </>
  );
}

export default function BoardSheet({ model: full }: { model: BoardSheetModel }) {
  const ref = useRef<HTMLDivElement>(null);
  const [trimmed, setTrimmed] = useState<BoardSheetModel | null>(null);
  const model = trimmed ?? full;

  // The sheet is fitted by the time this runs (a parent's layout effect
  // follows its children's). If the packed columns still overflow at the
  // floor type size, the model trims and the sheet is set again from the
  // top, before paint, the way PackLayout re-places its squares; a page
  // that overflows even then is refused by the render.
  useLayoutEffect(() => {
    const settle = () => {
      if (trimmed) return;
      const pack = ref.current?.querySelector("[data-pack-root]");
      const overflow = pack instanceof HTMLElement ? Number(pack.dataset.packOverflow ?? 0) : 0;
      if (overflow <= 1) return;
      const next = trim(full);
      if (next) setTrimmed(next);
    };
    settle();
  }, [full, trimmed]);

  const { counts, ledger } = model;
  const open = counts.total - counts.done;

  return (
    <div ref={ref}>
      {/* The nameplate wears the same blackletter as The Morning Edition;
          Georgia stands in until the face loads. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap"
      />
      <A4Sheet key={model.trimmed ? "trimmed" : "full"}>
        <div className={s.folio}>
          <span>{longDate(model.date)}</span>
          <span>Deck of Cards · Henceforth · The Hansard · henceforth.club</span>
          <span>
            <Link href={`/board/reports/${model.date}`}>The Morning Edition of the day</Link> · printed, not inscribed
          </span>
        </div>
        <div className={s.nameplate}>The Board</div>
        <div className={s.subtitle}>The working set of the four: what waits on you, what is in hand, what the week is for</div>
        <div className={s.dateline}>
          As the board stood{model.stamp ? <> at <b>{model.stamp}</b></> : null} · <b>{open}</b> open of {counts.total} cards ·
          in review {counts.review} · in hand {counts.inprogress} · to do {counts.todo} · backlog {counts.backlog} · done {counts.done}
        </div>

        <PackLayout>
          <Square id="waiting" lead className={`${s.sq} ${s.sqHouse} ${s.copy}`}>
            <div className={s.sectionTitle}>Waiting on you</div>
            <Cards lines={model.waiting} empty="Nothing waits on you." />
          </Square>
          <Square id="inhand" className={`${s.sq} ${s.copy}`}>
            <div className={s.sectionTitle}>In hand</div>
            <Cards lines={model.inHand} empty="Nothing in hand." />
          </Square>
          <Square id="pulls" className={`${s.sq} ${s.copy}`}>
            <div className={s.sectionTitle}>This week&apos;s pulls</div>
            <Cards lines={model.pulls} empty="No pulls waiting." />
          </Square>
          <Square id="ledgers" className={`${s.sq} ${s.agate}`}>
            <div className={s.sectionTitle}>The ship ledgers</div>
            {ledger.source === "storefront" ? (
              <table className={s.agateTable}>
                <thead>
                  <tr>
                    <th>App</th>
                    <th>Version</th>
                    <th className={s.n}>Day</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((r) => (
                    <FragmentRows key={r.app} row={r} />
                  ))}
                </tbody>
              </table>
            ) : (
              ledger.rows.map((r) => (
                <p key={r.id}>
                  <b>{r.title}</b> · {r.phase}
                </p>
              ))
            )}
            {ledger.rows.length === 0 && <p className={s.nothing}>No ship state on the board.</p>}
          </Square>
          <Square id="week" className={s.copy}>
            <div className={s.sectionTitle}>The week</div>
            {model.week.length === 0 && <p className={s.nothing}>No week on the board.</p>}
            {model.week.map((day) => (
              <div key={day.date} className={s.day}>
                <span className={s.dayLabel}>{day.label}</span>
                {day.tasks.length === 0 ? (
                  <p className={`${s.task} ${s.taskDone}`}>
                    <span className={s.taskBox} aria-hidden>
                      {" "}
                    </span>
                    <i>nothing planned</i>
                  </p>
                ) : (
                  <ul className={s.tasks}>
                    {day.tasks.map((t, i) => (
                      <li key={i} className={t.done ? `${s.task} ${s.taskDone}` : s.task}>
                        <span className={s.taskBox} aria-hidden>
                          {t.done ? "☑" : "☐"}
                        </span>
                        <span>{t.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </Square>
          <Square id="rhythms" className={s.agate}>
            <div className={s.sectionTitle}>Standing rhythms</div>
            {model.rhythms.length === 0 && <p className={s.nothing}>No standing rhythms.</p>}
            {model.rhythms.map((c) => (
              <p key={c.id}>
                <b>{c.title}</b>
                {c.phase && <> · {c.phase}</>}
              </p>
            ))}
          </Square>
          {model.doneThisWeek.length > 0 && (
            <Square id="done" continues className={s.agate}>
              <div className={s.sectionTitle}>Done this week</div>
              {model.doneThisWeek.map((title, i) => (
                <p key={i}>{title}</p>
              ))}
            </Square>
          )}
        </PackLayout>

        {/* ── PRODUCTION · one thin strip of housekeeping ── */}
        <div className={s.production}>
          <span>
            <b>The sheet.</b> The working set as the board stood, never the done pile; a card is its title and its phase.
          </span>
          <span>
            <b>The ledger.</b> The board records the work; it is never the objective.
          </span>
          <span>
            <b>The archive.</b> The board&apos;s own record is inscribed each morning upon Bitcoin SV; this sheet is printed, not inscribed, unless asked.
          </span>
          {model.trimmed && (
            <span>
              <b>For room.</b> Done this week is left off this sheet; the board carries it.
            </span>
          )}
        </div>

        <p className={s.credit}>
          Set in Georgia, seven point upon eight; agate matter at five and a half point. Drawn from the board as
          published and printed on demand, one page.
        </p>
      </A4Sheet>
    </div>
  );
}

/** One app of the ship ledger: its row, then its state on a line beneath. */
function FragmentRows({ row }: { row: Extract<BoardSheetModel["ledger"], { source: "storefront" }>["rows"][number] }) {
  return (
    <>
      <tr>
        <td>
          <b>{row.app}</b>
        </td>
        <td>
          {row.status} {row.version}
        </td>
        <td className={s.n}>
          {row.daysSince != null && (
            <>
              {row.daysSince}{" "}
              <span
                className={s.stem}
                aria-hidden
                style={{ width: `${Math.min(Math.max(row.daysSince, 1), 14) * 0.5}mm` }}
              />
            </>
          )}
        </td>
      </tr>
      <tr>
        <td colSpan={3}>
          {row.ready ? "Ready." : "Blocked."} {row.note}
        </td>
      </tr>
    </>
  );
}
