export type Rank =
  | "Bronze I"
  | "Bronze II"
  | "Bronze III"
  | "Silver I"
  | "Silver II"
  | "Silver III"
  | "Gold I"
  | "Gold II"
  | "Gold III"
  | "Platinum I"
  | "Platinum II"
  | "Platinum III"
  | "Dominator I"
  | "Dominator II"
  | "Sovereign I"
  | "Sovereign II"
  | "Master";

export const RANK_COLORS: Record<Rank, string> = {
  "Bronze I": "#cd7f32",
  "Bronze II": "#c4722e",
  "Bronze III": "#b8662a",
  "Silver I": "#c4c8cc",
  "Silver II": "#b0b5ba",
  "Silver III": "#9ca3af",
  "Gold I": "#f59e0b",
  "Gold II": "#d97706",
  "Gold III": "#b45309",
  "Platinum I": "#14b8a6",
  "Platinum II": "#0d9488",
  "Platinum III": "#0f766e",
  "Dominator I": "#8b5cf6",
  "Dominator II": "#7c3aed",
  "Sovereign I": "#ef4444",
  "Sovereign II": "#dc2626",
  Master: "#f97316",
};

export function rankFromElo(elo: number): Rank {
  if (elo >= 7400) return "Master";
  if (elo >= 6700) return "Sovereign II";
  if (elo >= 6000) return "Sovereign I";
  if (elo >= 5000) return "Dominator II";
  if (elo >= 4500) return "Dominator I";
  if (elo >= 2950) return "Platinum III";
  if (elo >= 2600) return "Platinum II";
  if (elo >= 2250) return "Platinum I";
  if (elo >= 1950) return "Gold III";
  if (elo >= 1650) return "Gold II";
  if (elo >= 1350) return "Gold I";
  if (elo >= 1100) return "Silver III";
  if (elo >= 850) return "Silver II";
  if (elo >= 600) return "Silver I";
  if (elo >= 400) return "Bronze III";
  if (elo >= 200) return "Bronze II";
  return "Bronze I";
}
