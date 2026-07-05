import { supabase } from "./supabase";

export type PlayerRow = {
  discord_id: string;
  username: string | null;
  avatar_url: string | null;
  elo: number;
  wins: number;
  losses: number;
};

export type MatchRow = {
  id: string;
  guild_id: string;
  region: string;
  match_number: number;
  host_id: string;
  atk_team: string[];
  def_team: string[];
  selected_map: string | null;
  status: string;
  winner: string | null;
  elo_changes: Record<string, number> | null;
  category_id: string | null;
  atk_channel_id: string | null;
  def_channel_id: string | null;
  host_chat_channel_id: string | null;
  created_at: string;
  bans: string[] | null;
  banners: Record<string, string> | null;
  ban_deadline: string | null;
};

export type BanMatchRow = MatchRow & {
  bans: string[];
  banners: Record<string, string>;
  ban_deadline: string;
};

export async function getPlayers(guildId?: string): Promise<PlayerRow[]> {
  if (guildId) {
    const { data } = await supabase
      .from("guild_players")
      .select("discord_id, elo, wins, losses")
      .eq("guild_id", guildId)
      .order("elo", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as any[];
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.discord_id);
    const { data: playerData } = await supabase
      .from("players")
      .select("discord_id, username, avatar_url")
      .in("discord_id", ids);
    const playerMap: Record<string, any> = {};
    for (const p of playerData ?? []) playerMap[p.discord_id] = p;
    return rows.map((r) => ({
      discord_id: r.discord_id,
      username: playerMap[r.discord_id]?.username ?? null,
      avatar_url: playerMap[r.discord_id]?.avatar_url ?? null,
      elo: r.elo,
      wins: r.wins,
      losses: r.losses,
    }));
  }
  const { data } = await supabase
    .from("players")
    .select("discord_id, username, avatar_url, elo, wins, losses")
    .order("elo", { ascending: false });
  return (data ?? []) as PlayerRow[];
}

export async function getPlayerByUsername(username: string): Promise<PlayerRow | null> {
  const { data } = await supabase
    .from("players")
    .select("discord_id, username, avatar_url, elo, wins, losses")
    .eq("username", username)
    .single();
  return data as PlayerRow | null;
}

export type EloHistoryRow = {
  id: string;
  discord_id: string;
  elo: number;
  match_id: string;
  created_at: string;
};

export async function getEloHistory(discordId: string): Promise<EloHistoryRow[]> {
  const { data } = await supabase
    .from("elo_history")
    .select("id, discord_id, elo, match_id, created_at")
    .eq("discord_id", discordId)
    .order("created_at", { ascending: true });
  return (data ?? []) as EloHistoryRow[];
}

export async function getPlayersByIds(ids: string[]): Promise<PlayerRow[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("players")
    .select("discord_id, username, avatar_url, elo, wins, losses")
    .in("discord_id", ids);
  const found = (data ?? []) as PlayerRow[];
  // Fill in any missing IDs with placeholder entries
  const foundIds = new Set(found.map(r => r.discord_id));
  for (const id of ids) {
    if (!foundIds.has(id)) {
      found.push({ discord_id: id, username: null, avatar_url: null, elo: 0, wins: 0, losses: 0 });
    }
  }
  return found;
}

export type PeriodPlayerRow = PlayerRow & {
  elo_gained: number;
  period_matches: number;
  period_wins: number;
  period_losses: number;
};

