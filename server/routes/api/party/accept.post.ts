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
  const { partyId } = body;
  const guildId = body.guildId || process.env.DISCORD_GUILD_ID;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!partyId || !url || !key) {
    setResponseStatus(event, 400);
    return { ok: false, error: "Missing required fields" };
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  try {
    // Find pending invite
    const inviteRes = await fetch(
      `${url}/rest/v1/party_invites?party_id=eq.${partyId}&to_user_id=eq.${session.user_id}&status=eq.pending&select=*`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const invites = await inviteRes.json();
    const invite = Array.isArray(invites) ? invites[0] : null;

    if (!invite) {
      setResponseStatus(event, 404);
      return { ok: false, error: "No pending invite found" };
    }

    // Check expiry (60 seconds)
    const createdAt = new Date(invite.created_at).getTime();
    if (Date.now() - createdAt > 60000) {
      await fetch(
        `${url}/rest/v1/party_invites?id=eq.${invite.id}`,
        { method: "DELETE", headers },
      ).catch(() => {});
      setResponseStatus(event, 410);
      return { ok: false, error: "Invite expired" };
    }

    // Check target isn't already in a party
    const targetPartyRes = await fetch(
      `${url}/rest/v1/parties?guild_id=eq.${guildId}&status=eq.active&select=*`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const allParties = await targetPartyRes.json();
    const alreadyInParty = (Array.isArray(allParties) ? allParties : []).some(
      (p: any) => p.leader_id === session.user_id || p.members?.includes(session.user_id),
    );
    if (alreadyInParty) {
      setResponseStatus(event, 409);
      return { ok: false, error: "Already in a party" };
    }

    // Get current party members
    const partyRes = await fetch(
      `${url}/rest/v1/parties?id=eq.${partyId}&select=*`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const partyData = await partyRes.json();
    const party = Array.isArray(partyData) ? partyData[0] : null;
    if (!party) {
      setResponseStatus(event, 404);
      return { ok: false, error: "Party not found" };
    }

    // Add user to party members
    const updatedMembers = [...(party.members || []), session.user_id];
    await fetch(`${url}/rest/v1/parties?id=eq.${partyId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ members: updatedMembers }),
    });

    // Delete the invite
    await fetch(
      `${url}/rest/v1/party_invites?id=eq.${invite.id}`,
      { method: "DELETE", headers },
    ).catch(() => {});

    // Add user to queue
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

    return { ok: true, party: { ...party, members: updatedMembers } };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { ok: false, error: err?.message || "Failed to accept invite" };
  }
});
