import { RANK_COLORS, rankFromElo, type Rank } from "@/lib/ranks";

export function RankBadge({
  elo,
  size = "md",
  showElo = true,
}: {
  elo: number;
  size?: "sm" | "md" | "lg";
  showElo?: boolean;
}) {
  const rank: Rank = rankFromElo(elo);
  const color = RANK_COLORS[rank];
  const dot = size === "lg" ? "h-3 w-3" : size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const text = size === "lg" ? "text-base" : size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div
      className={`inline-flex items-center gap-2 font-display font-semibold uppercase tracking-wider ${text}`}
    >
      <span
        className={`${dot} rounded-full`}
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span style={{ color }}>{rank}</span>
      {showElo && <span className="text-muted-foreground">{elo}</span>}
    </div>
  );
}
