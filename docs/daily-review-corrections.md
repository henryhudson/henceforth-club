# Daily Review Corrections — henceforth.club

The website has no automated review email; its review is the live sweep the `/hh` morning
routine generates fresh each day (production curls + the shipping branch). This ledger
records that sweep's **rejections and dismissals**, newest first, so a later run does not
re-flag what a prior run already refuted. Confirmed findings go to the Morning Board, not
here. Cite `file:line` (or the live probe) so each verdict is independently re-derivable.

## 2026-09-02 — the site sweep, run by the routine itself: nothing filed, nothing rejected; three notes recorded

Reviewed `origin/main` at `7ccdf5b`. The site finder was refused by the account's session limit, so
this entry is the routine's own sweep, read in full.

**Range `16c8ae1..7ccdf5b`** (Henry, last night): the print packer and fitter, `src/lib/print/pack.ts`
and `fit.ts` with 190 lines of tests. `fitTypeSize` is bounded (two loops capped at 60 steps inside the
6 to 10 point band); `packColumns` never drops copy (an overflow lands in the last column and the render's
page budget refuses the page), and every loop terminates by construction. Gate on main: `tsc` clean;
`vitest` 170 files, 1,692 passed, 2 skipped. No finding.

**The night's work (2 September).** Seven pull requests merged after the morning sweep: 69 (the This Week
sheets), 74 (the roll writes the store first), 70, 71 and 72 (the archive stack, with 71 and 72 re-merged
with main and re-gated first), 75 and 76 (the print packer: whole lines, then measured line boxes), 77 (a
long department name no longer pushes the chart over its neighbour) and 78 (a rate-limited broadcast waits
and tries the other processor). Two further print defects were found the only way they could be found, by
reading the page: the sheet clipped silently while the page count read one, and a split cut through a line.
Both are fixed and the render now refuses a clipped sheet.

**The first chain publish ran.** Thirteen documents inscribed across two runs (four, then nine) before
WhatsOnChain answered 429 each time; the publisher refused to call either run a publish and the ledger
resumed cleanly, which is exactly the behaviour pull request 74's sibling work was for. Pull request 78 then
gave the broadcast a backoff and a second processor. The live read and archive task six still wait on a full
publish.

**Correction (evening), the packer verdict reversed.** The morning sweep dismissed "the packer can
overflow a page" on the reasoning that the render's page budget would refuse the page. Wrong: the packed
sheet is `overflow: hidden`, so a column the packer cannot fit is clipped at the sheet's foot while the page
count stays one, and the budget check never sees it. Tonight's edition lost the end of its "Not today" box
and the ship list's Hansard line exactly this way, and a continuing square was cut mid-line at a column break
(the same line half-visible at the foot of one column and the head of the next). Fixed in pull request 75:
fragments end on whole lines, `PackLayout` publishes the overflow, the daily render refuses a clipped sheet
as it refuses a second page, and the draft render exits non-zero. Lesson for the ledger: "one page" is not
"nothing clipped"; a sheet must be read, not counted.

**Pull request 74** read in full: `pickBoard` takes the newer of store and file by `generatedAt` (a tie
keeps the store), `persistBoard` writes the store first and throws on refusal, `hh-plan-update.mjs` exits 1
on that throw, and seven tests assert the order and the refusal. Verified; merge-ready. **Pull request 69**:
`--publish` refuses any digest whose status is not `published` (the `status !== 'published'` guard in
`render-draft.mjs`), writes `public/this-week/<week>.pdf`, and is the site half of Hansard 1.10.

**Notes, not findings (so tomorrow does not re-derive them):**

- The apex answers 307 to `www.henceforth.club` through Cloudflare; the domain's nameservers are
  Cloudflare's while Vercel lists its own as intended. Standing since the 24 August go-live. The gates hold
  when followed: `POST /api/folklore/job` 503, `/board` to `/board/login`.
- `/folklore` sampled 1.77 s, then 0.31 and 0.43 s: the page declares `revalidate = 3600`, so the first hit
  after an idle hour is a cold render, not a regression. `/` 0.08 to 0.10 s.
- 75 views yesterday against a prior thirty-day high of 15: `/api/hit` increments per page load with no
  dedupe (`route.ts:20-21`), and the evening carried three production deploys and Henry's own print-edition
  work. Read it as internal until a quiet day repeats it.

## 2026-09-01 — one killed: "pull request 64 is NOW conflicting" is a standing fact, not news

Reviewed `origin/main` at `9b3e9c2fcf89` (no shipping commits since 30 August; the sweep's
substance was live probes and the pull-request queue). Four candidate findings; three survived
refutation (the untracked 26 August digest draft, the store recovery with seven burned-in zero
days, pull request 66 finished-and-unmerged) and went to the board. One killed:

**Rejected: "Status change on the standing pull-request-64 card: now CONFLICTING with a failing
Vercel check."** The raw observations verify (gh: `CONFLICTING` / `DIRTY`, Vercel FAILURE,
untouched since 2026-08-26T13:16Z) — but the claimed *change* is false: the standing card
`finding-site-two-week-files-2026-08-29` recorded exactly this state in its 29 and 30 August
entries ("blocked … by a real conflict with main's later edit of `board/page.tsx`"). A
still-true fact re-observed is evidence for the standing card, not a new finding. The card's
pull (rebase `board-owns-week-plan`, resolve, merge) already stands.

Also for the record, not rejections: the apex-307 and warm-timing conventions were applied per
the 2026-08-14 and 2026-07-29 entries; the money gate answered 503 fail-closed; `/board`
challenged to its login page.

## 2026-08-30 — one finding against the 65 merge, rejected on live evidence the refuter did not use

Reviewed `origin/main` at `04226ee992cf`, the merge of pull request 65 (eleven files). The
repo gate passed on the range: `npm test` green, and `tsc --noEmit` clean for the first time
since 25 August. One candidate finding, and it survived adversarial refutation; it is rejected
here anyway, because the refuter reasoned from the client library's `request()` without
reading the pipeline executor, and two live runs contradict the claim.

**Rejected: "`summarise` groups on the full reason string, which embeds the Upstash client's
per-command error echo, so a systemic refusal fragments into one line per key and never
collapses."** The premise is that `set`/`sadd` throw from `request()` at
`node_modules/@upstash/redis/chunk-IH7W44G6.mjs:203`, whose message appends
`command was: ${JSON.stringify(req.body)}`. They do not, in the shipping configuration:
`enableAutoPipelining` defaults to **true** (`:4364`), commands route through
`withAutoPipeline` (`:3960`), and its throw at `:4003` is `Command failed: ${error}` with
**no command echo**. Every refused write in a systemic outage therefore carries the identical
message, and the grouping collapses, which is exactly what was observed on the two live runs
against the over-quota store: 28 August, `68 of 68 step(s)` in one group; 29 August,
`69 of 69 step(s)` in one group, `board:latest` grouped with the reports. A finding that says
this "never" happens is refuted by it having happened twice.

**What survives is fragility, not a defect, and it is parked
(`parked-publish-core-group-by-kind-2026-08-30`).** The direct path at `:203` does echo the
command, and this morning's `smembers` in `hh-plan-update.mjs` took it (the log reads
`command was: ["smembers","board:weeks"]`). Grouping by `kind` rather than the interpolated
reason would remove the dependence on message shape, and the grouping test should feed distinct
same-cause messages rather than one reused literal. Fold in on the next touch of the file.

**Lesson for the refuter, recorded so it is reused:** when a finding names a library's throw
path, check the library's *default configuration* and, where a live log exists, the shape of
the message actually observed. The refuter cited `:4003` as "a different code path, not the
one set/sadd use" and was wrong about which path is the default.

## 2026-08-29 — nothing rejected; one finding re-derived independently and NOT re-filed

`origin/main` has not moved since yesterday's ledger commit (`522f67ecb081`), so there were
zero shipping commits to review. All four findings raised against repository and production
state survived adversarial refutation at high confidence and are carded, not rejected.

**Recorded here because it is a near-miss duplicate.** Reading `scripts/board/daily-reach.mjs`
from scratch this morning, the adjudicator independently derived that `siteViews` violates
its own docstring: the comment at `:148` states "A failed read is different: null, never
zero", the guard at `:161` tests only the `views:total` read, and `:164` then coerces every
refused day-read to zero with `n ?? 0`. This is **already carded** as
`finding-site-unknown-renders-as-zero-2026-08-28`, which names the same lines, so it was
**not re-filed** — it was appended to that card as corroborating evidence.

