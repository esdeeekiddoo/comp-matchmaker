import { defineEventHandler, getQuery, setResponseStatus } from "h3";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = (query.userId || query.user_id) as string;
  const guildId = (query.guildId as string) || process.env.DISCORD_GUILD_ID;

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
    const res = await fetch(
      `${url}/rest/v1/matches?select=id,match_number,region,atk_team,def_team,selected_map,status,bans,banners,ban_deadline,created_at&status=eq.active&selected_map=is.null&guild_id=eq.${guildId}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    const matches = await res.json();
    if (!Array.isArray(matches)) {
      return { ok: true, match: null };
    }

    const myMatch = matches.find((m: any) =>
      (m.atk_team || []).includes(userId) || (m.def_team || []).includes(userId),
    );

    if (!myMatch) {
      return { ok: true, match: null };
    }

    return { ok: true, match: myMatch };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { ok: false, error: err?.message || "Failed to fetch match" };
  }
});
