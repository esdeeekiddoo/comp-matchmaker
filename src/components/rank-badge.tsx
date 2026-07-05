import { RANK_COLORS, rankFromElo, type Rank } from "@/lib/ranks";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const RANK_RANGES: Record<Rank, { min: number; max: number | null }> = {
  "Bronze I": { min: 0, max: 199 },
  "Bronze II": { min: 200, max: 399 },
  "Bronze III": { min: 400, max: 599 },
  "Silver I": { min: 600, max: 849 },
  "Silver II": { min: 850, max: 1099 },
  "Silver III": { min: 1100, max: 1349 },
  "Gold I": { min: 1350, max: 1649 },
  "Gold II": { min: 1650, max: 1949 },
  "Gold III": { min: 1950, max: 2249 },
  "Platinum I": { min: 2250, max: 2599 },
  "Platinum II": { min: 2600, max: 2949 },
  "Platinum III": { min: 2950, max: 3399 },
  "Diamond I": { min: 3400, max: 3849 },
  "Diamond II": { min: 3850, max: 4299 },
  "Diamond III": { min: 4300, max: 4499 },
  "Dominator I": { min: 4500, max: 4999 },
  "Dominator II": { min: 5000, max: 5999 },
  "Sovereign I": { min: 6000, max: 6699 },
  "Sovereign II": { min: 6700, max: 7399 },
  Master: { min: 7400, max: null },
};

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
  const range = RANK_RANGES[rank];
  const dot = size === "lg" ? "h-3 w-3" : size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const text = size === "lg" ? "text-base" : size === "sm" ? "text-[10px]" : "text-xs";

  const tooltipText = range.max !== null
    ? `${range.min} – ${range.max} ELO`
    : `${range.min}+ ELO`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
