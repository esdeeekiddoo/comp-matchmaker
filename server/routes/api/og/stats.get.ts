import { ImageResponse } from "@vercel/og";
import { defineEventHandler, getQuery, setResponseStatus } from "h3";

const RANKS = [
  { name: "Master", min: 7400, color: "#f97316" },
  { name: "Sovereign II", min: 6700, color: "#dc2626" },
  { name: "Sovereign I", min: 6000, color: "#ef4444" },
  { name: "Dominator II", min: 5000, color: "#7c3aed" },
  { name: "Dominator I", min: 4500, color: "#8b5cf6" },
  { name: "Platinum III", min: 2950, color: "#0f766e" },
  { name: "Platinum II", min: 2600, color: "#0d9488" },
  { name: "Platinum I", min: 2250, color: "#14b8a6" },
  { name: "Gold III", min: 1950, color: "#b45309" },
  { name: "Gold II", min: 1650, color: "#d97706" },
  { name: "Gold I", min: 1350, color: "#f59e0b" },
  { name: "Silver III", min: 1100, color: "#9ca3af" },
  { name: "Silver II", min: 850, color: "#b0b5ba" },
  { name: "Silver I", min: 600, color: "#c4c8cc" },
  { name: "Bronze III", min: 400, color: "#b8662a" },
  { name: "Bronze II", min: 200, color: "#c4722e" },
  { name: "Bronze I", min: 0, color: "#cd7f32" },
];

function getRank(elo: number) {
  for (const r of RANKS) if (elo >= r.min) return r;
  return RANKS[RANKS.length - 1];
}

function formatTrend(history: { elo: number }[]) {
  if (!history || history.length < 2) return "—";
  const diff = history[history.length - 1].elo - history[history.length - 2].elo;
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return "0";
}

function h(type: string, props: Record<string, any>, ...children: any[]) {
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}

const BG = "#1c1f26";
const SURFACE = "#262a33";
const FG = "#f2f4f7";
const MUTED = "#8b95a5";
const ORANGE = "#f97316";
const GREEN = "#22c55e";
const RED = "#ef4444";

function statTile(label: string, value: string, color: string) {
  return h("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      backgroundColor: SURFACE, borderRadius: 8, padding: "10px 18px", minWidth: 90,
    }
  },
    h("span", { style: { color: MUTED, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 } }, label),
    h("span", { style: { color, fontSize: 18, fontWeight: 700 } }, value),
  );
}

function buildCard(player: any, history: any[], rank: { name: string; color: string }, guildId?: string) {
  const total = player.wins + player.losses;
  const winPct = total > 0 ? Math.round((player.wins / total) * 100) : 0;
  const name = player.username ?? player.discord_id;
  const trend = formatTrend(history);
  const avatarUrl = player.avatar_url
    ? (player.avatar_url.startsWith("http")
      ? player.avatar_url
      : `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar_url}.png?size=128`)
    : `https://cdn.discordapp.com/embed/avatars/${Number(player.discord_id) % 5}.png`;

  return h("div", {
    style: {
      display: "flex", flexDirection: "column", width: "100%", height: "100%",
      backgroundColor: BG, fontFamily: "Inter", borderRadius: 12, overflow: "hidden",
    }
  },
    h("div", {
      style: {
        height: 100,
        background: "linear-gradient(135deg, rgba(249,115,22,0.35), rgba(249,115,22,0.04))",
        display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: 44,
      }
    },
      h("img", { src: avatarUrl, style: { width: 80, height: 80, borderRadius: 40, border: "3px solid #1c1f26" } })
    ),
    h("div", {
      style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px", marginTop: 4, gap: 2 }
    },
      h("span", { style: { color: FG, fontSize: 22, fontFamily: "Russo One" } }, name),
      h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
        h("span", { style: { width: 8, height: 8, borderRadius: 4, backgroundColor: rank.color, boxShadow: `0 0 6px ${rank.color}` } }),
        h("span", { style: { color: rank.color, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 } }, rank.name),
      ),
      h("span", { style: { color: FG, fontSize: 48, fontFamily: "Russo One", marginTop: 6 } }, String(player.elo)),
    ),
    h("div", { style: { display: "flex", justifyContent: "center", gap: 10, padding: "14px 24px" } },
      statTile("Win Rate", `${winPct}%`, GREEN),
      statTile("W/L", `${player.wins}W ${player.losses}L`, FG),
      statTile("Trend", trend, trend.startsWith("+") ? GREEN : trend.startsWith("-") ? RED : MUTED),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto", padding: "10px 0", gap: 1 } },
      h("span", { style: { color: MUTED, fontSize: 11, fontFamily: "Russo One" } }, "APL"),
      h("span", { style: { color: MUTED, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2 } }, "Asia Premiere League"),
    ),
  );
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.userId as string | undefined;
  const guildId = query.guildId as string | undefined;
  if (!userId) { setResponseStatus(event, 400); return { error: "Missing userId" }; }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) { setResponseStatus(event, 500); return { error: "Supabase env missing" }; }

  try {
    const playerTable = guildId ? "guild_players" : "players";
    const playerFilter = guildId
      ? `discord_id=eq.${userId}&guild_id=eq.${guildId}`
      : `discord_id=eq.${userId}`;
    const playerSelect = guildId
      ? "discord_id,elo,wins,losses"
      : "discord_id,username,avatar_url,elo,wins,losses";

    const [players, history] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/${playerTable}?${playerFilter}&select=${playerSelect}`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: "application/json" },
      }).then(r => { if (!r.ok) throw new Error(`Supabase ${r.status}`); return r.json(); }),
      fetch(`${supabaseUrl}/rest/v1/elo_history?discord_id=eq.${userId}&select=elo&order=created_at.asc&limit=10`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: "application/json" },
      }).then(r => { if (!r.ok) throw new Error(`Supabase ${r.status}`); return r.json(); }),
    ]);

    let player = Array.isArray(players) && players.length > 0 ? players[0] : null;

    if (guildId && !player) {
      player = { discord_id: userId, elo: 0, wins: 0, losses: 0 };
    }

    if (!player) { setResponseStatus(event, 404); return { error: "Player not found" }; }

    if (guildId && !player.username) {
      const userRes = await fetch(`${supabaseUrl}/rest/v1/players?discord_id=eq.${userId}&select=discord_id,username,avatar_url`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: "application/json" },
      }).then(r => r.json());
      const userRow = Array.isArray(userRes) && userRes.length > 0 ? userRes[0] : null;
      player = { ...player, username: userRow?.username ?? null, avatar_url: userRow?.avatar_url ?? null };
    }

    const rank = getRank(player.elo);
    const element = buildCard(player, Array.isArray(history) ? history : [], rank, guildId);

    const [inter400, inter700, russoOne] = await Promise.all([
      fetch("https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff").then(r => r.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-700-normal.woff").then(r => r.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/npm/@fontsource/russo-one@5/files/russo-one-latin-400-normal.woff").then(r => r.arrayBuffer()),
    ]);

    return new ImageResponse(element as any, {
      width: 600,
      height: 420,
      fonts: [
        { name: "Inter", data: inter400, weight: 400, style: "normal" },
        { name: "Inter", data: inter700, weight: 700, style: "normal" },
        { name: "Russo One", data: russoOne, weight: 400, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch (err: any) {
    console.error("OG stats error:", err);
    setResponseStatus(event, 500);
    return { error: err.message ?? "Internal error" };
  }
});
