import { defineEventHandler, getQuery } from "h3";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = (query.guildId as string) || process.env.DISCORD_GUILD_ID;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key || !guildId) {
    return { players: [] };
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/players?select=discord_id,username,avatar_url&order=username.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" } },
    );
    const rows = await res.json();
    return { players: Array.isArray(rows) ? rows : [] };
  } catch {
    return { players: [] };
  }
});
