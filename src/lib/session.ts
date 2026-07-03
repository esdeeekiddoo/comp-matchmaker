export type Session = {
  user_id: string;
  username: string;
  avatar_url: string;
  guild_ids: { id: string; name: string; game_name?: string }[];
};

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function parseSession(): Session | null {
  if (typeof window === "undefined") return null;
  const cookie = getCookie("capl_session");
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export function getActiveGuildId(session: Session | null): string | null {
  if (!session || !session.guild_ids || session.guild_ids.length === 0) return null;
  const stored = getCookie("active_guild_id");
  if (stored && session.guild_ids.some((g) => g.id === stored)) return stored;
  return session.guild_ids[0].id;
}

export function setActiveGuildId(guildId: string) {
  document.cookie = `active_guild_id=${guildId}; Path=/; Max-Age=86400; SameSite=Lax`;
}
