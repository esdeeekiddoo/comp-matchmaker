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

    const isLeader = party.leader_id === session.user_id;
    const isMember = party.members?.includes(session.user_id);

    if (!isLeader && !isMember) {
      setResponseStatus(event, 403);
      return { ok: false, error: "Not in this party" };
    }

    if (isLeader) {
      // Disband: remove all members from queue, delete party
      const allIds = [party.leader_id, ...(party.members || [])];
      for (const uid of allIds) {
        await fetch(
          `${url}/rest/v1/web_queue?guild_id=eq.${guildId}&user_id=eq.${uid}`,
          { method: "DELETE", headers },
        ).catch(() => {});
      }
      await fetch(
        `${url}/rest/v1/parties?id=eq.${partyId}`,
        { method: "DELETE", headers },
      );
      await fetch(
        `${url}/rest/v1/party_invites?party_id=eq.${partyId}`,
        { method: "DELETE", headers },
      ).catch(() => {});
      return { ok: true, disbanded: true };
    }

    // Member leaving: remove self from party + queue
    const updatedMembers = (party.members || []).filter((id: string) => id !== session.user_id);
    await fetch(
      `${url}/rest/v1/web_queue?guild_id=eq.${guildId}&user_id=eq.${session.user_id}`,
      { method: "DELETE", headers },
    ).catch(() => {});

    if (updatedMembers.length === 0) {
      // No members left — delete party
      await fetch(
        `${url}/rest/v1/parties?id=eq.${partyId}`,
        { method: "DELETE", headers },
      );
    } else {
      await fetch(`${url}/rest/v1/parties?id=eq.${partyId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ members: updatedMembers }),
      });
    }

    return { ok: true, disbanded: false };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { ok: false, error: err?.message || "Failed to leave party" };
  }
});
