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

export async function getPlayers(): Promise<PlayerRow[]> {
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
  return (data ?? []) as PlayerRow[];
}

export type PeriodPlayerRow = PlayerRow & {
  elo_gained: number;
  period_matches: number;
  period_wins: number;
  period_losses: number;
};

export async function getPeriodLeaderboard(days: number): Promise<PeriodPlayerRow[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("matches")
    .select("elo_changes, winner, atk_team, def_team")
    .eq("status", "ended")
    .gte("created_at", since);

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

export async function getRecentMatches(limit = 5): Promise<MatchRow[]> {
  const { data } = await supabase
    .from("matches")
    .select("id, region, match_number, atk_team, def_team, selected_map, winner, elo_changes, created_at")
    .eq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(limit);
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

export async function getPlayerByDiscordId(discordId: string): Promise<PlayerRow | null> {
  const { data } = await supabase
    .from("players")
    .select("discord_id, username, avatar_url, elo, wins, losses")
    .eq("discord_id", discordId)
    .single();
  return data as PlayerRow | null;
}

export async function getPlayerMatches(discordId: string, limit = 10): Promise<MatchRow[]> {
  const { data } = await supabase
    .from("matches")
    .select("id, region, match_number, atk_team, def_team, selected_map, winner, elo_changes, created_at")
    .eq("status", "ended")
    .or(`atk_team.cs.{${discordId}},def_team.cs.{${discordId}}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MatchRow[];
}

export async function getActiveMatchForUser(userId: string): Promise<BanMatchRow | null> {
  const { data } = await supabase
    .from("matches")
    .select("id, match_number, region, atk_team, def_team, selected_map, status, bans, banners, ban_deadline, created_at")
    .eq("status", "active")
    .or(`atk_team.cs.{${userId}},def_team.cs.{${userId}}`);
  if (!data || data.length === 0) return null;
  return data[0] as BanMatchRow | null;
}

export async function submitBan(matchId: string, userId: string, mapName: string) {
  const res = await fetch("/api/match/ban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, matchId, mapName }),
  });
  return res.json();
}
