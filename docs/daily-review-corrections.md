# Daily Review Corrections — henceforth.club

The website has no automated review email; its review is the live sweep the `/hh` morning
routine generates fresh each day (production curls + the shipping branch). This ledger
records that sweep's **rejections and dismissals**, newest first, so a later run does not
re-flag what a prior run already refuted. Confirmed findings go to the Morning Board, not
here. Cite `file:line` (or the live probe) so each verdict is independently re-derivable.

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
