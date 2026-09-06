# CLAUDE.md

> **Writing style — Henry's standing preference.** No acronyms or initialisms in prose: spell things out in plain English — "pull request" not "PR", "continuous integration" not "CI", "App Store review" not an abbreviation. Terse never means abbreviated. Applies to every written output — chat replies, commit messages, pull-request descriptions, and documentation. Code identifiers, file paths, and established proper nouns are exempt.

> **Written information — the newspaper format (Henry, 2026-09-06).** Every report, brief, spec and plan written for this project is set as a self-contained newspaper HTML in the house type — Georgia seven point on eight, agate matter at five and a half, modular columns under a blackletter nameplate, the type of The Morning Edition and The Weekly Edition — never the older parchment or light-theme HTML. Copy the inline style from the most recent newspaper-set plan or spec under `docs/superpowers/` (23 August 2026 onwards) or from a rendered edition; each document carries its own nameplate (The Morning Edition is the daily paper alone). Plans keep their tick-box checklists. Fit the information to the page; the format holds a lot when it is set properly.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**henceforth.club** — a Next.js 16 site: the marketing front for three shipped iOS apps by Henceforth Bitcoin Limited, plus the gated operations board and the xtext on-chain archive surface.
- **Henceforth** — FORTH interpreter + Bitcoin SV wallet (App Store: id1602896145) · accent: amber `#fbbf24`
- **DaDeckOfCards** — multiplayer card game (App Store: id1520654142) · accent: red `#e5484d`
- **The Hansard** — UK Parliament browser (App Store: id6762037651, live since 2026-07-02) · accent: green `#3da87a`

Dark terminal aesthetic ("Phosphor Noir") with Space Mono monospace font throughout, CRT scanline effects, and phosphor glow accents.

## Build & Dev Commands

```bash
npm run dev       # Start dev server (Turbopack, hot reload)
npm run build     # Production build — run before pushing to verify
npm run lint      # ESLint
npm run start     # Start production server locally
```

Deployment is automatic — every `git push` to `main` triggers a Vercel deploy (~30 seconds).

## Architecture

### Tech Stack
- **Next.js 16** with App Router + Turbopack
- **React 19** with server and client components
- **Tailwind CSS v4** via PostCSS (no tailwind.config — uses `@theme inline` in globals.css)
- **Motion** (`motion/react`) for scroll-triggered animations
- **TypeScript** strict mode, path alias `@/*` → `./src/*`

### Route Structure

| Route | Type | Purpose |
|-------|------|---------|
| `/` | Static | Homepage — terminal hero + app cards |
| `/henceforth` | Static | Henceforth detail — terminal demo, features, App Store link |
| `/dadeckofcards` | Static | DaDeckOfCards detail — card fan, features, App Store link |
| `/hansard` | Static | Hansard detail — constituency morph animation, features, Coming Soon CTA |
| `/docs` | Static | MDX word reference (`src/app/docs/content.mdx` + `(chapters)` pages) — the LaTeX PDF embed is retired |
| `/contact` | Static | X profile links (Henceforth, Deck of Cards, personal) — no form |
| `/hello-world` | Static | Hidden easter egg — Stack Attack game |
| `/api/hit` | Dynamic | POST — increments Redis visitor counter, returns visitor number |
| `/api/stats` | Dynamic | GET — aggregated visitor stats for the terminal `analytics` command, cached 60s |
| `/sitemap.xml` | Static | Auto-generated from `sitemap.ts` |
| `/robots.txt` | Static | Auto-generated from `robots.ts` |
| `/*/opengraph-image` | Static | Per-route OG cards via `next/og` — shared template in `src/lib/og.tsx` |

### Route families added since the table above (2026-06/07)