The corroboration is worth keeping: the failure was *observed live* today rather than
predicted. Two runs of the reach pull minutes apart returned site week **13**, then **0**,
with `total` unchanged at 1,199. Also established: commit `0c9dc35`, titled "a failed read
is not an empty board, nor a zero", touched `page.tsx`, `MorningSheet.tsx`, `Accordion.tsx`
and `board-data.ts` — and never `daily-reach.mjs`. The principle was applied to the renderer
and not to the collector.

**One finding went unadjudicated and is named rather than buried.** The site review produced
five candidates; the workflow capped adversarial refutation at four per repository, so F5
("`board-data.ts` on main has no staleness detection") was never refuted. It is not carded
separately: on inspection it restates the consequence of the unmerged pull request 65 rather
than an independent defect, and it is folded into `ops-keyvalue-store-exhausted-2026-08-28`.
The cap was the adjudicator's own scripting error, the same shape as the 2026-08-27 slice
cap, and is recorded so it is not repeated a third time.

## 2026-08-28 — two of five site findings killed, both on the primary test

- **REJECTED: "The 06:00 job's store-write failure prints a reassuring message, still reports success, and exits 0, so the loss ratchets unseen."** Refuted on the primary test: the quoted code does not exist in the checked-out tree. `scripts/board/hh-plan-update.mjs` is 76 lines; repo-wide greps for `writeBoardFiles`, `store write failed` and `board files still updated` return **zero** hits across the main checkout, all twelve worktrees and the sibling checkouts. The current script has no try/catch around the store write, so a refusal throws and the process exits **non-zero**. The swallow-and-report-success shape is real but lives only on the unmerged branch `board-owns-week-plan` (pull request 64) and is already carded from 2026-08-27. **Note the correction this forced on our own card:** the framing 'it will clobber again the moment the store answers' was wrong, because the checkout has moved off that branch since 27 August.
- **REJECTED: "writeBoardFiles fabricates weekEnd = weekOf in the derived week mirror."** `scripts/board/local-mirror.mjs` is 27 lines; the cited lines 48-55, 51 and 62 are all past end of file. The only assignment is `weekEnd: week.weekEnd` at line 17, which is correct, and it is the very line the finding claimed was broken. Three cited identifiers do not exist anywhere in the repository.

## 2026-08-27 — two of four folklore findings killed by refutation

- **REJECTED: "the Magic Attribute Protocol reader applies none of the caps the module's own doctrine requires."** The headline claim is refuted by the doctrine's own text, and the alleged harm is inverted. Do not re-flag without quoting the doctrine.
- **REJECTED: "extractTargetTxid has no callers, its spec-mandated multiple-id test is missing, and it silently truncates."** The arithmetic half is correct but inert; the harm half is inverted, so it does not stand as a defect. Verified true but not a defect.

## 2026-08-26 — the outage message is a defect; two worker findings are dormant, and four readings were falsified before filing

- **PRINT DEFECT found by rendering it — the Morning Edition drops emergencies past the third, silently** [FACT, read this run]. `MorningSheet.tsx:138` builds the stop-press band as `report.emergencies.slice(0, 3)`. Today's report carried four, so the fourth never reached the sheet, and nothing in the page, the render or the publish said so. The sheet reads as complete when it is not, which is the same failure shape as this morning's screenshot gate. Today it cost nothing, because the dropped item (write This Week in Parliament) also prints as a plan item, and the report was cut back to three deliberately. **Fix:** render every emergency, or print an explicit "and N more" line when the band is capped. Never truncate in silence.

- **The print edition does NOT depend on the key-value store, and today proves it** [FACT, this run]. `board-data.ts` `loadReport`/`loadBoard`/`listDates` each try Redis and fall back to the file under `content/board/`, so a local Next server renders the real edition with the store entirely out of the picture: `RENDER_PDF_BASE=http://localhost:3111 node --env-file=.env.local scripts/board/render-pdf.mjs daily <date> --out <path>`. That is the standing workaround whenever publish is blocked, and `--out` keeps it a local file with no inscription and no Redis write. The same local server also serves a fully populated `/board` and `/board/week` from the same files. **`/board/docs` is the exception: it answers 500 locally**, because the documents index has no file fallback — worth one, since it is the only board surface that dies rather than degrades.

