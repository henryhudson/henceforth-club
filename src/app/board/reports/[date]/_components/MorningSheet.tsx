import type { Report, Finding, Emergency, WeekReport, Board } from "@/lib/board-data";
import type { DiaryEntry } from "@/lib/gardening";
import { isRowHigh, longDate, reachCell, sparkPoints } from "@/lib/report-helpers";
import A4Sheet from "@/app/hansard/this-week/_components/overview/A4Sheet";
import s from "./morning.module.css";

export type WeekAheadDay = { label: string; tasks: { label: string; done: boolean }[] };
export type BoardOpen = {
  review: string[];
  reviewCount: number;
  inprogress: string[];
  inprogressCount: number;
  todo: string[];
  todoCount: number;
  doneToday: string[];
  doneTodayCount: number;
  total: number;
};

function clip(text: string, max: number): string {
  const cut = text.split(" — ")[0].trim();
  return cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut;
}

/** The remaining days of the current week, from the edition date onward,
 *  read type-aware: planner tasks mix plain strings and {label, done}.
 *  Capped hard — the sheet is a fixed A4 and the one-page budget fails the
 *  render loudly, so open-ended sources must bound themselves here. */
export function weekAheadFrom(week: WeekReport | null, fromDate: string): WeekAheadDay[] {
  const plan = week?.retro?.weekPlan ?? [];
  return plan
    .filter((day) => day.date >= fromDate)
    .map((day) => {
      const tasks = (day.tasks ?? []).map((t) =>
        typeof t === "string" ? { label: clip(t, 72), done: false } : { label: clip(t.label, 72), done: !!t.done },
      );
      const kept = tasks.slice(0, 3);
      if (tasks.length > 3) kept.push({ label: `and ${tasks.length - 3} more`, done: false });
      return {
        label: `${day.weekday.slice(0, 3)} ${parseInt(day.date.slice(8, 10), 10)}`,
        tasks: kept,
      };
    })
    .filter((day) => day.tasks.length > 0);
}

/** The open board, compressed to run-in agate: titles clipped at their first
 *  dash, columns in working order, the long tails capped by count. */
export function openCards(board: Board, date: string): BoardOpen {
  const byCol = (col: string, max: number): [string[], number] => {
    const titles = board.cards.filter((c) => c.col === col).map((c) => clip(c.title, 44));
    if (titles.length > max) {
      return [[...titles.slice(0, max), `and ${titles.length - max} more`], titles.length];
    }
    return [titles, titles.length];
  };
  const [review, reviewCount] = byCol("review", 8);
  const [inprogress, inprogressCount] = byCol("inprogress", 6);
  const [todo, todoCount] = byCol("todo", 9);
  const doneAll = board.cards
    .filter((c) => c.col === "done" && (c.doneAt ?? "").startsWith(date))
    .map((c) => clip(c.title, 44));
  return {
    review,
    reviewCount,
    inprogress,
    inprogressCount,
    todo,
    todoCount,
    doneToday: doneAll.slice(0, 5),
    doneTodayCount: doneAll.length,
    total: board.cards.length,
  };
}

const APP_NAMES: Record<string, string> = {
  deck: "Deck of Cards",
  henceforth: "Henceforth",
  hansard: "The Hansard",
  site: "henceforth.club",
};

/** "finding-site-members-snapshot-guards-2026-08-20" → "site members snapshot guards" */
function cardName(id: string): string {
  return id
    .replace(/^(finding|ops|task)-/, "")
    .replace(/-\d{4}-\d{2}-\d{2}$/, "")
    .replace(/-/g, " ");
}

function summarySentence(summary: Record<string, number>): string {
  const parts: string[] = [];
  if (summary.confirmed) parts.push(`${summary.confirmed} confirmed`);
  if (summary.rejected) parts.push(`${summary.rejected} rejected`);
  if (summary.abstained) parts.push(`${summary.abstained} abstained`);
  if (summary.alreadyResolved) parts.push(`${summary.alreadyResolved} already fixed`);
  const tail = parts.length > 0 ? `: ${parts.join(", ")}` : ", nothing to flag";
  return `${summary.reviews} reviews adjudicated this morning${tail}.`;
}

