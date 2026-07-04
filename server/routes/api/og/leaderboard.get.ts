import { ImageResponse } from "@vercel/og";
import { defineEventHandler, getQuery, setResponseStatus } from "h3";

const MEDALS = ["🥇", "🥈", "🥉"];

function h(type: string, props: Record<string, any>, ...children: any[]) {
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}

const BG = "#1c1f26";
const SURFACE = "#262a33";
const ELEVATED = "#303541";
const BORDER = "#363b48";
const FG = "#f2f4f7";
const MUTED = "#8b95a5";
const ORANGE = "#f97316";

function getAvatarUrl(p: any): string {
  const hash = p.avatar_url;
  if (!hash) return `https://cdn.discordapp.com/embed/avatars/${Number(p.discord_id) % 5}.png`;
  if (hash.startsWith("http")) return hash;
  return `https://cdn.discordapp.com/avatars/${p.discord_id}/${hash}.png?size=32`;
}

function playerRow(index: number, p: any) {
  const rankLabel = index < 3 ? MEDALS[index] : `#${index + 1}`;
  const name = (p.username ?? p.discord_id).length > 20
    ? (p.username ?? p.discord_id).slice(0, 18) + "…"
    : (p.username ?? p.discord_id);
  const bg = index % 2 === 0 ? ELEVATED : "transparent";
  const avatarSrc = getAvatarUrl(p);

  return h("div", {
    style: {
      display: "flex", alignItems: "center", padding: "8px 16px",
      backgroundColor: bg, borderRadius: 6, gap: 12,
    }
  },
    h("span", { style: { color: index < 3 ? FG : MUTED, fontSize: 15, fontWeight: 700, width: 32, textAlign: "center" } }, rankLabel),
    h("img", { src: avatarSrc, style: { width: 24, height: 24, borderRadius: 12, border: "1px solid #363b48" } }),
    h("span", { style: { flex: 1, color: FG, fontSize: 14, fontWeight: 600 } }, name),
    h("span", { style: { color: ORANGE, fontSize: 16, fontWeight: 800, width: 56, textAlign: "right" } }, String(p.elo)),
    h("span", { style: { color: MUTED, fontSize: 12, fontWeight: 500, width: 76, textAlign: "right" } }, `${p.wins}W ${p.losses}L`),
  );
}

function colHeader(label: string, width: number | string, align?: string) {
  return h("span", {
    style: {
      color: MUTED, fontSize: 10, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: 1, width, textAlign: align as any || "left",
    }
  }, label);
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = query.guildId as string | undefined;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) { setResponseStatus(event, 500); return { error: "Supabase env missing" }; }

  try {
    let players: any[];
    if (guildId) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/guild_players?guild_id=eq.${guildId}&select=discord_id,elo,wins,losses&order=elo.desc&limit=10`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      const guildRows = await res.json();
      if (!Array.isArray(guildRows) || guildRows.length === 0) { setResponseStatus(event, 404); return { error: "No players found" }; }
      const ids = guildRows.map((r: any) => r.discord_id);
      const userRes = await fetch(
        `${supabaseUrl}/rest/v1/players?select=discord_id,username,avatar_url&discord_id=in.(${ids.join(',')})`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: "application/json" } }
      );
      const userRows = await userRes.json();
      const userMap: Record<string, any> = {};
      for (const u of Array.isArray(userRows) ? userRows : []) userMap[u.discord_id] = u;
      players = guildRows.map((r: any) => ({
        discord_id: r.discord_id,
        username: userMap[r.discord_id]?.username ?? null,
        avatar_url: userMap[r.discord_id]?.avatar_url ?? null,
        elo: r.elo,
        wins: r.wins,
        losses: r.losses,
      }));
    } else {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/players?select=discord_id,username,avatar_url,elo,wins,losses&order=elo.desc&limit=10`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      players = await res.json();
    }

    if (!Array.isArray(players) || players.length === 0) {
      setResponseStatus(event, 404);
      return { error: "No players found" };
    }

    const [inter400, inter700, russoOne] = await Promise.all([
      fetch("https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff").then(r => r.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-700-normal.woff").then(r => r.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/npm/@fontsource/russo-one@5/files/russo-one-latin-400-normal.woff").then(r => r.arrayBuffer()),
    ]);

    const rowCount = players.length;
    const rowHeight = 48;
    const headerHeight = 100;
    const columnHeaderHeight = 34;
    const footerHeight = 44;
    const totalHeight = headerHeight + columnHeaderHeight + rowCount * rowHeight + footerHeight;
    const gameTitle = "APL";
    const gameSubtitle = "Asia Premiere League";

    const element = h("div", {
      style: {
        display: "flex", flexDirection: "column", width: "100%", height: "100%",
        backgroundColor: BG, fontFamily: "Inter", borderRadius: 12, overflow: "hidden",
      }
    },
      h("div", {
        style: {
          height: headerHeight,
          background: "linear-gradient(135deg, rgba(249,115,22,0.3), rgba(249,115,22,0.03))",
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 2,
        }
      },
        h("span", { style: { color: FG, fontSize: 30, fontFamily: "Russo One" } }, "🏆 Leaderboard"),
        h("span", { style: { color: MUTED, fontSize: 12, fontWeight: 500 } }, "Top 10 Players — Season 1"),
      ),
      h("div", { style: { display: "flex", flexDirection: "column", padding: "10px 16px", gap: 2, flex: 1 } },
        h("div", { style: { display: "flex", alignItems: "center", padding: "6px 16px", gap: 12, borderBottom: `1px solid ${BORDER}`, marginBottom: 4 } },
          colHeader("#", 32, "center"),
          h("span", { style: { width: 24 } }),
          colHeader("Player", "1fr"),
          colHeader("ELO", 56, "right"),
          colHeader("Record", 76, "right"),
        ),
        ...players.map((p: any, i: number) => playerRow(i, p)),
      ),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", gap: 1, borderTop: `1px solid ${BORDER}` } },
        h("span", { style: { color: MUTED, fontSize: 11, fontFamily: "Russo One" } }, gameTitle),
        h("span", { style: { color: MUTED, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2 } }, gameSubtitle),
      ),
    );

    return new ImageResponse(element as any, {
      width: 600,
      height: Math.max(380, totalHeight),
      fonts: [
        { name: "Inter", data: inter400, weight: 400, style: "normal" },
        { name: "Inter", data: inter700, weight: 700, style: "normal" },
        { name: "Russo One", data: russoOne, weight: 400, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
    });
  } catch (err: any) {
    console.error("OG leaderboard error:", err);
    setResponseStatus(event, 500);
    return { error: err.message ?? "Internal error" };
  }
});
