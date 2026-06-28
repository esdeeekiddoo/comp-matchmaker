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

export function avatarUrl(row: PlayerRow): string {
  if (row.avatar_url) return `https://cdn.discordapp.com/avatars/${row.discord_id}/${row.avatar_url}.png`;
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${row.discord_id}`;
}
