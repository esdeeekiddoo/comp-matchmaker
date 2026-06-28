# Roblox 5v5 Matchmaking Stats Site — FACEIT-style

A frontend-only website inspired by FACEIT's dark UI. Queueing happens in Discord (via bots), so the site itself focuses on **stats, ranks, match history, and profiles** — no in-app "Play" queue buttons.

## Pages

1. **Home / Dashboard** (`/`)
   - Hero banner ("Queue in Discord" CTA with Discord login placeholder button)
   - Live stats strip: players online, matches today, active parties
   - Recent matches feed + top players preview
2. **Leaderboard** (`/leaderboard`)
   - Ranked table: rank, player, elo, W/L, K/D, win rate
   - Filters: season, region, role
3. **Match History** (`/matches`)
   - List of recent matches with score, map, teams, duration, link to detail
4. **Match Detail** (`/matches/$id`)
   - Scoreboard with both 5-player teams, individual K/D/A, MVP, map info
5. **Player Profile** (`/players/$username`)
   - Avatar, rank badge, ELO, stats cards (K/D, HS%, win rate, hours)
   - Recent matches table + performance chart
6. **404 / errors** handled at root

## Visual direction (match FACEIT)

- **Layout**: fixed left sidebar nav (icon + label, collapsible), thin right rail on dashboard for parties/clubs, dense card grid in main column.
- **Colors** (semantic tokens in `src/styles.css`):
  - Background `oklch(0.16 0.01 250)` near-black
  - Surface/card `oklch(0.21 0.012 250)`
  - Border `oklch(0.28 0.012 250)`
  - Primary accent **orange** `oklch(0.72 0.19 45)` (FACEIT orange)
  - Success green `oklch(0.78 0.18 145)`, destructive red
- **Typography**: Outfit (display/headings, uppercase tracked) + Inter (body), via `@fontsource`.
- **Components**: shadcn Sidebar, Card, Table, Tabs, Badge, Avatar, Progress, Tooltip. Rank badges with small icons. Subtle hover lift, orange focus ring.
- **Hero banner**: gradient overlay on a Roblox-themed image with "Connect Discord" CTA.

## Mock data

- `src/lib/mock.ts` exports arrays: `players`, `matches`, `leaderboard`, `clubs`, `parties` — realistic Roblox-style usernames, 5v5 team rosters, ELO 800–2400, ranks (Iron→Challenger).
- Player profile + match detail look up by route param.

## Auth placeholder

- "Login with Discord" button in header → opens a toast "Discord login coming soon" (purely cosmetic, no backend).

## Tech

- TanStack Start file-based routes under `src/routes/` (`index.tsx`, `leaderboard.tsx`, `matches.tsx`, `matches.$id.tsx`, `players.$username.tsx`).
- Shared `AppShell` with `SidebarProvider` + `AppSidebar` + header.
- Each route has unique `head()` meta (title, description, og).
- Recharts for the profile performance line chart.
- Framer Motion for subtle card/hero animations.

## Out of scope

- No real matchmaking, no queue button, no Discord OAuth, no backend, no database.

After approval I'll scaffold the design tokens, sidebar shell, mock data, then build the pages in parallel.
