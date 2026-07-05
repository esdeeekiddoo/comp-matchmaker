import { defineEventHandler, getQuery } from "h3";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = (query.guildId as string) || process.env.DISCORD_GUILD_ID;
  if (!guildId) return { players: [] };

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { players: [] };

  try {
    const res = await fetch(
      `${url}/rest/v1/web_queue?guild_id=eq.${guildId}&select=user_id,username,avatar_url,joined_at&order=joined_at.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" } },
    );
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return { players: [] };

    const userIds = rows.map((r: any) => r.user_id);
    const eloRes = await fetch(
      `${url}/rest/v1/guild_players?guild_id=eq.${guildId}&discord_id=in.(${userIds.join(",")})&select=discord_id,elo`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" } },
    );
    const eloRows = await eloRes.json();
    const eloMap: Record<string, number> = {};
    if (Array.isArray(eloRows)) {
      for (const e of eloRows) eloMap[e.discord_id] = e.elo;
    }

    const players = rows.map((r: any) => ({
      ...r,
      elo: eloMap[r.user_id] ?? 0,
    }));
    return { players };
  } catch {
    return { players: [] };
  }
});
