import { defineEventHandler, readBody, setResponseStatus } from "h3";

const MAPS = ["Mirage", "Dust", "Inferno", "Cache", "Nuke", "Overpass", "Train"];

async function notifyDiscord(match: any, picked: string): Promise<{ notified: boolean; error?: string }> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) { console.log("[notifyDiscord] DISCORD_TOKEN not set"); return { notified: false, error: "DISCORD_TOKEN not set in env" }; }
  if (!match.host_chat_channel_id) { console.log("[notifyDiscord] host_chat_channel_id missing"); return { notified: false, error: "host_chat_channel_id is null in match row" }; }
  const embed = {
    color: 0xf97316,
    title: `Match #${match.match_number} — Map Selected`,
    fields: [
      { name: "🗺️ Map", value: picked, inline: false },
    ],
  };
  try {
    console.log(`[notifyDiscord] sending to channel ${match.host_chat_channel_id}`);
    const res = await fetch(
      `https://discord.com/api/v10/channels/${match.host_chat_channel_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed] }),
      },
    );
    const body = await res.text();
    console.log(`[notifyDiscord] response ${res.status}: ${body}`);
    if (!res.ok) return { notified: false, error: `Discord API ${res.status}: ${body}` };
    return { notified: true };
  } catch (err: any) {
    console.error("[notifyDiscord] error:", err);
    return { notified: false, error: err?.message || String(err) };
  }
}

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
    console.log(`[ban] request: userId=${userId}, matchId=${matchId}, mapName=${mapName}`);
    const matchRes = await fetch(
      `${url}/rest/v1/matches?id=eq.${matchId}&select=bans,banners,selected_map,atk_team,def_team,host_chat_channel_id,match_number,region`,
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

    const currentBans: string[] = match.bans || [];
    const banners = match.banners || {};

    if (currentBans.includes(mapName)) {
      return { ok: false, error: "Map already banned" };
    }
    if (!MAPS.includes(mapName) && mapName !== "__auto__") {
      return { ok: false, error: "Invalid map name" };
    }

    if (mapName !== "__auto__") {
      if (banners.atk !== userId && banners.def !== userId) {
        console.log(`[ban] user ${userId} is not a banner (atk=${banners.atk}, def=${banners.def})`);
        setResponseStatus(event, 403);
        return { ok: false, error: "You are not a designated banner" };
      }

      const atkTurn = currentBans.length % 2 === 0;
      if (atkTurn && banners.atk !== userId) {
        return { ok: false, error: "It's ATK's turn to ban" };
      }
      if (!atkTurn && banners.def !== userId) {
        return { ok: false, error: "It's DEF's turn to ban" };
      }
    }

    const newBans = mapName === "__auto__" ? currentBans : [...currentBans, mapName];
    const remaining = MAPS.filter((m) => !newBans.includes(m));

    let selectedMap: string | null = null;
    if (mapName === "__auto__" && remaining.length > 0) {
      selectedMap = remaining[Math.floor(Math.random() * remaining.length)];
    } else if (newBans.length >= 4 && remaining.length > 0) {
      selectedMap = remaining[Math.floor(Math.random() * remaining.length)];
    }

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

    let notifyResult = { notified: false, error: "not called" };
    if (selectedMap) notifyResult = await notifyDiscord(match, selectedMap);
    return { ok: true, bans: newBans, selected_map: selectedMap, discord: notifyResult };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { ok: false, error: err?.message || "Failed to submit ban" };
  }
});
