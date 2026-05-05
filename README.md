# henceforth.club

Marketing site for three iOS apps by [Henceforth Bitcoin Limited](https://apps.apple.com/nz/developer/henceforth-bitcoin-limited/id1520654144). Live at [henceforth.club](https://henceforth.club).

## Apps

| App | What it is | Status |
|---|---|---|
| **[Henceforth](https://apps.apple.com/app/henceforth/id1602896145)** | FORTH interpreter and Bitcoin SV wallet | Released |
| **[DaDeckOfCards](https://apps.apple.com/app/deck-of-cards/id1520654142)** | Multiplayer card game | Released |
| **Hansard** | UK Parliament browser | Coming soon |

## Stack

- Next.js 16 (App Router, Turbopack) on React 19
- Tailwind CSS v4 via `@theme inline` — no `tailwind.config`
- Motion (`motion/react`) for scroll-triggered animation
- Upstash Redis for visitor counting (`/api/hit`, `/api/stats`)
- `next/og` for per-route OpenGraph cards from a shared template
- TypeScript strict mode; deployed on Vercel from `main`

## Phosphor Noir

Single-font (Space Mono) dark interface with CRT scanlines, phosphor glow, and a fixed SVG noise overlay at 3.5% opacity. One accent colour per app:

- Henceforth — amber `#fbbf24`
- DaDeckOfCards — cyan `#5eead4`
- Hansard — green `#3da87a`

## Highlights

- `HeroTerminal` — animated FORTH terminal on the homepage. Type `analytics`.
- `ConstituencyMorph` — 650 constituency dots that morph between the UK map and a party pie chart on the Hansard page.
- Per-route OG images generated at build time from a shared `next/og` template in `src/lib/og.tsx`.
- A handful of easter eggs, with cryptic clues in the footer at 20% opacity.

## Local dev

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run lint     # eslint
npm run start    # serve production build locally
```

Visitor counting needs `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local`. The site builds and runs without them — the `/api/*` routes just return errors when called.

## Deploy

`git push origin main` triggers an automatic Vercel deploy.