export async function getPeriodLeaderboard(days: number, guildId?: string): Promise<PeriodPlayerRow[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  let query = supabase
    .from("matches")
    .select("elo_changes, winner, atk_team, def_team, guild_id")
    .eq("status", "ended")
    .gte("created_at", since);
  if (guildId) query = query.eq("guild_id", guildId);
  const { data } = await query;

  if (!data || data.length === 0) return [];

  const eloMap: Record<string, number> = {};
  const matchMap: Record<string, number> = {};
  const winMap: Record<string, number> = {};
  const lossMap: Record<string, number> = {};

  for (const match of data) {
    if (!match.elo_changes) continue;
    const atk: string[] = match.atk_team ?? [];
    const def: string[] = match.def_team ?? [];
    for (const id of Object.keys(match.elo_changes)) {
      eloMap[id] = (eloMap[id] || 0) + (match.elo_changes[id] ?? 0);
      matchMap[id] = (matchMap[id] || 0) + 1;
      if (match.winner === "atk") {
        if (atk.includes(id)) winMap[id] = (winMap[id] || 0) + 1;
        else lossMap[id] = (lossMap[id] || 0) + 1;
      } else if (match.winner === "def") {
        if (def.includes(id)) winMap[id] = (winMap[id] || 0) + 1;
        else lossMap[id] = (lossMap[id] || 0) + 1;
      }
    }
  }

  const ids = Object.keys(eloMap);
  if (ids.length === 0) return [];

  const { data: players } = await supabase
    .from("players")
    .select("discord_id, username, avatar_url, elo, wins, losses")
    .in("discord_id", ids);

  return ((players ?? []) as PlayerRow[])
    .map((p) => ({
      ...p,
      elo_gained: eloMap[p.discord_id] || 0,
      period_matches: matchMap[p.discord_id] || 0,
      period_wins: winMap[p.discord_id] || 0,
      period_losses: lossMap[p.discord_id] || 0,
    }))
    .sort((a, b) => b.elo_gained - a.elo_gained);
}

export async function getRecentMatches(limit = 5, guildId?: string): Promise<MatchRow[]> {
  let query = supabase
    .from("matches")
    .select("id, guild_id, region, match_number, atk_team, def_team, selected_map, winner, elo_changes, created_at")
    .eq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (guildId) query = query.eq("guild_id", guildId);
  const { data } = await query;
  return (data ?? []) as MatchRow[];
}

export function avatarUrl(row: { discord_id?: string; user_id?: string; avatar_url?: string | null }): string {
  const id = row.discord_id || row.user_id || "";
  const hash = row.avatar_url;
  if (hash) {
    if (hash.startsWith("http")) return hash;
    return `https://cdn.discordapp.com/avatars/${id}/${hash}.png`;
  }
  return `https://cdn.discordapp.com/embed/avatars/${Number(id) % 5}.png`;
}

export async function getPlayerByDiscordId(discordId: string, guildId?: string): Promise<PlayerRow | null> {
  if (guildId) {
    const { data } = await supabase
      .from("guild_players")
      .select("discord_id, elo, wins, losses")
      .eq("discord_id", discordId)
      .eq("guild_id", guildId)
      .single();
    if (data) return data as PlayerRow;
  }
  const { data } = await supabase
    .from("players")
    .select("discord_id, username, avatar_url, elo, wins, losses")
    .eq("discord_id", discordId)
    .single();
  return data as PlayerRow | null;
}

export async function getPlayerMatches(discordId: string, limit = 10, guildId?: string): Promise<MatchRow[]> {
  let query = supabase
    .from("matches")
    .select("id, guild_id, region, match_number, atk_team, def_team, selected_map, winner, elo_changes, created_at")
    .eq("status", "ended")
    .or(`atk_team.cs.{"${discordId}"},def_team.cs.{"${discordId}"}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (guildId) query = query.eq("guild_id", guildId);
  const { data } = await query;
  return (data ?? []) as MatchRow[];
}

export async function getActiveMatchForUser(userId: string, guildId?: string): Promise<BanMatchRow | null> {
  let query = supabase
    .from("matches")
    .select("id, match_number, region, atk_team, def_team, selected_map, status, bans, banners, ban_deadline, created_at")
    .eq("status", "active")
    .or(`atk_team.cs.{"${userId}"},def_team.cs.{"${userId}"}`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (guildId) query = query.eq("guild_id", guildId);
  const { data } = await query;
  if (!data || data.length === 0) return null;
  const match = data[0] as any;
  // Parse banners if stored as TEXT (JSON string) instead of JSONB
  if (typeof match.banners === "string") {
    try { match.banners = JSON.parse(match.banners); } catch { match.banners = {}; }
  }
  if (typeof match.bans === "string") {
    try { match.bans = JSON.parse(match.bans); } catch { match.bans = []; }
  }
  return match as BanMatchRow | null;
}

export async function submitBan(matchId: string, userId: string, mapName: string) {
  const res = await fetch("/api/match/ban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, matchId, mapName }),
  });
  return res.json();
}
