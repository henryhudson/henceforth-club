import type { Report, Finding, Emergency } from "@/lib/board-data";
import { longDate } from "@/lib/report-helpers";
import A4Sheet from "@/app/hansard/this-week/_components/overview/A4Sheet";
import s from "./morning.module.css";

const APP_NAMES: Record<string, string> = {
  deck: "Deck of Cards",
  henceforth: "Henceforth",
  hansard: "The Hansard",
  site: "henceforth.club",
};

const VERDICT_LABELS: Record<string, string> = {
  agree: "Confirmed",
  reject: "Rejected",
  abstain: "Abstained",
  "already-resolved": "Already fixed",
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

export default function MorningSheet({ report, issue }: { report: Report; issue: number | null }) {
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

  const notToday = asItems(report.plan?.notToday);

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

        <div className={s.stoppress}>
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
            <div className={s.sq}>
              <div className={s.sectionTitle}>The verdicts, in brief</div>
              <ul className={s.verdicts}>
                {findings.map(({ f }) => (
                  <li key={f.refId}>
                    <b>{VERDICT_LABELS[f.verdict] ?? f.verdict}.</b> {f.title}.
                  </li>
                ))}
                {cleanApps.length > 0 && (
                  <li>
                    <b>Clean.</b> {cleanApps.join(", ")}: zero findings{findings.length > 0 ? " each" : ""}.
                  </li>
                )}
              </ul>
              <p className={s.agate}>{summarySentence(report.summary)}</p>
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
                      {dayKeys.map((d) => (
                        <th key={d} className={s.n}>
                          {"SMTWTFS"[new Date(`${d}T12:00:00Z`).getUTCDay()]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {storeApps.map((a) => (
                      <tr key={a.app}>
                        <td>{APP_NAMES[a.app] ?? a.app}</td>
                        {dayKeys.map((d) => (
                          <td key={d} className={s.n}>
                            {a.week?.[d] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className={`${s.agate} ${s.noIndent}`}>
                {ratingLine && <>Ratings: {ratingLine}. </>}
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
                  {a.daysSince != null && <>, day {a.daysSince}</>}. {a.readyToShip} {a.blocker}
                </p>
              ))}
              {report.appStore && <p>{report.appStore.rule}</p>}
            </div>
          </div>
          <div className={s.mod1}>
            <div className={`${s.sq} ${s.agate}`}>
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

        {/* ── BAND D · notices and the composing room ── */}
        <div className={`${s.band} ${s.bandLight} ${s.bandLast}`}>
          <div className={s.mod3}>
            <div className={s.sectionTitle}>Notices</div>
            <div className={s.noticestrip}>
              <div className={s.notice}>
                {report.appStore?.rule && (
                  <p>
                    <b>The cadence.</b> {report.appStore.rule}
                  </p>
                )}
                {report.plan?.note && (
                  <p>
                    <b>The ledger.</b> {report.plan.note}
                  </p>
                )}
              </div>
              <div className={s.notice}>
                <p>
                  <b>The storefront.</b>{" "}
                  Live store state is read from the storefront itself, never from the repositories, and
                  never from the default lookup&apos;s stale cache.
                </p>
              </div>
              <div className={s.notice}>
                <p>
                  <b>The archive.</b> This edition is rendered to a single sheet by the morning routine and
                  inscribed upon Bitcoin SV; back numbers are served from the chain at henceforth.club/board.
                </p>
              </div>
            </div>
          </div>
          <div className={s.mod1}>
            <div className={s.composing}>
              <div className={s.sectionTitle}>From the composing room</div>
              <p className={s.composingNote}>{summarySentence(report.summary)}</p>
              <p className={s.agate}>
                <b>ONE PAGE · ONE INSCRIPTION · EVERY MORNING</b>
              </p>
            </div>
          </div>
        </div>

        <p className={s.credit}>
          Set in Georgia, seven point upon eight; agate matter at five and a half point. Rendered by the
          morning routine and inscribed, one page, upon the chain.
        </p>
      </A4Sheet>
    </>
  );
}
