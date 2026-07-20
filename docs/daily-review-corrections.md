# Daily Review Corrections — henceforth.club

The website has no automated review email; its review is the live sweep the `/hh` morning
routine generates fresh each day (production curls + the shipping branch). This ledger
records that sweep's **rejections and dismissals**, newest first, so a later run does not
re-flag what a prior run already refuted. Confirmed findings go to the Morning Board, not
here. Cite `file:line` (or the live probe) so each verdict is independently re-derivable.

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
