import { defineEventHandler, getQuery, setResponseStatus } from "h3";

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

  const guildId = (getQuery(event).guildId as string) || process.env.DISCORD_GUILD_ID;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !guildId) {
    return { ok: false, party: null, invites: [] };
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };

  try {
    const [partyRes, invitesRes] = await Promise.all([
      fetch(`${url}/rest/v1/parties?guild_id=eq.${guildId}&status=eq.active&select=*`, { headers }),
      fetch(`${url}/rest/v1/party_invites?to_user_id=eq.${session.user_id}&status=eq.pending&select=*&order=created_at.desc`, { headers }),
    ]);

    const parties = await partyRes.json();
    const invites = await invitesRes.json();

    const party = (Array.isArray(parties) ? parties : []).find(
      (p: any) => p.leader_id === session.user_id || p.members?.includes(session.user_id),
    ) || null;

    return { ok: true, party, invites: Array.isArray(invites) ? invites : [] };
  } catch {
    return { ok: false, party: null, invites: [] };
  }
});
