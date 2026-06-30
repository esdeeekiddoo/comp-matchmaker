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
  const { partyId, targetUserId, targetUsername } = body;
  const guildId = body.guildId || process.env.DISCORD_GUILD_ID;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!partyId || !targetUserId || !url || !key) {
    setResponseStatus(event, 400);
    return { ok: false, error: "Missing required fields" };
  }

  if (targetUserId === session.user_id) {
    setResponseStatus(event, 400);
    return { ok: false, error: "Cannot invite yourself" };
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  try {
    // Verify party exists and caller is leader
    const partyRes = await fetch(
      `${url}/rest/v1/parties?guild_id=eq.${guildId}&id=eq.${partyId}&status=eq.active&select=*`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const parties = await partyRes.json();
    const party = Array.isArray(parties) ? parties[0] : null;
    if (!party || party.leader_id !== session.user_id) {
      setResponseStatus(event, 403);
      return { ok: false, error: "Not your party" };
    }

    // Check party size limit (3 max = leader + 2)
    const currentSize = 1 + (party.members?.length || 0);
    if (currentSize >= 3) {
      setResponseStatus(event, 400);
      return { ok: false, error: "Party is full" };
    }

    // Check target isn't already in a party
    const targetPartyRes = await fetch(
      `${url}/rest/v1/parties?guild_id=eq.${guildId}&status=eq.active&select=*`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const allParties = await targetPartyRes.json();
    const targetInParty = (Array.isArray(allParties) ? allParties : []).some(
      (p: any) => p.leader_id === targetUserId || p.members?.includes(targetUserId),
    );
    if (targetInParty) {
      setResponseStatus(event, 409);
      return { ok: false, error: "Target is already in a party" };
    }

    // Check existing pending invite
    const existingInviteRes = await fetch(
      `${url}/rest/v1/party_invites?party_id=eq.${partyId}&to_user_id=eq.${targetUserId}&status=eq.pending&select=id`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const existingInvites = await existingInviteRes.json();
    if (Array.isArray(existingInvites) && existingInvites.length > 0) {
      setResponseStatus(event, 409);
      return { ok: false, error: "Invite already sent" };
    }

    // Create invite
    await fetch(`${url}/rest/v1/party_invites`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        party_id: partyId,
        from_user_id: session.user_id,
        from_username: session.username,
        to_user_id: targetUserId,
        status: "pending",
      }),
    });

    return { ok: true };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { ok: false, error: err?.message || "Failed to send invite" };
  }
});
