import type { WeekReport, NextItem } from "@/lib/board-data";
import A4Sheet from "@/app/hansard/this-week/_components/overview/A4Sheet";
import s from "./week.module.css";

const APP_NAMES: Record<string, string> = {
  deck: "Deck of Cards",
  henceforth: "Henceforth",
  hansard: "The Hansard",
  site: "henceforth.club",
};

function clip(text: string, max: number): string {
  const cut = text.split(" — ")[0].trim();
  return cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut;
}

const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`);

/** Wins and misses arrive as strings or {tag, title, detail}; the sheet sets
 *  them uniformly, capped — the one-page budget fails the render loudly, so
 *  every open-ended source bounds itself here. */
function asLines(items: (string | NextItem)[], max: number): { title: string; detail?: string }[] {
  const lines = items.map((it) =>
    typeof it === "string" ? { title: clip(it, 90) } : { title: it.title, detail: it.detail },
  );
  const kept = lines.slice(0, max);
  if (lines.length > max) kept.push({ title: `and ${lines.length - max} more` });
  return kept;
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export default function WeekSheet({ week }: { week: WeekReport }) {
  const wins = asLines(week.retro.wins, 6);
  const misses = asLines(week.retro.misses, 6);
  const nextWeek = week.retro.nextWeek.slice(0, 8);
  const planDays = week.retro.weekPlan
    .map((day) => {
      const tasks = (day.tasks ?? []).map((t) =>
        typeof t === "string" ? { label: clip(t, 64), done: false } : { label: clip(t.label, 64), done: !!t.done },
      );
      const kept = tasks.slice(0, 3);
      if (tasks.length > 3) kept.push({ label: `and ${tasks.length - 3} more`, done: false });
      return { label: `${day.weekday.slice(0, 3)} ${parseInt(day.date.slice(8, 10), 10)}`, tasks: kept };
    })
    .filter((day) => day.tasks.length > 0);
  const stuck = week.retro.throughput.stuck.slice(0, 4);
  const reflags = week.retro.recurringReflags.slice(0, 3);
  const appState = week.retro.appState ?? [];
  const totals = Object.entries(week.retro.totals);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap"
      />
      <A4Sheet>
        <div className={s.folio}>
          <span>Week of {longDate(week.weekOf)} · {week.daysCovered.length} review days</span>
          <span>Deck of Cards · Henceforth · The Hansard · henceforth.club</span>
          <span>Reckoned every Sunday · inscribed upon Bitcoin SV</span>
        </div>
        <div className={s.nameplate}>The Weekly Edition</div>
        <div className={s.subtitle}>The week of the four, reckoned: what shipped, what slipped, and what next week is for</div>

        {/* The weekly opens on its leader, never a news headline — the state
            of the union is the page's one big claim. */}
        {week.retro.stateOfUnion && <p className={s.standfirst}>{week.retro.stateOfUnion}</p>}

        {/* ── BAND A · wins and misses across two legs, the numbers boxed beside ── */}
        <div className={s.band}>
          <div className={s.mod3}>
            <div className={s.sectionTitle}>What the week did</div>
            <div className={s.legs2}>
              {wins.map((line, i) => (
                <p key={`w${i}`} className={i === 0 ? s.noIndent : undefined}>
                  <b>Won.</b> <b>{line.title}.</b> {line.detail}
                </p>
              ))}
              {misses.map((line, i) => (
                <p key={`m${i}`}>
                  <b>Missed.</b> <b>{line.title}.</b> {line.detail}
                </p>
              ))}
            </div>
          </div>
          <div className={s.mod1}>
            <div className={`${s.sq} ${s.agate}`}>
              <div className={s.sectionTitle}>The numbers</div>
              {week.sales.perApp.length > 0 && (
                <table className={s.agateTable}>
                  <thead>
                    <tr>
                      <th>Downloads</th>
                      <th className={s.n}>Week</th>
                      <th className={s.n}>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.sales.perApp.map((a) => (
                      <tr key={a.app}>
                        <td>{APP_NAMES[a.app] ?? a.name}</td>
                        <td className={s.n}>{a.units.thisWeek}</td>
                        <td className={s.n}>{pct(a.units.deltaPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {totals.map(([key, value]) => (
                <p key={key}>
                  <b>{value}</b> {key}
                </p>
              ))}
              {week.sales.note && <p>{week.sales.note}</p>}
            </div>
          </div>
        </div>

        {/* ── BAND B · the plan reckoned, next week beside ── */}
        <div className={`${s.band} ${s.bandLight}`}>
          <div className={s.mod2}>
            <div className={s.sectionTitle}>Accomplished against the plan</div>
            <div className={s.agate}>
              {planDays.map((day) => (
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
            </div>
          </div>
          <div className={s.mod2}>
            <div className={s.sectionTitle}>Next week</div>
            <div className={s.agate}>
              {nextWeek.map((it, i) => (
                <p key={i}>
                  <b>{it.title}.</b> {it.detail}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER · the reference band: friction left, the apps' state right ── */}
        {(stuck.length > 0 || reflags.length > 0 || appState.length > 0) && (
          <div className={s.footerBand}>
            {(stuck.length > 0 || reflags.length > 0) && (
              <div className={appState.length > 0 ? undefined : s.footerFull}>
                <div className={s.runHead}>The friction</div>
                <div className={s.agate}>
                  {stuck.map((item) => (
                    <p key={item.id}>
                      <b>Stuck</b> · {APP_NAMES[item.app] ?? item.app} · {clip(item.title, 64)} · in {item.col} since {item.firstSeen}
                    </p>
                  ))}
                  {reflags.map((r) => (
                    <p key={`${r.app}:${r.signature}`}>
                      <b>Re-flagged {r.timesFlagged}×</b> · {APP_NAMES[r.app] ?? r.app} · {clip(r.title, 64)}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {appState.length > 0 && (
              <div className={stuck.length > 0 || reflags.length > 0 ? undefined : s.footerFull}>
                <div className={s.runHead}>The state of each app</div>
                <div className={s.agate}>
                  {appState.map((a) => (
                    <p key={a.app}>
                      <b>{APP_NAMES[a.app] ?? a.name}</b>
                      {a.downloads && <> · {a.downloads.thisWeek} downloads ({pct(a.downloads.deltaPct)})</>}
                      {a.rating.average != null && <> · {a.rating.average.toFixed(1)} on {a.rating.count}</>}
                      {a.verdict && <> · {clip(a.verdict, 150)}</>}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PRODUCTION · one thin strip of housekeeping ── */}
        <div className={s.production}>
          <span>
            <b>The reckoning.</b> Aggregated from the week&apos;s daily reviews and App Store Connect sales, every Sunday.
          </span>
          <span>
            <b>The ledger.</b> The board records the work; it is never the objective.
          </span>
          <span>
            <b>The archive.</b> One sheet, inscribed upon Bitcoin SV; back numbers served from the chain.
          </span>
          <span>
            <b>The composing room.</b> {week.daysCovered.length} review days reckoned. One page · one inscription · every Sunday.
          </span>
        </div>

        <p className={s.credit}>
          Set in Georgia, seven point upon eight; agate matter at five and a half point. Rendered by the
          weekly review and inscribed, one page, upon the chain.
        </p>
      </A4Sheet>
    </>
  );
}