- **The one-sheet budget is enforced by a type-fitting loop with a hard floor, not by the page count alone** [FACT, read this run]. `A4Sheet` sets the sheet root to 7pt and steps the type down by 0.2pt until the content fits A4, with a floor of 6pt (the trade's 600-dots-per-inch legibility limit) and a ceiling of 8.5pt so a light day still fills the page. A two-page render therefore means the sheet overflowed *at the smallest type the format allows*, and the only correct fix is cutting copy. Today's edition arrived 90.6mm over that floor and took five passes to fit. Two measurement lessons worth keeping: the bands are **equal-height column groups**, so a band only shrinks when its *tallest* column does (today the decisions column governed at 62.1mm against a 26.5mm neighbour, and trimming the article bought nothing); and the article is set `column-count: 3`, so a line cut there returns only a third of a line of height. Cut the standfirst and the single-column lists first; they pay one for one.

- **Scope of record.** `origin/main` at `73aa23d`; six commits since `39a5023`, of which exactly one changed shipping TypeScript (`81c96cd`, the stats read), one retired the folklore worker (`dfe8aa5`), and four are specification documents with no code path. Live sweep from the canonical host, because the apex 307-redirects to `www` and a bare probe returns the string "Redirecting..." and tells you nothing.
- **Live gates, all correct.** `POST /api/folklore/job` and `/api/folklore/pass` both answer **503**, `GET /board` challenges. The homepage serves 200 in 0.156–0.164 s, `/folklore` 0.375–0.821 s with the familiar cold-then-warm shape.

- **GATE DEFECT found by running it — `scripts/board/wednesday-screenshots.sh` fails silently when an app produces zero screenshots** [FACT, read this run]. Today's run captured all three apps (Deck 46 at `81f770f`, Henceforth 152 at `79403775`, Hansard 80 at `6b4a053`). Last Wednesday's did not: `~/Desktop/ship-screenshots/2026-08-19/` holds Deck's shots, a `henceforth.log` whose final line is `==> [ipad] Running UI tests…`, **no `henceforth/` directory, no Hansard at anything, and an empty `summary.tsv`** — the run died part-way through Henceforth's iPad pass and reported none of it. Two apps therefore went a week with no baseline, which is why today's Henceforth and Hansard captures print no moved/vanished/identical line: there is nothing to compare against, and today becomes their first baseline. The routine's own standing rule says zero screenshots is a failure and never a quiet week; the script does not yet enforce it. **Fix:** exit non-zero, and write the failure into `summary.tsv`, when an app's capture directory ends up empty or its per-app run exits non-zero. Deck's comparison today is clean for the archive: 46 moved, 0 new, **0 vanished**, 0 identical, movers led by `appearance-iphone` at 1.03 per cent and tailing off under 0.17 per cent — no navigation path broke, and Deck shuffles, so nothing captures identically.

- **CONFIRMED and carded — a key-value store failure renders the board as "No board data yet — run /hh to populate it"** [FACT]. `src/lib/board-data.ts:206-217` wraps the `board:latest` read in `try { … } catch { }` and falls through to `content/board/latest.json`, a file that cannot exist in the deployed build because the board content is deliberately gitignored (`.gitignore:59`) — this repository is public and `scripts/board/sync-docs.mjs:3` records that the board content is private. So an outage and a genuinely empty board collapse into one screen, and that screen blames the user's own routine. This is live right now: the store has been over its monthly command cap since 24 August and the board has served `generated: 2026-08-24 12:40` for two days. Card `finding-site-board-empty-on-redis-failure-2026-08-26`. **The gitignore is correct and must not change** — shipping the board into a public repository would be the leak; only the message is the defect.
- **CONFIRMED, dormant — the job-id set is append-only, so the empty-pipeline short-circuit stops firing after the first job ever created** [JUDGMENT]. `scripts/xtext-worker/run.mjs:116-117`. Not carded: the worker was retired the same day (`dfe8aa5`). Fix when and if the pipeline is re-enabled: remove the id at the point a job reaches a terminal state.
- **PLAUSIBLE, dormant — `backfillJobIndex` repairs only while the set is empty** (`src/lib/folkloreJob/jobStore.ts:90-103`), so one new job can strand every pre-index job. No action while the feature is gated.

**Falsified before filing — recorded so tomorrow does not raise them:**
- "The early return in `tick()` leaks the overlap latch and wedges the worker" — **false**: `ticking = false` sits in a `finally` at `run.mjs:138-141`, so the short-circuit clears it like any other exit. This was the most damaging reading of the new code and it does not hold.
- "The 366-key bulk read loses per-key isolation" — **false**, verified live: `GET /api/stats` answers 200 in 0.293 s with a well-formed body, and `route.test.ts:30-34` pins a single bulk call with the fake's per-key getter throwing if touched.
- "`content/board/` is missing from the repository, so the fallback is broken" — **rejected as a defect in its own right**; the gitignore is deliberate (see above). Only the user-facing consequence is filed.
- "The visitor counter is broken — two consecutive zero days" — **not filed, insufficient evidence**: `views:total` (1199) exactly equals the year sum, so the paired increments have not diverged, and a curl cannot fire the client-side tracker. The related conflation of a failed read with a real zero is already carded as `finding-site-visits-null-as-zero-2026-08-25` and is not re-filed. That card gained live evidence this morning: two reads ten minutes apart returned 34 and 27 for the same week, because the same over-quota store serves them.
- "Terminal jobs are never removed, so the late reaper polls them forever" — **real but out of range**: `worker.mjs:456-478` behaved the same before `81c96cd`, and the worker is retired. Recorded, not attributed to this range.
- **Range correction:** the review brief said eight commits since `39a5023`; `git rev-list --count` returns **six**.

## 2026-08-25 — zero rejections; two site findings arrived after the edition was put to bed

The 07:40 edition said nothing new to card. The independent finders finished at 07:43 with two confirmed site facts (both survived adversarial check; neither is a prior rejection). Carded, not rewritten into the paper: `finding-site-visits-null-as-zero-2026-08-25` (`MorningSheet.tsx:324` `{site.yesterday ?? 0}` against `reachCell, never ?? 0`) and `finding-site-accordion-a11y-2026-08-25` (`Accordion.tsx` always mounts closed panel copy). Live: `/` 0.14–0.17 s; `/folklore` 0.45 / 1.57 / 1.82 s (same cold/warm shape as 08-21); `POST /api/folklore/job` 503 fail-closed; `/board` login challenge; apex 307 to www. Motion fade-ins retired (`4d5bd10`). Mini-health pull request 63 merged. Redis at the 500,000-command cap — board publish failed; local files hold today's board.

## 2026-08-21 — zero rejections; two suspicions killed at the falsification gate before filing

Nothing was rejected today — all four candidate findings (three carded, one folded)
survived adversarial refutation. Recorded here instead are the two range suspicions the
finder **affirmatively falsified before filing**, so a later run does not re-raise them:

- **`recoveryLines` splitting `size` on `+` is correct AND consumable.** The suspicion was
  that one `--assign WxH+WxH=setId` line could not be replayed. Falsified at the consumer:
  `argAll` (`asc-screenshots.mjs:36-42`) collects repeated `--assign` flags, and same-set
  forced entries re-merge, preserving the delete-once invariant. The 08-20 recovery-map fix
  emits one line per size element by design.
- **The members-snapshot floor guard exits before any write.** The suspicion was a
  half-written baseline on a floor breach. Falsified at the definition: `MEMBER_FLOOR`
  exits 1 before the diff and before the snapshot write, leaving the committed baseline
  untouched. Residual (low, noted not carded): a corrupt committed snapshot parses as "no
  prior snapshot", silently skipping that week's diff before overwriting — recoverable via
  git history.

**For the record.** Routes: `/` 0.084-0.234s; `/folklore` 0.515-0.517s warm (1.57s
documented cold); `POST /api/folklore/job` refused 503 fail-closed; `/board` challenged 307
to login. Zero open pull requests; `npm test` 1,580 passed, 0 failed.

## 2026-08-20 — one rejection out of four newspaper-measure findings

**Rejected 1 — "A4Sheet fit loop measures before the blackletter nameplate face arrives" (JUDGMENT, low).**
The race is real but cannot move the measurement. The only element rendered in the
asynchronously-loaded UnifrakturMaguntia face is the single-line `.nameplate` with an explicit
`line-height: 1` at a fixed 34pt (`overview.module.css:41-48` at `origin/main` `25824be` — the
sole reference to the face), so a late font swap changes glyph ink but not the line box:
`scrollHeight` is identical with Georgia standing in as after the swap ("The Hansard" cannot
wrap in a 186mm measure at 34pt in either face). Every other font on the sheet is local and
loaded before the mount-time `useEffect` measures, leaving no reflow for the single 0.2pt
back-off to be exposed to. No fix needed; if the nameplate ever grows a second line or a
variable measure, re-derive.

**For the record.** The sweep was otherwise clean and three low findings were confirmed to the
board (`asc-screenshots.mjs:198` recovery-map under-print, `members-snapshot.mjs:27-42,66-71`
pagination/overwrite guards, the empty ruled sidebar on no-data digest issues live at
`/hansard/this-week/2026-05-27`). Routes: `/` 0.069-0.112s, `/folklore` warm 0.392-0.507s;
`POST /api/folklore/job` refused 503 fail-closed; `/board` challenged 307. Zero open pull
requests; `npm test` 1,574 passed, 0 failed. The 2026-08-19 draft correctly 404s and its
opengraph image serves the zero-content card — the draft-leak fix holds.

## 2026-08-14 — a sweep-brief correction and one intent question

- PROCESS CORRECTION: the morning sweep checked `/this-week/<date>` and found 404 — the digest lives at `/hansard/this-week/<date>` (200 in 0.372s; git grep at origin/main confirms no `/this-week` route or redirect exists). Future sweeps use the `/hansard` path. The 2026-08-12 digest is live.
- PENDING HENRY: the apex `https://henceforth.club/` now 307-redirects every path to `https://www.henceforth.club/` (method-preserving, so the POST money gate still lands and fails closed). Likely deliberate domain configuration; if confirmed, the sweep bar targets www going forward.
- NOTED (low): `/folklore` breached the sub-second bar on 2 of 6 samples (1.78s, 1.08s cold; 0.53-0.67s warm).
- FOLD-ON-NEXT-TOUCH (low): `asc-press.mjs`'s version-list fetch never checks `response.ok`, so an auth failure prints as "no PENDING_DEVELOPER_RELEASE record found" — misdiagnosis only; it still exits 1 and cannot release wrongly.
- Both money gates fail closed (POST /api/folklore/job → 503; /board → 307 to login). No open pull requests.

## 2026-08-09 — a clean live sweep, and one board-hygiene finding refuted because the card it proposed closing does not exist

**Rejected 1 — "carded blank-budget defect is fixed on main by `5fbfbe1` — close the board card" (FACT, low).**
The code half is accurate and welcome (`xSpend.ts:45-46` trims and treats a blank
`XFOLKLORE_DAILY_BUDGET` as unset on `origin/main` `c4514df`; `xSpend.test.ts:69-70,74` pin the
behaviour), but the operative claim fails: no board card for the blank-budget defect exists to
close — the fix landed the same day the defect was found, so it never got carded. A finding whose
action is "close card X" must first show card X exists. No action.

**For the record.** The sweep itself was clean and both positives are logged as verified this run:
`/` and `/folklore` well inside the sub-second bar; `POST /api/folklore/job` refused 503
fail-closed (the gate is the route's first statement); `/board` challenged; the endowed pass
(`4f745cd`) confirmed flag-dark at every consumption site (strict equality to `"true"`, defaults
absent). No open pull requests; nothing unmerged.

## 2026-08-02 — nothing rejected; the new access-control change earned a clean bill, and two low findings survived

**Range.** `b4a63b6..a782341` — two commits, one of them this ledger. The code commit is `072fca2`, "The company's tax filings move behind the board sign-in": five files, +286/−0.

**The primary target passed, and that is the substantive result of the run.** Every question was checked against a definition rather than a call site, and it is recorded here because a clean bill is a result worth not re-deriving tomorrow:

- **Gate coverage.** `src/middleware.ts:8` matches `["/board", "/board/:path*"]`, covering both the listing page and the nested document route, and `src/app/board/taxes/[year]/[slug]/route.ts:16-20` re-verifies in-handler — so a matcher regression alone cannot expose the documents.
- **Fails closed on every input.** `verifySession` (`src/lib/board-auth.ts:55-71`) returns false for an absent token (`:59`), a token with no `.` separator (`:61`), a bad signature (`:64`, constant-time via `timingSafeEqual` at `:36-41`) and an expired or unparseable payload (`:65-70`). The signature is verified **before** the payload is parsed, so there is no unauthenticated `JSON.parse`.
- **Live sweep agrees.** `/board` challenges to `/board/login`; `/` and `/folklore` answer 200 in 0.15–0.55 s across three samples each.

**Nothing rejected today.** Two low findings were filed and both survived adversarial refutation, both one-line fixes: the document route never consults `board:taxes:index` and nothing ever deletes a key (so unpublishing does not unpublish), and both accounting periods' filings are served under the same `Content-Disposition` filename (verified genuinely distinct: `md5` `1a5262e7…` versus `18f1b8ef…`). Both are carded.

**Recorded so it is not filed as a one-off:** `scripts/board/sync-docs.mjs:91-92` uses the byte-identical set-only publish pattern, so the missing-prune shape is a house convention across the board scripts rather than a defect unique to the tax publisher.

**Live gate sweep, run this morning.** `POST /api/folklore/job` → 503 `not-available`; `POST /api/x/register` → 400 `bad-input`; `/api/x/archive` is a GET-only route so POST → 405; `POST /api/board/publish` → 404, no such route. All fail closed. One note for future sweeps: the apex redirects to `www` with a 307, so an unfollowed curl reports 307 on **every** route and tells you nothing — follow redirects before drawing any conclusion.

## 2026-08-01 — nothing rejected; the emergency repair verified live, and two candidates killed before filing

**Range.** `origin/main` since the 2026-07-31 review of record: two commits — `da68abe` (this ledger) and `b4a63b6`, which changed exactly one file, `content/this-week/2026-07-29.json` (+41/−26). No TypeScript changed. Plus a full live production sweep.

**Yesterday's emergency repair is live and correct.** `GET /api/hansard/digests/2026-07-29` returns `highlights.bills` as five elements, **every one carrying exactly the keys `[row, blurb]`** — the wrapped shape the app's type requires. All ten published issues were audited: bills, votes and questions are now uniformly `{row, blurb}` or empty everywhere, so **no sibling issue carries the same defect**. The index endpoint returns ten rows with the newest at `2026-07-29`, mode `recess`.

**Live gates all fail closed.** `POST /api/folklore/job` → 503 `{"ok":false,"reason":"not-available"}`. `/board` → 307 challenge. `/api/x/archive?handle=jack&full=1` → 402 `{"ok":false,"reason":"payment-required"}`, refusing **before** any billed read. `/api/x/quote` with an impossible handle → 400 `bad-handle`. Root 200 in 0.286 / 0.072 / 0.098s; `/folklore` 200 in 1.894 / 0.457 / 0.425s, the first being the documented cold hit — the escalation condition is a warm hit above one second, which was not met.

**Two candidates killed by their own falsification checks, before filing.** First: `highlights.questions` is empty in all ten published issues, which reads like a producer defect. It is deliberate — `generate.ts:69` passes `questions: []` into the narrator and `:87` emits `questions: []` into highlights; questions feed the statistics and the department histogram instead. Second: the two recess issues (2026-05-27 and 2026-07-29) omit `headline`, `body`, `feature`, `qa` and `topTopics`, but those fields are optional in `types.ts:68-70`, and the 2026-05-27 recess issue has served that exact shape for months without incident.

**One finding confirmed and carded, and it is the lesson of the whole episode.** The emergency was repaired in **data only**. `store.ts:25` casts with `as DigestData`, an assertion erased at runtime; the route checks only the slug regex and the published status before serving; and the sole content gate, `content-integrity.test.ts`, is thirty-three lines whose two assertions both scope to `votes` — the words `bills` and `questions` do not appear in the file. Nothing in the repository stops the same shape shipping again.

**Standing rejections re-affirmed, not re-filed.** Open pull request #47 (the word rename) remains held pending the app release window, per the 2026-07-31 entry; #59 is a two-day-old draft specification, not finished work. Neither was reported as a stale-pull-request finding.

## 2026-07-31 — two rejections, both about the new head ceiling's edges; the robots.txt override and the blank-budget coercion re-confirmed

**Range.** `a8ed5e2..9a82797` — two commits, one documentation (`c64625e`, the 2026-07-30 ledger) and one code (`9a82797`, "The unpaid X head reads get a ceiling of their own", #58) — plus the full live production sweep and the open pull requests. Four findings; two confirmed, two rejected.

**Live checks (the evidence).** `/` → 200 in 0.243 / 0.221 / 0.238s. `/folklore` → 200, warm hits under a second. `POST /api/folklore/job` → **503** `{"ok":false,"reason":"not-available"}`, matching the flag check at `route.ts:38-40` before the body is read. `/board` → 307 to `/board/login` (reported as the redirect chain, per the standing caution — never `curl -L` a gated route). `/api/x/archive` and `/api/x/fetch` refuse unpaid. **All money and privacy gates fail closed.** Note for future sweeps: the apex `henceforth.club` 307s to `www.` — a bare `curl https://henceforth.club/api/...` returns the string `Redirecting...`, not JSON. Use `www.` for API probes.

**Confirmed 1 — the Cloudflare robots.txt override (card `finding-site-cloudflare-robots-override-2026-07-30`), re-confirmed and sharpened.** `curl -sS -D - https://www.henceforth.club/robots.txt` (200, `server: cloudflare`, 2,395 bytes) still opens `# BEGIN Cloudflare Managed content` with `Content-Signal: search=yes,ai-train=no,use=reference` and `Disallow: /` for Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, CloudflareBrowserRenderingCrawler, Google-Extended, GPTBot and meta-externalagent. `src/app/robots.ts:6` is `{ userAgent: "*", allow: "/" }` with fourteen named allows at `:12-25`, and the file contains **no `Disallow` at any of its 29 lines**. **Sharpened this run:** Amazonbot and CloudflareBrowserRenderingCrawler each appear in exactly one group and that group is `Disallow: /` — unlike the other seven they have no counterpart Allow anywhere, so there is no group-merge tie to resolve; they are blocked outright by a rule the repository never wrote. Not fixable in code.

**Confirmed 2 — the paid ceiling reads a blank budget as zero (card `finding-site-daily-budget-blank-is-zero-2026-07-30`), re-confirmed.** `src/lib/xSpend.ts:32-37` coerces before validating: `const raw = Number(env.X_API_DAILY_BUDGET_USD); return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DAILY_BUDGET_USD`. `Number("")` is 0, finite, `>= 0`; `Number(" ")` is 0. Then `xSpend.ts:86-88` answers 429 `budget-exhausted` from the first paid read of the day — indistinguishable from genuine exhaustion, so the feature is off while looking configured. The module written yesterday **names this exact bug** at `xHeadSpend.ts:92-95` and fixes it for itself at `:97-104` by trimming first. Recorded so a deliberate deferral does not become permanent.

**Rejected 1 — "the new unpaid head ceiling closes silently — no refusal record, no Retry-After."** Both halves die on evidence the finding did not open.

1. *"No Retry-After, so a client cannot tell how long to wait" is false at the only consumer.* `XArchiveClient.swift:51` defines `gateError(status: Int, body: Data)` — status and body only, **no access to `HTTPURLResponse` headers** — so a Retry-After on this path would be structurally invisible to the shipped app. Line 58 already decodes `(429, "budget-exhausted")` into a dedicated `.budgetExhausted` case, and `:34` renders "…your fee was NOT consumed and is held for the next run. Try again tomorrow." — the correct and complete wait for a UTC-day bucket (`xHeadSpend.ts:107-109`). `XArchiveWiring_Tests.swift:401` asserts `heldFeeSurvives(.budgetExhausted)`, so the money half is already settled client-side.
2. *"No refusal record" misreads a module contract and mistakes house convention for a regression.* `xRefusalLog.ts:16` is `KEY = "x:register:refusals"` and its doc at `:4` says "Durable record of every refusal **POST /api/x/register** sends" — it is register-scoped **by definition**, so "neither route imports it" is compliance, not omission. The neighbouring **paid** ceiling at `xGate.ts:97`, on the money path since 2026-07-08, answers with the identical bare `deny(429|503, reason)` — no header, no log — so the new bucket matches the established contract. The whole `src/app/api` tree holds three console writes (`this-week/route.ts:76,84,88`), so "no console write" describes every route, not this arm. And "record nothing" is itself wrong: `xHeadSpend.ts:133-140` writes a durable Redis counter `xapi:head:<utc-day>` with a 48-hour TTL that parks at the ceiling on exhaustion — exactly the volume signal `:70-78` tells the operator to watch.
3. The finding's own quoted evidence is the author's **written disclosure** (`xHeadSpend.ts:38-55`: the paying-path refusal is stated plainly and "accepted deliberately… tracked separately rather than pretended away here"), which is the standing rejection pattern recorded on 2026-07-28.

An exhaustion alert remains a fair suggestion; as a defect it does not survive.

**Rejected 2 — "pull request #47 has been blocked four days on a dependency with no date."** Three independent kills. (1) **Duplicate of an open card.** This ledger's 2026-07-28 entry records the identical claim as already confirmed and carded, and `finding-site-xfolklore-doc-ahead-of-app-2026-07-28` is live on the Morning Board with a 30 July note that re-derives today's exact grep. Nothing in the filing is new. (2) **"No date" is false.** The card names the closing condition explicitly — a Henceforth release containing the word must be live, dependency identified as Henceforth #37 — and the cadence card names the window, Wednesday 2026-08-05. (3) **The claimed failure is guarded by platform behaviour.** `gh api repos/:owner/:repo/pulls/47` returns `draft: true`, and GitHub refuses to merge a draft, so "merging #47 deploys in about thirty seconds" cannot occur; the pull request body states the same intent in writing ("Merge together with the app change…"). The underlying gap **is real** — the falsification check holds, `git grep -l xfolklore origin/main -- '*.swift'` in Henceforth returns zero files against ten for the control — but a deliberate, dated, already-carded hold on a draft pull request is not a defect, and re-filing it is precisely the re-flag loop this ledger exists to prevent.

## 2026-07-30 — nothing rejected; yesterday's carded fix proven INSUFFICIENT, and an intermediary is contradicting the shipping branch

**Head.** `origin/main` `a8ed5e2a`. Live sweep against production, read-only. Note the host: the apex `henceforth.club` now **307-redirects to `www.henceforth.club`** — new since yesterday, when the apex served 200 directly. No commit in the range touches `vercel.json`, `next.config.ts` or `middleware.ts`, so this is a domain-level change, not a deploy. **Probe `www`, or every route reads as a redirect and every gate looks like it is failing.** That trap cost the first pass of this morning's sweep.

**No rejections this run.** Three findings, all confirmed. The first is logged because it *corrects a card written yesterday*.

**Confirmed 1 (carded: `finding-site-xarchive-billed-before-gate-2026-07-30`, FACT/high) — YESTERDAY'S FIX WOULD NOT HAVE WORKED.** `finding-site-xquote-unbilled-tap-2026-07-29` named `/api/x/quote`. That is true but incomplete: `src/app/api/x/archive/route.ts` reads the `full` flag at `:47`, calls `fetchProfileHead` at `:56` — an authenticated billed request (`src/lib/xfetch.ts:48`) — and reaches its payment gate `payAndReserve` only at `:64`, eight lines later. **Proven against production at zero cost**: X bills per resource *returned*, so a request for a handle that does not exist bills nothing; `?full=1` on a nonexistent handle reached X, while the same handle without `full=1` returned 402 — which also proves the gate exists and that only the `full=1` pre-read escapes it. The comment at `:51-53` wrongly cites `/api/x/quote` as the reason the head is safe. **Any gate must land on both call sites in one change.**

**Confirmed 2 (carded: `finding-site-xquote-cost-quantified-2026-07-30`, FACT/high).** `src/lib/xSpend.ts:22` sets `USD_PER_RESOURCE = 0.005` and the quote returns exactly one resource — half a cent per anonymous request, uncached, roughly $18/hour from one unattended loop, and invisible to the daily ceiling because nothing reserves it. Three controls checked and excluded rather than assumed: `middleware.ts:8` matches only `/board`, `vercel.json` is `{}` entire, and no wrapper intervenes. Smallest fix is **not** a rate limiter: `reserveXApiSpend(1)` immediately before `fetchProfileHead` on both routes, returning 503 with the reservation's reason — about four lines each, using a function that already fails closed when Redis is unreachable.

**Confirmed 3 (carded: `finding-site-cloudflare-robots-override-2026-07-30`, FACT/high).** Live `robots.txt` opens with `# BEGIN Cloudflare Managed content`, a `Content-Signal: search=yes,ai-train=no,use=reference`, and `Disallow: /` for ClaudeBot, GPTBot, Google-Extended, Applebot-Extended, CCBot, Bytespider and meta-externalagent. Falsified the obvious alternative before reporting: `git grep -niE 'content-signal|cloudflare|Amazonbot' origin/main -- src scripts public` returns zero and `origin/main:src/app/robots.ts` contains no `Disallow` at all, so the repository cannot be emitting it. The site therefore **ships an allow-list for citation and serves the opposite**. Not fixable in code — a Cloudflare dashboard setting. Either outcome is defensible; shipping one intent and serving another is not.

**Ops finding, same sweep (carded: `ops-xtext-worker-crashloop-2026-07-30`) — and a severity correction against my own first instinct.** `club.henceforth.xtext-worker` on the mini is in a crash loop (`Cannot find package '@bsv/sdk'`; the installed dependency tree is absent entirely from that checkout; the error log is 8.2 MB and still growing). Its own README calls it "the only place custody of a visitor's per-job key ever exists", which reads as an immediate money-path outage — **and it is not one**, because `POST /api/folklore/job` is verified dark at 503, so no visitor can create a paid job. Recorded deliberately: the severity claim was checked against the live gate before being written down, and downgraded from live emergency to **pre-condition of go-live**.

**Ops finding, same sweep (folds into `ops-folklore-monitor-false-alarms-2026-07-28`) — now measured rather than argued.** The mini's synthetic check emailed eight times overnight, every message "slow: 2.0–2.5s (budget 2.0s)". Twelve samples from the monitor's own log today: 1.775, 1.754, 1.923, 1.846, 1.806, **2.142 (fail)**, 1.695, 1.749, 1.725, 1.820, 1.802, 0.718. **Steady state is 1.7–1.9s against a 2.0s budget — the threshold sits inside the noise band**, so ordinary variance alerts and the next sample recovers, costing two emails per flap. `text-monitor.sh:77` says outright that the budget was set with "no latency series on disk… nothing observed behind" it. There is now a series. Two separate conclusions, and raising the budget alone would hide the second: the alarm is mis-calibrated, **and** `/folklore` really is about a second slower than every other route.

## 2026-07-29 — nothing rejected; a live billed endpoint found open, and a caution about reading gated routes through `curl -L`

**Range.** No commits on `origin/main` since 2026-07-26 (`1ffdeda`). Live sweep only. Two findings, **both confirmed**, nothing rejected.

**Confirmed 1 — EMERGENCY (carded `finding-site-xquote-unbilled-tap-2026-07-29`).** `src/app/api/x/quote/route.ts` is 67 lines with no auth, no payment gate, no throttle and no budget reservation; line 42 makes a real billed X call (`fetchProfileHead`, `src/lib/xfetch.ts:39-49`, an authenticated Bearer request) after only a token check, a handle regex and `bsvUsd()`. Line 19 states the control in terms: *"The per-address rate limiter is what stops it being abused."* **That limiter does not exist.** Verified live: `GET https://henceforth.club/api/x/quote?handle=jack` returns **200** from production, unauthenticated. Four falsifiers were checked — `middleware.ts:8` matches only `["/board","/board/:path*"]`; no rate-limiting dependency in `package.json`; no auth in the route; and the token *is* set in production (the route returns 200 rather than `503 server-token-unset`). **It is a regression, not an oversight:** commit `868bf04` (2026-07-08, "Nobody spends our X API credit without paying for it first") deleted the ten-per-address-per-hour limiter from `/api/x/fetch` and `/api/x/archive` because those became payment-gated. `/api/x/quote` is deliberately *not* payment-gated, so it lost the guard and gained no replacement. **The fix is already in the repository**: `src/lib/folkloreJob/submitThrottle.ts` exports `claimSubmitSlot(address)` and `clientAddress()`, and `/api/folklore/link` uses them to return 429 with `retry-after` (`route.ts:16`, `:218-221`).

**Confirmed 2 (carded `finding-site-main-typecheck-red-2026-07-29`).** On a provably clean tree at `origin/main` `1ffdeda`, `npx tsc --noEmit` exits 1 with one error — `src/app/folklore/sortPosts.test.ts:103`, TS2353. **Scope narrowing that matters:** `npx next build` on the same clean tree exits **0**, so Vercel deploys and the live site are unaffected; the damage is to editor diagnostics and to any future typecheck gate. Pull request #53 fixes it in two lines, is out of draft, and has 1,225 tests green — it has simply not been merged.

**CAUTION FOR FUTURE SWEEPS — how to read a gated route.** `/board` and `/board/week` both 307 to `/board/login`. Followed with `curl -L` they report **200**, which looks like an ungated leak and is not: the 200 is the login page itself (21,774 bytes, identical for both). Check the final URL, not just the status. This is the mirror image of the standing apex-307 caution: without `-L` every route reads as a 307 outage, and with `-L` every gated route reads as a 200 leak. Report the redirect chain.

**Live checks (the evidence).** `/` → 200 in 0.395 / 0.239 / 0.240s. `/folklore` → 200 in 1.720 / 0.469 / 0.590s — the first is the documented cold hit; the escalation condition is a *warm* hit over one second, not met. `POST /api/folklore/job` → **503** `{"ok":false,"reason":"not-available"}`, matching the `XTEXT_WEB_ARCHIVE_ENABLED` flag check at `route.ts:38-40`, before the body is read. All money and privacy gates fail closed.

## 2026-07-28 — four rejections across the unmerged branches; one reported a regression test's PASS as proof of the bug it prevents

**Range.** No commits on `origin/main` since 2026-07-26 (`1ffdeda`), so today's review was redirected to the four open draft pull requests, where the unreviewed code actually is: `#47 xfolklore-rename` (`f66e147f`), `#48 folklore-front-door`, `#49 bananablocks-fetch` (`f3b0be8d`), `#50 daily-report-date` (`e622eeba`). Six candidate findings against the site, **two confirmed, four rejected** — each rejection produced by a different agent from the one that filed it.

**Rejected 1 — "the board's post count is served from cache without the freshness check the module itself defines" (claimed MEDIUM).** The citations are real: `readCachedPostCounts` (`src/lib/xArchiveCache.ts:501-513`) accepts on `meta?.v === META_VERSION` alone and never reads `txidSetHash`, while `resolveHandle` (`:357`) does gate on it. What kills the finding is that **the "probe test" the reviewer ran to prove the defect is this repository's own regression test for the opposite bug** — `src/app/folklore/_components/directoryRows.test.ts:55-69`, whose comment reads *"The 2026-07-16 bug: a 1,672-post archive whose newest delta carried two posts rendered as '2 posts'. The cached total is the answer whenever it exists."* The reviewer reproduced that fixture down to the handle name and the number, watched it pass, and reported the pass as evidence. The proposed remedy is actively harmful: applying the hash gate inside `readCachedPostCounts` drops the count on mismatch, falling through to `fallback = digests.get(latestTxid)?.tweetIds.length` — printing the newest delta's size as the whole archive, i.e. reintroducing 1,672 → 2. **Accurate residue:** if `warmArchiveCache` fails at registration *and* the transaction becomes fetchable later *and* nobody visits the profile page *and* `KUDOS_ENABLED` is off, the board total stays short by the delta until one of those happens — a deliberately accepted bound, and the self-heal it replaced is the poison-pill stitch that took `/folklore` down on 2026-07-13. Do not re-flag as a defect; a `warmArchiveCache` retry is a legitimate *suggestion*.

**Rejected 2 — "the BananaBlocks mirror is unreachable when the primary hangs".** The abort mechanics are correctly described: `AbortSignal.timeout` starts its timer at creation, so one signal shared across both attempts (`fetchWithMirror`, `src/lib/whatsonchain.ts:17-31`) leaves the mirror rejecting instantly when the primary consumes the whole 5,000 ms. But **the comment naming this exact threat sits at the cited lines** — `:158-159`: *"One signal across both attempts: the ceiling bounds the whole lookup, so adding the mirror never widens the stall a hung primary can cause."* It is the documented decision, not an oversight, and **two existing tests assert both directions** (`whatsonchain.test.ts:241` — the mirror does serve the lookup when WhatsOnChain fails; `:207` — the abort path yields `archive` present, `time: undefined`). The claimed-degraded behaviour is the asserted specification. The finder conceded the comment in their own falsification note and filed anyway.

**Rejected 3 — "the founding-backfill script documents WhatsOnChain arithmetic but now takes BananaBlocks' asserted fee, and the value is permanent".** The mechanism is real — `scripts/run-founding-backfill.mjs:44` passes no `deps`, so `foundingBackfill.ts:53` resolves `feeOf` to the new BananaBlocks-first `fetchTxFeeSats`. Every consequence built on it fails against tooling in the same directory the reviewer never opened: `scripts/correct-media-founding.mjs` exists **specifically to recompute and correct already-written founding fees** (deletes the `x:vote:founding` nx gate at `:85`, replays `appendFoundingVote` with corrected sats at `:96`, backs up first, aborts loudly on precondition failure), with `scripts/restore-founding-ledger.mjs` as rollback — so the write is not permanent. That same script carries the **independent-oracle agreement gate** the finding calls absent, cross-checking against bitails with exact-agreement-or-abort. The finding also calls `fetchBananaBlocksFee` a function that trusts the field "outright" while quoting the `has_fee`/`isInteger`/non-negative chain that makes it not outright, with fall-through to the prevout walk. **Accurate residue, worth a one-line edit:** the header comment at `:8-9` ("Fees come from WhatsOnChain with prevout resolution") was true on `main` and went stale on this branch. Doc drift, nothing more.

**Rejected 4 — "the reports index still prints ISO dates, so the site shows two date formats".** Literally true (`src/app/board/reports/page.tsx:36` renders `e.date` raw; the branch changes the edition header to `longDate`). Rejected because **the pull request body declares it out of scope in writing** — #50's "Not included" section states verbatim that the `generated` timestamp and the reports index "were left alone as out of scope". Reporting to an author the limitation the author documented is not a finding. The headline premise is also false: the site already formats dates per-surface on `main` ("Monday 07-27" and bare "27" on the weekly page, "27 Jul 2026" in folklore, long en-GB on the board header), so no uniform convention was broken. Index/edition parity is a legitimate standalone cosmetic task, which would also have to decide the weekly rows' format.

**Confirmed 1 — and it blocks a merge (carded `finding-site-xfolklore-doc-ahead-of-app-2026-07-28`, high).** Merging #47 publishes a word reference whose heading, prose and usage line all read `xfolklore` — a token the released app (4.48, 2026-07-23) rejects. `git grep xfolklore origin/main` in the Henceforth repo returns **zero matches**, so the app-side rename is unmerged, and merging its pull request would not close the gap either: the site deploys on merge and reaches every reader, while only an App Store release reaches users. Hold #47 until a release containing the word is live, or reword the reference to lead with `xtext`.

**Confirmed 2 (carded `finding-site-hit-counter-ungated-2026-07-28`, low).** `src/app/api/hit/route.ts:11-23` increments `views:total` and `views:<date>` with no auth, origin check, deduplication or rate limit; `middleware.ts:8` matches only `/board` paths so nothing runs on it, and a grep for rate limiting across `src/` returns zero hits. The browser-side `sessionStorage` guard (`PageViewTracker.tsx:12-16`) is the only deduplication and is invisible to non-browser callers. Interpretive, not necessarily a code change: the morning report must read the number as a soft ceiling, not as audience.

**Live sweep, recorded so it is not re-derived tomorrow.** `origin/main` `1ffdeda`. Apex 307s to `www` (canonical) then 200 — **a check that does not follow redirects reports every route as `307` and reads as an outage**; follow the redirect before filing. `/` 200 in 0.19–0.36s, `/folklore` 200 in 0.50–0.81s, `/board` correctly challenges to `/board/login?from=%2Fboard`, `POST /api/folklore/job` correctly refuses with **503**. All gates fail closed. **The mini's `/folklore` synthetic alerts (thirteen overnight) are about the monitoring host, not this site** — see the DaDeckOfCards ledger entry of the same date; do not open a site-performance finding from them.

## 2026-07-25 — healthy end-to-end, and the 2026-07-20 xregister EMERGENCY is formally CLOSED

**Range.** `origin/main` ab56100..08fe057 (tip `08fe0573`) — nine commits, all reviewed clean: both digest-leak fixes verified LIVE (`/han*` draft URLs 404 with zero draft-headline occurrences in the bodies), the register status contract (`d7b1d27`), the durable refusal log (`08fe057`), the folklore board wiring (`677745b`/`620c7ac`/`a7771a9`) and the gated submit page (`0139ec3`, serving its honest closed state at `/folklore/submit`) all confirmed at their definitions; `asc-release.mjs` (`1769b0d`) sound as a laptop-side tool.

**Live checks (the evidence).** `/` 200 in 0.16–0.30s ×3; `/folklore` 200 in 0.36–0.50s ×3 — sub-second bar met. `POST /api/folklore/job` → 503 `not-available` (fails closed). `/board` → challenges (login redirect). `npm test`: 1179 passed / 2 skipped on a clean checkout at tip. `gh pr list`: zero open pull requests.

**CLOSED.** The 2026-07-20 CONFIRMED EMERGENCY (`/api/x/register` self-certifying handle binding) is fixed and live at HEAD: `0f1fd7b` verifies the binding post off X's oEmbed (author_url handle, tail-permalink corroboration against both handle and post id) and `d4c36de` kills the retweet vector; every refusal reason present with correct status bands. Future runs stop carrying this as live. (Not re-verified with a funded live registration this run — report-only.)

Nothing rejected today.

## 2026-07-23 — the site is healthy and every gate holds, but the first-ever draft digest leaks through a route nothing gates

**Range.** Two commits since yesterday's sweep. `8a9b902` (2026-07-23 00:17, 8 files / 805 insertions) is
the folklore hero redesign plus the four `/hh` screenshot scripts; `ebeae69` adds one file,
`content/this-week/2026-07-22.json`. HEAD == `origin/main` == `8a9b902958ec395c318112d4f1ae595dcbb5dbd8`;
`gh pr list` empty at exit 0, so nothing finished is sitting unmerged.

**CONFIRMED CLEAN — the live site, recorded so it is not re-derived tomorrow.** Measured on `www` (per
the standing apex-307 correction below): root **200 in 0.074 / 0.082 / 0.090 s**, `/folklore` **200 in
0.651 / 0.264 / 0.442 s** — the sub-second bar met with no escalation across samples. Every gate fails
closed: `POST /api/folklore/job` → **503** `{"ok":false,"reason":"not-available"}`,
`POST /api/folklore/link` → **503**, same shape; `/board` → **307** to `/board/login?from=%2Fboard`.

**CLOSED, DO NOT RE-FILE — the 2026-07-20 EMERGENCY on `/api/x/register`.** `verifyBindingPost` is
imported from `src/lib/xBindingLive.ts` at `route.ts:9` and **awaited** at `route.ts:86`; not-found,
wrong-author and no-binding all return 422 and unreachable returns 503. It fails closed on main. The
self-certifying binding hole is fixed.

**REFUTED BY TEST — "`fetch-mini-screenshots.sh` could prune outside its destination."** The hypothesised
catastrophic delete cannot occur: `${SCREENSHOT_DEST:-$HOME/…}` uses `:-`, which substitutes on **empty**
as well as unset, so the destination can never expand to bare `/`. Tested, not reasoned. The four new
scripts also hold no secrets — grep for `WIF|KEY|SECRET|TOKEN|PASSWORD` returns nothing.

**REFUTED — "the folklore hero redesign is a performance or accessibility risk."** The component is
`aria-hidden` and `pointer-events-none`, its scroll listener is passive and `requestAnimationFrame`-
throttled with a cleanup that cancels the pending frame (`FolkloreForest.tsx:169-177`), and
`prefers-reduced-motion` is honoured in both the effect and the stylesheet. `8a9b902` also touches no
money path: `git show --name-only 8a9b902 | grep -cE 'src/lib|src/app/api'` returns **0**.

**CONFIRMED and carded — `finding-site-draft-digest-og-leak-2026-07-23` (HIGH).** `ebeae69` committed the
first digest ever carrying `"status": "draft"` (the other eight read `published`), and its own commit
message claims it "404s at its own URL until Henry publishes it". That is true of the page and **false of
the share card**. `[week]/page.tsx:45` gates correctly on `digest.status !== 'published'`; its sibling
`[week]/opengraph-image.tsx:17` calls `loadDigest(week)` and never reads `.status` at all. Live this run:
the page returns **404** while `/hansard/this-week/2026-07-22/opengraph-image` returns **200 image/png,
67,546 bytes** — and the rendered PNG, opened and read, carries the draft's own headline ("Andy Burnham
takes office, and rewires the state"), window label, statistics ("115 MPs · 823 written questions · 2
votes") and story of the week. This is review-gated content escaping before sign-off.

**CONFIRMED and carded — `finding-site-sitemap-draft-2026-07-23` (medium).** `sitemap.ts:43` builds its
week routes from `listPublishedWeeks()`, which does not do what its name says: `store.ts:9-17` readdirs,
filters on `.json`, sorts and reverses, with **no status filter anywhere in its body**. The real filter is
`selectPublished` at `:34-36`, which the sitemap never reaches — while the neighbouring `learnRoutes` at
`:36` correctly use `publishedEpisodes()`. Live: the sitemap lists all nine weeks including
`this-week/2026-07-22`, whose page 404s. `npx vitest run src/app/sitemap.test.ts src/lib/this-week` is
green at **44 passing**, and none of those tests asserts draft exclusion — so the gate cannot catch it.

## 2026-07-22 — the 01:55 alert was CORRECT (do not refute it); the branch merge hazard REFUTED by simulation; two stall readings corrected

**REJECTED — "today's 01:55 folklore alert is refuted by live production curls."** The alert never
claimed the site was down, so the curls refute nothing. Reading the monitor's alerting block on the
monitoring host: the subject defaults to `/folklore is failing its synthetic check`, but when the
failure text contains `THIS MACHINE` it is **overridden** to
`The folklore monitor cannot trust itself — the Mac mini is low on disk`, with advice reading
`This is the MONITORING HOST, not the site.` `monitor.log:709` records the 02:55:29 BST entry:
`THIS MACHINE is low on disk: 125 MB free (floor 2048 MB) — page checks below cannot be trusted`.
**The guard added on 2026-07-21 worked correctly on its first real outing**, and its condition is
still true. Credit it; do not re-file it as a site finding.

**CONFIRMED for the record — the site itself is healthy and every gate fails closed.** Live curls
this run: root **200 in 0.071-0.080 s**, `/folklore` **200 in 0.275-0.637 s** warm, no latency
escalation across samples. `POST /api/folklore/job` → **503** `{"ok":false,"reason":"not-available"}`;
`POST /api/folklore/link` → **503**, same shape; `/board` challenges. `gh pr list` empty at exit 0 —
no finished feature sitting unmerged.

**REFUTED BY SIMULATION — "Henry's branch is 36 behind and lacks both binding-security commits, so
merging it risks un-shipping them."** Every raw fact re-derived and true:
`git rev-list --left-right --count origin/main...folklore-submit-rails` = **36 10**, merge base
`748d96c`; `git cat-file -e folklore-submit-rails:src/lib/xBindingLive.ts` exits 128 while
`origin/main` exits 0. **But the risk mechanism is a causal story that was asserted, never
demonstrated — and it is false.** `git merge-tree --write-tree` run read-only in **both** directions
resolves without un-shipping the binding-security code. `git cherry` marks 8 of 10 commits already
equivalent on main and the other two shipped under rewritten hashes, so **nothing is stranded**.
This is stale-predecessor hygiene, not a security hazard. The branch is nonetheless **spent**:
merging it would revert 40 files (133 insertions against 3,082 deletions). Move the four uncommitted
files onto main; leave the branch behind.

**REJECTED — "the kudos and Elo card's build half rode yesterday's rebase onto main."** It did not.
The plan `2026-07-18-folklore-kudos-elo.html` still reads 28 checkboxes with 19 checked and its last
touching commit is `ec5dc50` (2026-07-19 09:42), which **predates** the rebase. Stripe remains two
prose comments only (`src/lib/kudos/constants.ts:64`, `src/lib/kudos/float.ts:79`) with no dependency
and no webhook; no `src/lib/kudos/pricing.ts` exists anywhere on `origin/main`; `markSettled` has
zero production callers (definition at `src/lib/kudos/float.ts:180` plus nine test hits). Nothing
moved in three days.

**CONFIRMED — the folklore link board LANDED on main, so the "branch-only" premise is retired.**
Nine folklore commits sit on `origin/main` at `6c07ec5` with author dates 07-19/07-20 but committer
dates 2026-07-21 14:50-14:52 (the rebase signature); `git reflog show origin/main` records the push
at 14:53:00. `src/app/api/folklore/link/route.ts` and its test now exist on main, gated at `:144` as
the **first statement** of POST. The binding fix survived the rebase:
`git merge-base --is-ancestor 0f1fd7b origin/main` is YES and
`git cat-file -e origin/main:src/lib/xBindingLive.ts` succeeds.

**METHOD NOTE — an absence claim needs a control, and a glob is not a search.** A Sci Fri alarm
("episode 2 undelivered") rested on `ls -lt ~/Desktop/*.mp4`, a **non-recursive** glob that misses
`~/Desktop/Top Secret/`, where both masters in fact sit. A test that fires identically on delivered
and undelivered work proves nothing. The same run's good absence claims each carried a control that
found a neighbouring file — that is the difference between "not there" and "I looked in the wrong
place".

**HOUSEKEEPING — this ledger is uncommitted on a spent branch.** The 2026-07-20 entry above and this
one both sit in the working tree on `folklore-submit-rails`, which contributes nothing main does not
already have. Move this file to main alongside the four folklore presentation files rather than
committing it here.

## 2026-07-21 — the `/folklore` alerts were a false alarm from the monitoring host; the site never went down

Two synthetic-check alerts fired (2026-07-20 22:55:47 and 2026-07-21 06:15:10), both reading
`https://www.henceforth.club/folklore — curl could not connect`. Neither was a site incident.

**REJECTED — "the site was down" (hypothesis one).** `vercel ls henceforth-club` this run shows the
newest deployment about eleven hours old (roughly 20:50 on 20 July) — **no deploy and no failed build
in either window**, and every production deployment listed is Ready. From this laptop at 07:30 the
site served `/` in 0.09–0.37s and `/folklore` in 0.44–1.82s, all 200. Twenty of twenty curls from the
mini itself returned 200 in 0.29–1.74s.

**REJECTED — "the recovery-email path is broken."** It works. A faithful replica of the script's state
machine run on the mini printed `DEBUG previous=[fail]` → `RECOVERED` → `SENT-MAIL: recovered`, and
`.site-monitor/monitor.log` holds five genuine `RECOVERED` lines produced by the current script
(2026-07-16 04:08:55, 15:43:10, 21:58:42, 22:29:29 and 2026-07-17 10:38:28). No recovery mail arrived
for a different reason, recorded below.

**REJECTED — "the Mac mini was offline" (hypothesis two).** The decisive line is one the alert email
never showed. Each pass runs three checks; only the two page checks appear in `monitor.log:597`
and `:626`. The third, `check_register` (a POST to `$BASE/api/x/register` on the **same host**), prints
a reason on curl failure and printed nothing — so name resolution, TLS and HTTP to
`www.henceforth.club` all succeeded inside both failing passes. Corroborating: mini uptime 13 days
20:25 (no reboot) and the unified log at 22:52:04 shows a satisfied network path
(`interface: en1[802.11], ipv4, ipv6, dns, uses wifi, LQM: good`).

**CONFIRMED — `"curl could not connect"` is a mislabel for *any* nonzero curl exit, reproduced against
a live 200.** `text-monitor.sh` `check()` is
`if ! out=$(curl -s -o "$body" -w "%{http_code} %{time_total}" --max-time 15 "$url"); then … print -r --
"$url — curl could not connect"; fi` — the exit code is discarded and never logged. Run on the mini
this turn: `curl -s -o /System/hh-probe -w "%{http_code} %{time_total}" --max-time 15
https://www.henceforth.club/folklore` → `exit=56 out=[200 0.382133]`. The server answered 200 in
0.38s and curl still exited nonzero, purely because it could not write the response body. That is the
discriminator between the checks: `check_register` writes to `/dev/null` and needs no disk; the two
page checks write a 93,093-byte body to a `mktemp` file. Capture `rc=$?` and map it (6 name
resolution, 7 connect, 23/56 write failure, 28 timeout, 35 TLS) — today an alert cannot tell "the site
is unreachable" from "my own disk is full", which is exactly the confusion this incident caused.

**CONFIRMED — an empty state file matches neither `ok` nor `fail`, suppressing recovery and re-arming
the alert.** `previous=$(cat "$STATE_FILE" 2>/dev/null || print ok)`. Reproduced on the mini:
`: > /tmp/hh-empty-state; prev=$(cat /tmp/hh-empty-state 2>/dev/null || print ok)` →
`cat-exit=0 previous=[]`. `cat` on an empty file exits 0, so the `|| print ok` fallback never fires.
That matches the observed signature exactly: `monitor.log:598` logs plain `ok` (not `RECOVERED`) at
23:10:53 straight after the failure, and `:627` logs `ok` at 06:30:48 after the second. Make the read
total — `previous=$(cat "$STATE_FILE" 2>/dev/null); [[ "$previous" == fail ]] || previous=ok` — and
write the file atomically (temp then `mv`) so a short write cannot leave it empty.

**CONFIRMED, and the composite cause (labelled judgement, not fact) — the mini's own disk.** The Data
volume reads `460Gi 421Gi 1.7Gi 100%` with macOS purgeable-reclaim (`com.apple.cache_delete`) running
at 22:03:45 and at 06:14:30 — the latter forty seconds before the second failure — and a Henceforth
build writing `FORTH` DerivedData during 22:50–23:00, about four minutes before the first. This is the
only hypothesis that explains all five observations at once. Held back from fact: no historical
record of free space exists on the mini, so exhaustion **at the failure instant** is inferred rather
than observed. Do not add a `/folklore` incident to the site's record.

## 2026-07-20 — the `/api/x/register` binding hole CONFIRMED 2-of-2; the "unmerged folklore branch carries an unshipped security fix" reading REJECTED 0-of-2

**CONFIRMED, EMERGENCY — `/api/x/register`'s handle binding is self-certifying.** Raised by the
folklore money review and re-verified here by two independent refuters, one on a security lens and
one on an exploitability lens; **both failed to kill it**. Recorded here as a confirmation because
the finding is live and a later run must not treat it as already-handled until a fix lands.
`route.ts:75` gates the establish path on `parseBindingAddress(archive.posts) !== address`, but
`archive` comes from `fetchTxArchive(txid)` → `whatsonchain.ts:56-84` → `tryParseArchive`
(`folklore/onchain.ts:87-105`), which fetches by **txid alone** and accepts any JSON pushdata with a
string `source`, a string `handle` and an array `posts`. `verifyClaim` (`xBinding.ts`) proves only
that the supplied pubkey derives to `committedAddress` and signed
`henceforth-x-register:<handle>:<txid>` — and `committedAddress` is `body.address` (`route.ts:55`),
the caller's own request. Nothing contacts X: `grep -rn "Verifying my Henceforth identity" src/`
returns only the parser constant, the permalink helper, and tests. `src/middleware.ts` matches only
`["/board","/board/:path*"]` and `vercel.json` is `{}`, so there is no gate, throttle or firewall on
the route; a live probe returns **400 bad-input, not 401**. Shipped code — the route is
byte-identical on `origin/main` and untouched since `f8cd8d6` (2026-07-14).

**REJECTED (0 of 2 refuters survived) — "folklore-submit-rails is finished, unmerged, and carries a
security fix that main lacks."** The factual half is true and uncontested: zero open pull requests,
the branch pushed at `99624d5`, ten commits ahead, the gate green at 1083 passing. **The security
half is wrong, and it is what gave the finding its severity.** The self-kudos refusal is already
built on `origin/main` exactly as specified — the plan document's checkbox for it is ticked, the
spec calls for a **handle match**, and that is what `isOwnWork` does, present at the tip route and
at both duel sites on main. The branch's `sameBoundIdentity` addition is a *widening* to cover two
handles bound to one identity, not the missing refusal. Independently, the second refuter confirmed
the tip route is live (production returns 401 no-token, not the 503 the `KUDOS_ENABLED` gate would
emit) yet found no path by which an attacker obtains the prerequisite. **Do not re-file the unmerged
branch as a security finding.** Opening a pull request for it remains ordinary hygiene, sequenced
after the register fix because both touch the folklore money surface.

**DISMISSED against the standing 2026-07-19 entries (both re-derived, both still correct).**
The apex `307` to `www` — a uniform 307 across every apex path including both money gates is what a
blanket domain redirect looks like, and re-probing each path against `www` resolved every one to a
real status (200, 200, 307-to-login, 503). And `/folklore` latency — five samples gave 1.477s cold
then 0.405-0.447s warm, matching the recorded profile; the recorded escalation condition is a **warm
hit over one second**, which is not met. Standing instruction reaffirmed: **probe `www`.**

## 2026-07-19 — first entries (ledger seeded this run)

- **Apex `henceforth.club` 307-redirecting to `www` is STANDING Vercel domain config, not a
  change.** The Vercel domains API shows `redirect: "www.henceforth.club"` on the apex,
  record last updated 2026-05-15 — two months before the /hh probe first noticed. Nothing
  at HEAD produces it (vercel.json is `{}`, next.config.ts only redirects `/x` and `/text`
  to `/folklore`, middleware only gates `/board`), and repo scripts have defaulted to
  `www.henceforth.club` since 2026-07-02. **Standing instruction: /hh probes target
  `https://www.henceforth.club/...`** (or follow redirects); a 307 at the apex is not a
  finding. The app-published link chain (apex `/x` → www `/x` → 308 `/folklore`) resolves.
- **`KUDOS_ENABLED` live in production is Henry's deliberate go-live, not flag drift.** The
  Morning Board card `folklore-kudos-elo-2026-07-18` records the 2026-07-19 01:20 lock-in
  ("KUDOS_ENABLED on prod (but give gesture is app-only so web controls stripped)"), made in
  the same session as Henry-authored `918d00e`. Do not re-flag the flag state. The genuine
  residual — the plan's adversarial money review (task 11) and the self-kudos refusal (9R)
  are unbuilt while the duel/float/tip endpoints are armed — is tracked as open work on
  that same card; exposure is contained because bearer tokens mint only via the 503-gated
  job pipeline.
- **`/folklore` cold-start ~1.5s then 0.3-0.4s warm is architecturally expected** (the page
  is dynamically rendered per-request — `x-vercel-cache: MISS`, `no-store`). Watch the
  trend across runs; a *warm* hit over the sub-second bar is what would upgrade it.
