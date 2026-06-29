<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# BloxArena — Website

- `bun install` / `bun run dev` / `bun run build` / `bun run lint` / `bun run format`
- TanStack Start (SSR), React 19, Tailwind v4, shadcn/ui (New York, no RSC)
- File-based routing in `src/routes/` — see `src/routes/README.md`. `routeTree.gen.ts` is auto-generated
- Path alias `@/` → `./src/*`. `cn()` helper in `src/lib/utils.ts`
- Do NOT import `server-only`; use `*.server.ts` suffix instead
- Dark-only theme. Default Nitro target: Cloudflare Workers
- Deploy: Vercel (web app), Cloudflare Workers (Discord bot)

# Discord Bot — `bot/`

Node.js bot using discord.js v14. Runs as a separate process (not on Workers).

- `cd bot && cp .env.example .env` → fill in your values
- `node deploy-commands.js` (run once to register slash commands)
- `node index.js` to start

**Commands:** `/host` (10 players in Queue VC), `/test_host` (any size ≥ 2), `/endmatch` (pick winner → ELO → result embed → cleanup), `/reroll`, `/swap <p1> <p2>`, `/map`, `/matchinfo`

**Key IDs:** Host role: `1520798037960822834`, Queue VC: `1520786683493351565`, Results channel: `1520800644099739705`

**Storage:** Supabase (`players` + `matches` tables). Starting ELO: 100, K-factor: 32.

# Cloudflare Worker — `worker/`

HTTP-only Discord bot for Cloudflare Workers (no discord.js, uses REST API + Interaction webhooks).

- `cd worker && cp .env.example .env` → fill in values, including `DISCORD_PUBLIC_KEY`
- `node deploy-commands.js` (run locally to register commands)
- `npx wrangler secret put DISCORD_PUBLIC_KEY` (and TOKEN, CLIENT_ID, GUILD_ID, SUPABASE_URL, SUPABASE_ANON_KEY)
- `npx wrangler deploy` to deploy

**Architecture:** Single Worker handles POST interactions. Signature verification via `tweetnacl`. Match persistence via Supabase REST API (no SDK). Map vote state in-memory (resets on redeploy). All Discord API calls use `fetch`.

# OG Images — `server/routes/api/og/`

Nitro event handlers using `@vercel/og` (`ImageResponse`). Rendered as 600×420 PNG.

- `server/routes/api/og/stats.get.ts` — Player profile card (avatar, rank, ELO, W/L, win %, trend)
- `server/routes/api/og/leaderboard.get.ts` — Top-10 leaderboard with medals

**Deploy notes:**
- Build with `$env:NITRO_PRESET="vercel"` before `npm run build`
- Nitro creates **junctions** on Windows (`api/og/*.func` → `__server.func`). Must resolve before `--prebuilt` deploy: `rmdir .vercel\output\functions\api\og\*.func` then `Copy-Item __server.func destination -Recurse`
- Nitro 3.0.260603-beta has broken auto-import of `defineEventHandler`, `getQuery`, `setResponseStatus` from `h3`. Always add explicit imports in OG route files.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars must be set in Vercel project (use `vercel env add NAME --value "..." --no-sensitive --yes`)

# Party System — `worker/src/commands/party.js`

Duo/Trio party system. Players form parties via a persistent embed, get a private VC in the matchmaking category, and queue together.

**Setup:** Admin runs `/party-setup` in a channel → creates embed with [Create Duo] [Create Trio] buttons. Anyone can click to form a party.

**Flow:**
1. Click Duo/Trio → UserSelect dropdown appears (native Discord member search)
2. Select members → Bot creates VC in matchmaking category, moves members in
3. `/host` scans all VCs in matchmaking category → party members kept together on same team → solo players from queue VC fill rest → party VCs deleted after match

**Database tables:** `parties` (id, guild_id, leader_id, members, channel_id, status), `party_setup` (guild_id, channel_id, message_id)
**Secrets:** `PARTY_CATEGORY_ID` = matchmaking category ID containing queue VC + party VCs

**Queue check:** Party creation requires all members (leader + selected) to be in the queue VC first. Verified via `GET /channels/{queueId}/members`.

# `/host` team embed

`createMatch` in `host.js` returns an `embed` object with ATK/DEF team fields (color `#f97316`). `runMatch` passes it as `[embed]` to `editInteraction` via the 5th param.

# OG image caching

`Date.now()` is used as cache-buster (`?cb=...`) in OG image URLs in `leaderboard.js` and `stats.js`. This forces Discord to re-fetch the image on every command invocation, showing live data.
