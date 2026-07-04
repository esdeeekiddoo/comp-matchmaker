import { defineEventHandler, getQuery, setResponseStatus } from "h3";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.userId as string;
  const guildId = query.guildId as string;

  if (!userId || !guildId) {
    setResponseStatus(event, 400);
    return { ok: false, error: "Missing userId or guildId" };
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    setResponseStatus(event, 500);
    return { ok: false, error: "Supabase env missing" };
  }

  try {
    const now = new Date().toISOString();
    const res = await fetch(
      `${url}/rest/v1/queue_bans?guild_id=eq.${guildId}&discord_id=eq.${userId}&expires_at=gt.${now}&select=expires_at,reason`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    const bans = await res.json();
    if (Array.isArray(bans) && bans.length > 0) {
      return { banned: true, expires_at: bans[0].expires_at, reason: bans[0].reason };
    }
    return { banned: false };
  } catch {
    return { banned: false };
  }
});
