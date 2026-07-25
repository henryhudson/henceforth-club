# Daily Review Corrections — henceforth.club

The website has no automated review email; its review is the live sweep the `/hh` morning
routine generates fresh each day (production curls + the shipping branch). This ledger
records that sweep's **rejections and dismissals**, newest first, so a later run does not
re-flag what a prior run already refuted. Confirmed findings go to the Morning Board, not
here. Cite `file:line` (or the live probe) so each verdict is independently re-derivable.

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
