import { defineEventHandler, readBody, setResponseStatus } from "h3";

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
    setResponseStatus(event, 401);
    return { ok: false, error: "Not logged in" };
  }

  const body = await readBody(event).catch(() => ({}));
  const guildId = body.guildId || process.env.DISCORD_GUILD_ID;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key || !guildId) {
    setResponseStatus(event, 500);
    return { ok: false, error: "Config missing" };
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  try {
    // Check if already in a party or active match
    const [existingParties, matchesRes] = await Promise.all([
      fetch(`${url}/rest/v1/parties?guild_id=eq.${guildId}&status=eq.active&select=*`, { headers: { ...headers, Accept: "application/json" } }),
      fetch(`${url}/rest/v1/matches?select=atk_team,def_team,status&status=eq.active&guild_id=eq.${guildId}`, { headers: { ...headers, Accept: "application/json" } }),
    ]);

    const parties = await existingParties.json();
    const existing = (Array.isArray(parties) ? parties : []).find(
      (p: any) => p.leader_id === session.user_id || p.members?.includes(session.user_id),
    );
    if (existing) {
      setResponseStatus(event, 409);
      return { ok: false, error: "Already in a party" };
    }

    const matches = await matchesRes.json();
    if (Array.isArray(matches) && matches.some((m: any) =>
      (m.atk_team || []).includes(session.user_id) || (m.def_team || []).includes(session.user_id),
    )) {
      setResponseStatus(event, 409);
      return { ok: false, error: "Already in an active match" };
    }

    // Create party
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
      setResponseStatus(event, 500);
      return { ok: false, error: "Failed to create party" };
    }

    const party = await createRes.json();

    // Auto-queue the leader
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

    return { ok: true, party: Array.isArray(party) ? party[0] : party };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { ok: false, error: err?.message || "Failed to create party" };
  }
});
