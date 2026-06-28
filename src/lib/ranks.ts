export type Rank =
  | "Iron"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master"
  | "Challenger";

export const RANK_COLORS: Record<Rank, string> = {
  Iron: "#7a7a7a",
  Bronze: "#b07a3b",
  Silver: "#c4c8cc",
  Gold: "#e0b341",
  Platinum: "#5fd6c5",
  Diamond: "#7aa6ff",
  Master: "#c773ff",
  Challenger: "#ff5a3c",
};

export function rankFromElo(elo: number): Rank {
  if (elo >= 2200) return "Challenger";
  if (elo >= 1950) return "Master";
  if (elo >= 1700) return "Diamond";
  if (elo >= 1450) return "Platinum";
  if (elo >= 1200) return "Gold";
  if (elo >= 950) return "Silver";
  if (elo >= 750) return "Bronze";
  return "Iron";
}
