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