function asItems(v?: string | string[]): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-27" → "Thu 27 Aug" (an almanac date). */
function diaryDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export default function MorningSheet({
  report,
  issue,
  weekAhead = [],
  boardOpen = null,
  garden = [],
}: {
  report: Report;
  issue: number | null;
  weekAhead?: WeekAheadDay[];
  boardOpen?: BoardOpen | null;
  garden?: DiaryEntry[];
}) {
  const article = report.article;
  const sections = article?.sections ?? [];
  const numbersSection = sections.find((sec) => sec.heading.toLowerCase().includes("number"));
  const leadSections = sections.filter((sec) => sec !== numbersSection);

  // Stop press: the do-first strip. Emergencies when there are any; otherwise
  // the all-clear plus the top of the plan, which are the day's first moves.
  const planItems = report.plan?.items ?? [];
  const stopPress: Emergency[] =
    report.emergencies && report.emergencies.length > 0
      ? report.emergencies.slice(0, 3)
      : [
          { tag: "clear", title: "Nothing on fire, clear to build.", why: report.plan?.lead ?? "" },
          ...planItems.slice(0, 2).map((it) => ({ tag: it.tag, title: it.title, why: it.detail })),
        ];

  const findings = report.apps.flatMap((app) =>
    app.findings.map((f: Finding) => ({ app: app.app, f })),
  );
  const cleanApps = report.apps
    .filter((app) => app.reviewFound && app.findings.length === 0)
    .map((app) => APP_NAMES[app.app] ?? app.name);

  // The downloads table: the last six processed days across the store apps.
  const storeApps = (report.reach?.perApp ?? []).filter((a) => a.app !== "site");
  const dayKeys = Array.from(
    new Set(storeApps.flatMap((a) => Object.keys(a.week ?? {}))),
  )
    .sort()
    .slice(-6);
  const ratingLine = storeApps
    .filter((a) => a.rating && a.rating.average != null)
    .map((a) => `${APP_NAMES[a.app] ?? a.app} ${Number(a.rating!.average).toFixed(2).replace(/0$/, "")} on ${a.rating!.count}`)
    .join(" · ");
  const site = report.reach?.site;
  const deckSubs = storeApps.find((a) => a.app === "deck")?.subscriptions;

  const notToday = asItems(report.plan?.notToday);
  const emergencyCount = report.emergencies?.length ?? 0;
  const stopPressClass =
    emergencyCount === 1 ? `${s.stoppress} ${s.stoppressOne}` : emergencyCount === 2 ? `${s.stoppress} ${s.stoppressTwo}` : s.stoppress;

  return (
    <>
      {/* The nameplate wears the same blackletter as The Hansard (Henry's
          word, 2026-08-19); Georgia stands in until the face loads. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap"
      />
      <A4Sheet>
        <div className={s.folio}>
          <span>{issue != null ? `No. ${issue} · ` : ""}{longDate(report.date)}</span>
          <span>Deck of Cards · Henceforth · The Hansard · henceforth.club</span>
          <span>Inscribed daily upon Bitcoin SV</span>
        </div>
        <div className={s.nameplate}>The Morning Edition</div>
        <div className={s.subtitle}>The state of the four, and what would most improve each today</div>

        <div className={stopPressClass}>
          {stopPress.map((e, i) => (
            <div key={i} className={s.spItem}>
              <span className={s.tag}>{e.tag} · </span>
              <b>{/[.!?]$/.test(e.title) ? e.title : `${e.title}.`}</b> {e.why}
            </div>
          ))}
        </div>

        {article && (
          <>
            <h1 className={s.headline}>{article.headline}</h1>
            <p className={s.deckline}>{article.lede}</p>
          </>
        )}

        {/* ── BAND A · the lead module across three legs, the verdicts boxed beside ── */}
        <div className={s.band}>
          <div className={s.mod3}>
            <p className={s.byline}>From the morning review · the four desks</p>
            <div className={s.legs3}>
              {leadSections.map((sec, si) => (
                <div key={sec.heading} style={{ display: "contents" }}>
                  {si > 0 && <div className={s.sectionTitle}>{sec.heading}</div>}
                  {sec.body.split("\n\n").map((p, pi) => (
                    <p
                      key={pi}
                      className={si === 0 && pi === 0 ? s.drop : si > 0 && pi === 0 ? s.noIndent : undefined}
                    >
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className={s.mod1}>
            {/* The per-finding list is web-only matter below the sheet — on the
                printed page the review narrative carries the substance, so the
                box holds only the counts (Henry's trim, 2026-08-21). */}
            <div className={`${s.sq} ${s.agate}`}>
              <div className={s.sectionTitle}>The verdicts, in brief</div>
              {(report.summary.confirmed || report.summary.rejected || report.summary.alreadyResolved) ? (
                <p className={s.ticks} aria-hidden>
                  {"■".repeat(report.summary.confirmed ?? 0)}
                  {"□".repeat(report.summary.rejected ?? 0)}
                  {"▪".repeat(report.summary.alreadyResolved ?? 0)}
                </p>
              ) : null}
              <p>{summarySentence(report.summary)}</p>
              {cleanApps.length > 0 && (
                <p>
                  <b>Clean:</b> {cleanApps.join(", ")} — zero findings{findings.length > 0 ? " each" : ""}.
                </p>
              )}
              {findings.length > 0 && !report.summary.rejected && (
                <p>Every finding survived adversarial refutation.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── BAND B · the plan wide, the numbers wide ── */}
        <div className={s.band}>
          <div className={s.mod2}>
            <div className={s.sectionTitle}>The plan of the day</div>
            <div className={s.legs2}>
              {report.plan?.lead && (
                <p className={s.noIndent}>
                  <i>{report.plan.lead}</i>
                </p>
              )}
              {planItems.map((it) => (
                <p key={it.id ?? it.title}>
                  <b>{it.title}.</b> {it.detail}
                </p>
              ))}
            </div>
          </div>
          <div className={s.mod2}>
            <div className={s.sectionTitle}>The numbers</div>
            <div className={s.legs2}>
              {numbersSection &&
                numbersSection.body.split("\n\n").map((p, i) => (
                  <p key={i} className={i === 0 ? s.noIndent : undefined}>
                    {p}
                  </p>
                ))}
              {dayKeys.length > 0 && (
                <table className={s.agateTable}>
                  <thead>
                    <tr>
                      <th>Downloads</th>
                      <th />
                      {dayKeys.map((d) => (
                        <th key={d} className={s.n}>
                          {"SMTWTFS"[new Date(`${d}T12:00:00Z`).getUTCDay()]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {storeApps.map((a) => {
                      const row = dayKeys.map((d) => a.week?.[d]);
                      const spark = sparkPoints(row);
                      return (
                        <tr key={a.app}>
                          <td>{APP_NAMES[a.app] ?? a.app}</td>
                          <td className={s.sparkCell}>
                            {spark && (
                              <svg className={s.spark} viewBox="0 0 42 10" width="42" height="10" aria-hidden>
                                <polyline fill="none" stroke="currentColor" strokeWidth="0.8" points={spark} />
                              </svg>
                            )}
                          </td>
                          {row.map((count, i) => (
                            <td key={dayKeys[i]} className={`${s.n} ${isRowHigh(row, i) ? s.high : ""}`}>
                              {reachCell(count)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className={`${s.agate} ${s.noIndent}`}>
                {ratingLine && <>Ratings: {ratingLine}. </>}
                {deckSubs && (
                  <>
                    Deck subscriptions: {deckSubs.paying} paying ({deckSubs.monthly} monthly, {deckSubs.yearly} yearly), {deckSubs.trial} in trial.{" "}
                  </>
                )}
                {site && (
                  <>
                    The site: {site.yesterday ?? 0} yesterday · {site.week} this week · {site.total.toLocaleString("en-GB")} all-time.
                  </>
                )}
                {report.reach?.dataThrough && <> Store data through {report.reach.dataThrough}.</>}
              </p>
            </div>
          </div>
        </div>

        {/* ── BAND C · the squares: ship list, decisions, not-today ── */}
        <div className={`${s.band} ${s.bandLight}`}>
          <div className={s.mod2}>
            <div className={`${s.sq} ${s.agate}`}>
              <div className={s.sectionTitle}>The ship list</div>
              {report.appStore?.apps.map((a) => (
                <p key={a.app}>
                  <b>{APP_NAMES[a.app] ?? a.app}</b> · {a.status} {a.version}
                  {a.daysSince != null && (
                    <>
                      , day {a.daysSince}{" "}
                      <span
                        className={s.stem}
                        aria-hidden
                        style={{ width: `${Math.min(Math.max(a.daysSince, 1), 14) * 0.5}mm` }}
                      />
                    </>
                  )}
                  . {a.readyToShip} {a.blocker}
                </p>
              ))}
              {report.appStore && <p>{report.appStore.rule}</p>}
            </div>
          </div>
          <div className={s.mod1}>
            <div className={`${s.sq} ${s.sqHouse} ${s.agate}`}>
              <div className={s.sectionTitle}>Decisions before the house</div>
              {(report.decisions ?? []).map((d) => (
                <p key={d.card}>
                  <b>{d.proposal.charAt(0).toUpperCase() + d.proposal.slice(1)}.</b> {cardName(d.card)}: {d.why}
                </p>
              ))}
            </div>
          </div>
          <div className={s.mod1}>
            <div className={`${s.sq} ${s.agate}`}>
              <div className={s.sectionTitle}>Not today, by choice</div>
              {notToday.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER · the reference band: calendar left, board status right.
            Thin rules and small-caps run heads, no boxes — the sheet decelerates
            here into agate reference matter (Henry's re-grouping, 2026-08-21). ── */}
        {(weekAhead.length > 0 || garden.length > 0 || boardOpen) && (
          <div className={s.footerBand}>
            {(weekAhead.length > 0 || garden.length > 0) && (
              <div className={boardOpen ? undefined : s.footerFull}>
                <div className={s.runHead}>The calendar</div>
                <div className={s.agate}>
                  {weekAhead.map((day) => (
                    <p key={day.label}>
                      <b>{day.label}</b> ·{" "}
                      {day.tasks.map((t, i) => (
                        <span key={i}>
                          {i > 0 && " ; "}
                          {t.done && "✓ "}
                          {t.label}
                        </span>
                      ))}
                    </p>
                  ))}
                  {garden.slice(0, 4).map((g) => (
                    <p key={g.section}>
                      <b>{diaryDate(g.date)}</b> · {g.section.replace(" — ", ": ")}
                      {g.overdue && <b> · OVERDUE</b>}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {boardOpen && (
              <div className={weekAhead.length > 0 || garden.length > 0 ? undefined : s.footerFull}>
                <div className={s.runHead}>The board · {boardOpen.total} cards</div>
                <p className={s.pills}>
                  In review <b>{boardOpen.reviewCount}</b> · In progress <b>{boardOpen.inprogressCount}</b> · Waiting{" "}
                  <b>{boardOpen.todoCount}</b>
                  {boardOpen.doneTodayCount > 0 && (
                    <>
                      {" "}· Done today <b>{boardOpen.doneTodayCount}</b>
                    </>
                  )}
                </p>
                <div className={s.agate}>
                  {boardOpen.review.length > 0 && (
                    <p>
                      <b>Review</b> · {boardOpen.review[0]}
                      {boardOpen.reviewCount > 1 && <> and {boardOpen.reviewCount - 1} more</>}
                    </p>
                  )}
                  {boardOpen.inprogress.length > 0 && (
                    <p>
                      <b>In progress</b> · {boardOpen.inprogress[0]}
                      {boardOpen.inprogressCount > 1 && <> and {boardOpen.inprogressCount - 1} more</>}
                    </p>
                  )}
                  {boardOpen.todo.length > 0 && (
                    <p>
                      <b>Waiting</b> · {boardOpen.todo[0]}
                      {boardOpen.todoCount > 1 && <> and {boardOpen.todoCount - 1} more</>}
                    </p>
                  )}
                  {boardOpen.doneToday.length > 0 && (
                    <p>
                      <b>Done today</b> · {boardOpen.doneToday[0]}
                      {boardOpen.doneTodayCount > 1 && <> and {boardOpen.doneTodayCount - 1} more</>}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PRODUCTION · one thin strip of housekeeping in place of the old
            notices band and composing-room box ── */}
        <div className={s.production}>
          <span>
            <b>The cadence.</b> {report.appStore?.rule ?? "Every Wednesday one app ships an update."}
          </span>
          <span>
            <b>The ledger.</b> The board records the work; it is never the objective.
          </span>
          <span>
            <b>The storefront.</b> Live store state comes from the storefront, never the repositories.
          </span>
          <span>
            <b>The archive.</b> One sheet, inscribed daily upon Bitcoin SV; back numbers served from the chain.
          </span>
          <span>
            <b>The composing room.</b> {summarySentence(report.summary)} One page · one inscription · every morning.
          </span>
        </div>

        <p className={s.credit}>
          Set in Georgia, seven point upon eight; agate matter at five and a half point. Rendered by the
          morning routine and inscribed, one page, upon the chain.
        </p>
      </A4Sheet>
    </>
  );
}
