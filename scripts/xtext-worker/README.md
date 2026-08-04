# The xtext worker

The Mac mini process that carries a paid text-archive job from a fresh quote
to a finished, on-chain archive — the only place custody of a visitor's
per-job key ever exists. It never runs anywhere else: not on the website, not
in Upstash, not in a Vercel environment.

- `worker.mjs` — the pure orchestration: one tick, every phase, every
  dependency injected. Tested against a fake store and a stubbed network
  fetch (`worker.test.mjs`).
- `keystore.mjs`, `payments.mjs`, `inscribe.mjs`, `sweep.mjs` — the sibling
  modules `worker.mjs` calls directly.
- `run.mjs` — the production entry point. Wires the real Upstash-backed job
  store, live network fetch, the Keychain wrapping key, and the tuning
  constants, then ticks `runWorkerTick` every fifteen seconds. This is the
  only file launchd runs.
- `aliasLoader.mjs` — a small Node module-resolution hook that lets `run.mjs`
  import `src/lib/folkloreJob/jobStore.ts` directly, without a build step. See
  its header comment, and the task 10 report, for why this exists instead of
  a runtime dependency like `tsx` or `ts-node`.
- `club.henceforth.xtext-worker.plist` — the launchd job definition.

## Installing on the Mac mini

1. **Check out the repository** at a stable path (the same path this worker
   will run from for as long as it is installed — the plist below points at
   it by absolute path, so moving the checkout later means editing and
   reloading the plist).

2. **Copy `.env.local`** into the checkout (or create one) with the Upstash
   credentials the website already uses — `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` (or the `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
   names) — and, if you have one, `XTEXT_TAAL_API_KEY` for the miner
   broadcast failover. `run.mjs` loads this file itself at startup; nothing
   else supplies these to a launchd job.

3. **Seed the Keychain wrapping key** — the account launchd will run this
   as, on the Mac mini itself, not this development machine:

   ```
   security add-generic-password -s xtext-worker-wrap -w <32 random bytes hex>
   ```

   Generate the 32 random bytes with, for example, `openssl rand -hex 32`.
   This key encrypts every per-job custody key at rest; losing it means
   losing the ability to decrypt keys already on disk, and a job whose money
   has not yet been swept could not be refunded.

4. **Set `REVENUE_ADDRESS`** — this is Henry's own step, not an automated
   one. Open `worker.mjs` and replace the empty `REVENUE_ADDRESS` constant
   with a real cold address the premium should pay to. The worker refuses to
   start (`revenueAddressError`) while this is unset or malformed, so no run
   can ever pay the premium to nowhere.

5. **Fill in the plist placeholders** — `club.henceforth.xtext-worker.plist`
   has three: the absolute path to `node` (find it with `which node` in the
   account that will run this job — do not assume it matches another
   machine), the absolute path to this checkout's `run.mjs`, and the
   checkout's root as `WorkingDirectory`.

6. **Install and start the job**:

   ```
   cp scripts/xtext-worker/club.henceforth.xtext-worker.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/club.henceforth.xtext-worker.plist
   ```

   `RunAtLoad` and `KeepAlive` are both set, so the worker starts immediately
   and launchd restarts it if it ever exits.

7. **Watch the log** for at least one full heartbeat cycle before trusting
   the install:

   ```
   tail -f /tmp/xtext-worker.log /tmp/xtext-worker.err.log
   ```

   A healthy start prints the "ticking every 15 seconds" line once, then
   stays quiet unless there is a job to act on — the worker only logs when a
   phase has something to report or something to flag.

To stop the worker: `launchctl unload ~/Library/LaunchAgents/club.henceforth.xtext-worker.plist`.

## The go-live gate

The web archive page (`/folklore/archive`) is built and tested behind a
mechanical gate — `XFOLKLORE_WEB_ARCHIVE_ENABLED` — that stays unset in
production until every item below has actually happened. This is a
checklist for Henry, not something a task can tick off by itself.

- [ ] **The directory backfill has run against production** — every
      previously-registered handle appears at `/folklore`, not only ones
      registered after the backfill existed.
- [ ] **An adversarial review of the money path (tasks 5 through 9) is
      complete** — a fresh reviewer, given the spec, has tried to refute
      key safety, fund safety, and state-machine totality, and found nothing
      that survives.
- [ ] **The launchd plist is installed on the Mac mini, the Keychain
      wrapping key is seeded, the worker is started, and one full heartbeat
      cycle has been watched in the log** (the install steps above).
- [ ] **A manual end-to-end run has happened with the low-funds wallet** —
      a real quote, paid, produces an inscription that renders at
      `/folklore/<handle>` and appears in the directory; and, separately, a
      deliberately underpaid job is swept back automatically.
- [ ] **Henry has signed off**, and only then does
      `XFOLKLORE_WEB_ARCHIVE_ENABLED=true` go into the production environment and
      the "archive yours" call to action on `/folklore` start meaning something.
      Setting the variable alone changes nothing: the page reads the flag at
      build time and is prerendered static, so after setting it, trigger a
      redeploy — the flow only appears once a fresh production build has run
      with the flag in place (and the same applies to turning it back off).
