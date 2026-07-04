import { defineEventHandler, readBody } from "h3";

function parseSession(event: any): { user_id: string; username: string; avatar_url: string } | null {
  const cookie = getCookie(event, "capl_session");
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length < 2) return null;
  try {
    const decoded = atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getCookie(event: any, name: string): string | null {
  const cookie = event.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;)\\s*${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default defineEventHandler(async (event) => {
  const session = parseSession(event);
  if (!session) {
    return { ok: false, error: "Not logged in" };
  }

  const body = await readBody(event).catch(() => ({}));
  const guildId = body.guildId || process.env.DISCORD_GUILD_ID;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key || !guildId) {
    return { ok: false, error: "Config missing" };
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  try {
    const [existingParties, matchesRes] = await Promise.all([
      fetch(`${url}/rest/v1/parties?guild_id=eq.${guildId}&status=eq.active&select=*`, { headers: { ...headers, Accept: "application/json" } }),
      fetch(`${url}/rest/v1/matches?select=atk_team,def_team,status&status=eq.active&guild_id=eq.${guildId}`, { headers: { ...headers, Accept: "application/json" } }),
    ]);

    const parties = await existingParties.json();
    const existing = (Array.isArray(parties) ? parties : []).find(
      (p: any) => p.leader_id === session.user_id || p.members?.includes(session.user_id),
    );
    if (existing) {
      return { ok: false, error: "Already in a party" };
    }

    const matches = await matchesRes.json();
    if (Array.isArray(matches) && matches.some((m: any) =>
      (m.atk_team || []).includes(session.user_id) || (m.def_team || []).includes(session.user_id),
    )) {
      return { ok: false, error: "Already in an active match" };
    }

    const createRes = await fetch(`${url}/rest/v1/parties`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        guild_id: guildId,
        leader_id: session.user_id,
        members: [],
        channel_id: "",
        status: "active",
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text().catch(() => "");
      return { ok: false, error: `Failed to create party: ${createRes.status} ${errBody}` };
    }

    const partyData = await createRes.json();
    const party = Array.isArray(partyData) ? partyData[0] : partyData;

    const now = new Date().toISOString();
    const banRes = await fetch(
      `${url}/rest/v1/queue_bans?guild_id=eq.${guildId}&discord_id=eq.${session.user_id}&expires_at=gt.${now}&select=id`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const bans = await banRes.json();
    if (Array.isArray(bans) && bans.length > 0) {
      return { ok: false, error: "You are banned from the queue." };
    }

    await fetch(`${url}/rest/v1/web_queue`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        guild_id: guildId,
        user_id: session.user_id,
        username: session.username,
        avatar_url: session.avatar_url,
      }),
    }).catch(() => {});

    return { ok: true, party };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to create party" };
  }
});
