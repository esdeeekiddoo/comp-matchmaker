import { defineEventHandler, readBody, setResponseStatus } from "h3";

const MAPS = ["Mirage", "Dust", "Inferno", "Cache", "Nuke", "Overpass", "Train"];

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const { userId, matchId, mapName } = body;

  if (!userId || !matchId || !mapName) {
    setResponseStatus(event, 400);
    return { ok: false, error: "Missing userId, matchId, or mapName" };
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    setResponseStatus(event, 500);
    return { ok: false, error: "Supabase env missing" };
  }

  try {
    // Fetch current match
    const matchRes = await fetch(
      `${url}/rest/v1/matches?id=eq.${matchId}&select=bans,banners,selected_map,atk_team,def_team`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    const matches = await matchRes.json();
    const match = Array.isArray(matches) ? matches[0] : matches;
    if (!match) {
      setResponseStatus(event, 404);
      return { ok: false, error: "Match not found" };
    }
    if (match.selected_map) {
      return { ok: false, error: "Map already selected" };
    }

    // Check user is a designated banner
    const banners = match.banners || {};
    if (banners.atk !== userId && banners.def !== userId) {
      setResponseStatus(event, 403);
      return { ok: false, error: "You are not a designated banner" };
    }

    // Check map not already banned
    const bans: string[] = match.bans || [];
    if (bans.includes(mapName)) {
      return { ok: false, error: "Map already banned" };
    }
    if (!MAPS.includes(mapName)) {
      return { ok: false, error: "Invalid map name" };
    }

    // Check deadline hasn't passed — if expired, auto-pick from remaining
    const expired = match.ban_deadline && new Date(match.ban_deadline).getTime() < Date.now();
    const bannedList: string[] = match.bans || [];

    if (expired) {
      const remaining = MAPS.filter((m) => !bannedList.includes(m));
      const picked = remaining[Math.floor(Math.random() * remaining.length)] || MAPS[0];
      await fetch(`${url}/rest/v1/matches?id=eq.${matchId}`, {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selected_map: picked, bans: null, banners: null, ban_deadline: null }),
      });
      return { ok: true, bans: bannedList, selected_map: picked };
    }

    // Check map not already banned
    const bans: string[] = match.bans || [];
    if (bans.includes(mapName)) {
      return { ok: false, error: "Map already banned" };
    }
    if (!MAPS.includes(mapName)) {
      return { ok: false, error: "Invalid map name" };
    }

    const newBans = [...bans, mapName];
    const remaining = MAPS.filter((m) => !newBans.includes(m));

    // If 2 bans are in, auto-pick the map
    let selectedMap: string | null = null;
    if (newBans.length >= 2 && remaining.length > 0) {
      selectedMap = remaining[Math.floor(Math.random() * remaining.length)];
    }

    // Update match
    const updateBody: any = { bans: newBans };
    if (selectedMap) {
      updateBody.selected_map = selectedMap;
      updateBody.banners = null;
      updateBody.ban_deadline = null;
    }

    await fetch(`${url}/rest/v1/matches?id=eq.${matchId}`, {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateBody),
    });

    return { ok: true, bans: newBans, selected_map: selectedMap };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { ok: false, error: err?.message || "Failed to submit ban" };
  }
});
