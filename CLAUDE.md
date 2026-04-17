# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**henceforth.club** — a Next.js 16 marketing site showcasing three iOS apps by Henceforth Bitcoin Limited:
- **Henceforth** — FORTH interpreter + Bitcoin SV wallet (App Store: id1602896145) · accent: amber `#fbbf24`
- **DaDeckOfCards** — multiplayer card game (App Store: id1520654142) · accent: cyan `#5eead4`
- **Hansard** — UK Parliament browser, coming soon · accent: green `#3da87a`

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
| `/docs` | Static | Embedded LaTeX PDF (`public/hforth.pdf`) |
| `/contact` | Static | X profile links (Henceforth, Deck of Cards, personal) — no form |
| `/hello-world` | Static | Hidden easter egg — Stack Attack game |
| `/api/hit` | Dynamic | POST — increments Redis visitor counter, returns visitor number |
| `/api/stats` | Dynamic | GET — aggregated visitor stats for the terminal `analytics` command, cached 60s |
| `/sitemap.xml` | Static | Auto-generated from `sitemap.ts` |
| `/robots.txt` | Static | Auto-generated from `robots.ts` |
| `/*/opengraph-image` | Static | Per-route OG cards via `next/og` — shared template in `src/lib/og.tsx` |

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

Color palette: dark background (`#06080a`), cyan accent (`#5eead4` — Deck of Cards), warm amber (`#fbbf24` — Henceforth), green (`#3da87a` — Hansard), terminal green (`#7ee787`).

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
- **Static PDF**: `public/hforth.pdf` is the Henceforth LaTeX documentation — update by copying from `~/Programming/latex/hforth/hforth.pdf` after recompiling

## App Store Links

- Henceforth: `https://apps.apple.com/app/henceforth/id1602896145`
- DaDeckOfCards: `https://apps.apple.com/app/deck-of-cards/id1520654142`
- Developer page: `https://apps.apple.com/nz/developer/henceforth-bitcoin-limited/id1520654144`
