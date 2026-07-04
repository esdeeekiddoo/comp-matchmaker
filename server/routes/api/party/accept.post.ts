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
  const { partyId } = body;
  const guildId = body.guildId || process.env.DISCORD_GUILD_ID;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!partyId || !url || !key) {
    return { ok: false, error: "Missing required fields" };
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  try {
    const inviteRes = await fetch(
      `${url}/rest/v1/party_invites?party_id=eq.${partyId}&to_user_id=eq.${session.user_id}&status=eq.pending&select=*`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const invites = await inviteRes.json();
    const invite = Array.isArray(invites) ? invites[0] : null;

    if (!invite) {
      return { ok: false, error: "No pending invite found" };
    }

    const createdAt = new Date(invite.created_at).getTime();
    if (Date.now() - createdAt > 60000) {
      await fetch(`${url}/rest/v1/party_invites?id=eq.${invite.id}`, { method: "DELETE", headers }).catch(() => {});
      return { ok: false, error: "Invite expired" };
    }

    const targetPartyRes = await fetch(
      `${url}/rest/v1/parties?guild_id=eq.${guildId}&status=eq.active&select=*`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const allParties = await targetPartyRes.json();
    const alreadyInParty = (Array.isArray(allParties) ? allParties : []).some(
      (p: any) => p.leader_id === session.user_id || p.members?.includes(session.user_id),
    );
    if (alreadyInParty) {
      return { ok: false, error: "Already in a party" };
    }

    const partyRes = await fetch(
      `${url}/rest/v1/parties?id=eq.${partyId}&select=*`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    const partyData = await partyRes.json();
    const party = Array.isArray(partyData) ? partyData[0] : null;
    if (!party) {
      return { ok: false, error: "Party not found" };
    }

    const updatedMembers = [...(party.members || []), session.user_id];
    await fetch(`${url}/rest/v1/parties?id=eq.${partyId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ members: updatedMembers }),
    });

    await fetch(`${url}/rest/v1/party_invites?id=eq.${invite.id}`, { method: "DELETE", headers }).catch(() => {});

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

    return { ok: true, party: { ...party, members: updatedMembers } };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to accept invite" };
  }
});