- **`/board` world (cookie-gated, `board_session` via `/board/login`)** — the Morning Board kanban (`/board`), daily morning reports (`/board/report` → newest edition, `/board/reports` index), the week planner (`/board/week`), and the plans-and-specs library (`/board/docs`). All data is **Upstash-only, never committed** (`board:latest`, `board:report:<date>`, `board:week:<date>`, `board:docs:*`); publish tooling lives in `scripts/board/` (`publish.mjs`, `sync-docs.mjs`, `hh-plan-update.mjs`, `render-pdf.mjs` — the print editions inscribe on-chain via `BOARD_ARCHIVE_WIF`/`BOARD_ARCHIVE_KEY` in `.env.local`). The `/hh` and `/whh` routines feed all of it. **Morning Edition process (2026-08-24):** it is a newspaper, not a dashboard. `MorningSheet` draws inline SVG sparklines from `reach.perApp[].week`, prints an em dash for unprocessed days (`reachCell`, never `?? 0`), bolds the row high, spans stop-press when there is one emergency, and weights the decisions box. No Chart.js. Web: today's orders sit above the A4 sheet (`print:hidden`); the PDF is the reading copy. Helpers and pins live in `src/lib/report-helpers.ts`.
- **`/folklore` — the xtext showroom** — on-chain X-profile archives (specs A/C/D shipped 2026-07-09: showroom, handle-to-key binding, bounty routing; all non-custodial). Named `/x`, then `/text`, and `/folklore` since 2026-07-16; both former paths redirect permanently and must keep doing so — the app publishes `henceforth.club/x` into real X posts. The archive read endpoints (`/api/x/archive`, `/api/x/fetch`) demand an on-chain payment (`payAndReserve`); `/api/x/register` does NOT — it is public and unpaid, and its gate is instead the binding-signature check on claimed handles plus, when ownership is first established, a live read of the binding post on X (`src/lib/xBindingLive.ts`, keyed on oEmbed's `author_url`). Core pure modules: `src/lib/xScore.ts` (decayed scoring fold), `src/lib/xVotes.ts` (append-only vote ledger), `src/lib/xfetch.ts`, `src/lib/xIndex.ts`. The `x*` libraries stay `x`-named: they are named for X the platform, not for the product.
- **`/learn`** — Starting Henceforth, ten rendered episodes (complete 2026-07-09). Episodes and other creative artifacts are **review-gated: Henry signs off before publish**.
- **`/articles`** — one-page A4 article PDFs (hard one-page budget) + posts.

### Server vs Client Components

Server components (default): page-level layouts with metadata exports (`henceforth/page.tsx`, `dadeckofcards/page.tsx`, `hansard/page.tsx`, `docs/page.tsx`, `contact/page.tsx`).

Client components (`"use client"`): anything with hooks, event listeners, or Motion animations:
- `components/Navbar.tsx` — sticky nav with mobile hamburger, uses `usePathname()`
- `components/FadeIn.tsx` — reusable scroll-triggered fade-in via Motion `whileInView`
- `components/HeroTerminal.tsx` — animated FORTH terminal on the homepage
- `components/AppCard.tsx` — app tile used on homepage grid
- `components/Accordion.tsx` — collapsible "Learn more" sections (Hansard)
- `components/ConstituencyMorph.tsx` — canvas animation: 650 constituency dots morph between UK map and party pie chart
- `components/BeatingHeart.tsx` / `ExpandingCircles.tsx` / `TimesTableCircle.tsx` — canvas micro-animations
- `components/KonamiCode.tsx` — Konami code easter egg (FORTH word rain)
- `components/MiniTerminal.tsx` — working mini FORTH calculator (Ctrl+`)
- `components/PageViewTracker.tsx` — fires POST `/api/hit` once per page view
- `hello-world/page.tsx` — Stack Attack game with `requestAnimationFrame` loop

### Styling System

All styling is in `globals.css` using Tailwind v4's `@theme inline` for CSS custom properties. No separate Tailwind config file.

Key custom classes:
- `.terminal-window` / `.terminal-scanlines` — CRT terminal effect with scanline overlay
- `.glow-cyan` / `.glow-warm` — phosphor text-shadow glow
- `.card-glow` / `.card-glow-warm` — gradient border glow on hover (uses `::before` pseudo-element)
- `.hero-gradient` / `.hero-grid` — radial gradient + grid pattern background
- `.animate-in` + `.delay-1` through `.delay-8` — CSS staggered fade-in (used alongside Motion `FadeIn` component)
- `body::before` — fixed noise texture SVG overlay at 3.5% opacity

Color palette (green and black, 2026-08-24): black ground (`#050806`) with deliberate phthalo green (pigment `#114b3e` — hero wash, borders, selection), roundel cream club accent (`#eadfb8` — wordmark, prompts), red accent (`#e5484d` — Deck of Cards), warm amber (`#fbbf24` — Henceforth), green (`#3da87a` — Hansard), terminal green (`#7ee787`).

### Easter Eggs

Hidden features, with cryptic clues in the footer at 20% opacity:
1. **Konami code** (↑↑↓↓←→←→BA) — 60 FORTH words rain down the screen
2. **Mini FORTH terminal** (Ctrl+`) — working stack calculator in bottom-right corner
3. **Stack Attack** (`/hello-world`) — block-stacking game, not linked from navigation
4. **Terminal `analytics` command** — type `analytics` in the hero terminal to see live visitor stats pulled from `/api/stats`

### Analytics & Visitor Stats

Visitor counting uses Upstash Redis via `src/lib/redis.ts`. `PageViewTracker` client component POSTs to `/api/hit` on every page load; `/api/stats` returns aggregated totals and a 30-day sparkline for the terminal's `analytics` command. Both API routes run on the default Node.js (Fluid Compute) runtime. Also wired: `@vercel/analytics` and `@vercel/speed-insights`.

### Key Conventions

- **Monospace everywhere** — Space Mono is the only font, applied globally via `--font-sans`, `--font-mono`, and `--font-serif` all pointing to `--font-space-mono`
- **Dark mode only** — `dark` class hardcoded on `<html>`, no light mode
- **Domain**: henceforth.club (hosted on Vercel, DNS via GoDaddy)
- **Word reference**: `/docs` renders `src/app/docs/content.mdx` (one `<Word>` entry per vocabulary word; grouped entries cover the op-constant ranges). Vocabulary changes in the app must update it — see the Henceforth repo's "Adding vocabulary words" checklist. The old `public/hforth.pdf` embed is retired.

## Working rhythm

- **Morning Board (kanban).** Open work for this site is tracked as cards with board key `site` on the board this repo serves at henceforth.club/board (data file: `~/Programming/Main/DaDeckOfCards/docs/superpowers/plans/morning-board-data.js`; local mirror `content/board/latest.json`, gitignored). When you finish or start tracked work, update the card — column + dated note + `rev` bump — not just chat.
- **Auto-commit (2026-07-10, Henry's standing rule).** Completed work verified by this repo's gate (test suite + `npm run build` green) is committed and pushed without asking — and **on this repo a push IS a production deploy** (~30 seconds via Vercel). Stage only files the task touched; destructive git operations still need confirmation. Money-path changes (`/api/x` payments, vote ledger) get an adversarial review before merge.

## App Store Links

- Henceforth: `https://apps.apple.com/app/henceforth/id1602896145`
- DaDeckOfCards: `https://apps.apple.com/app/deck-of-cards/id1520654142`
- Developer page: `https://apps.apple.com/nz/developer/henceforth-bitcoin-limited/id1520654144`
