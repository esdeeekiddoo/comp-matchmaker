import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Percent, Zap, TrendingUp, TrendingDown, Trophy, Shield, Swords } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RankBadge } from "@/components/rank-badge";
import { getPlayerByUsername, getEloHistory, getPlayerBadges, avatarUrl } from "@/lib/supabase-queries";
import { rankFromElo, RANK_COLORS, type Rank } from "@/lib/ranks";

export const Route = createFileRoute("/players/$username")({
  loader: async ({ params }) => {
    const player = await getPlayerByUsername(params.username);
    if (!player) throw notFound();
    const [history, badges] = await Promise.all([
      getEloHistory(player.discord_id),
      getPlayerBadges(player.discord_id),
    ]);
    return { player, history, badges };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.player.username ?? loaderData.player.discord_id} — APL`
          : "Player — APL",
      },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.player.elo} ELO · ${loaderData.player.wins}W ${loaderData.player.losses}L`
          : "Player profile",
      },
    ],
  }),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-10 text-center text-muted-foreground">Player not found.</div>
    </AppShell>
  ),
  errorComponent: () => (
    <AppShell>
      <div className="p-10 text-center text-muted-foreground">Couldn't load this profile.</div>
    </AppShell>
  ),
  component: PlayerPage,
});

function PlayerPage() {
  const { player, history, badges } = Route.useLoaderData();
  const total = player.wins + player.losses;
  const winPct = total > 0 ? Math.round((player.wins / total) * 100) : 0;
  const name = player.username ?? player.discord_id;

  const trendData = history.map((h, i) => ({ match: i + 1, elo: h.elo }));

  const currentRank = rankFromElo(player.elo);
  const rankColor = RANK_COLORS[currentRank];
  const RANK_THRESHOLDS = [
    { name: "Bronze I", min: 0 },
    { name: "Bronze II", min: 200 },
    { name: "Bronze III", min: 400 },
    { name: "Silver I", min: 600 },
    { name: "Silver II", min: 850 },
    { name: "Silver III", min: 1100 },
    { name: "Gold I", min: 1350 },
    { name: "Gold II", min: 1650 },
    { name: "Gold III", min: 1950 },
    { name: "Platinum I", min: 2250 },
    { name: "Platinum II", min: 2600 },
    { name: "Platinum III", min: 2950 },
    { name: "Diamond I", min: 3400 },
    { name: "Diamond II", min: 3850 },
    { name: "Diamond III", min: 4300 },
    { name: "Dominator I", min: 4500 },
    { name: "Dominator II", min: 5000 },
    { name: "Sovereign I", min: 6000 },
    { name: "Sovereign II", min: 6700 },
    { name: "Master", min: 7400 },
  ];
  const currentRankIdx = RANK_THRESHOLDS.findIndex((r) => r.name === currentRank);
  const nextRank = currentRankIdx < RANK_THRESHOLDS.length - 1 ? RANK_THRESHOLDS[currentRankIdx + 1] : null;
  const prevRankMin = RANK_THRESHOLDS[currentRankIdx]?.min || 0;
  const progress = nextRank
    ? Math.min(100, ((player.elo - prevRankMin) / (nextRank.min - prevRankMin)) * 100)
    : 100;

  return (
    <AppShell>
      <div className="space-y-6 p-4 lg:p-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <Link to="/leaderboard">
            <ArrowLeft className="h-4 w-4" /> Leaderboard
          </Link>
        </Button>

        <Card className="card-faceit overflow-hidden border-border bg-card">
          <div className="relative h-32 bg-gradient-to-r from-primary/30 via-primary/10 to-background">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.12),transparent_60%)]" />
          </div>
          <div className="flex flex-wrap items-end gap-5 p-6 -mt-12">
            <Avatar className="h-24 w-24 border-4 border-card shadow-lg">
              <AvatarImage src={avatarUrl(player)} />
              <AvatarFallback className="bg-muted text-2xl">{name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-display text-3xl font-extrabold text-foreground">{name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <RankBadge elo={player.elo} />
              </div>
            </div>
            <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/20">Season 1</Badge>
          </div>
        </Card>

        {/* Rank Progression Bar */}
        {nextRank && (
          <Card className="card-faceit border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: rankColor }} />
                <span className="text-sm font-medium text-foreground">{currentRank}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Next:</span>
                <span className="text-sm font-medium" style={{ color: RANK_COLORS[nextRank.name as Rank] }}>
                  {nextRank.name}
                </span>
              </div>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: rankColor }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{player.elo} ELO</span>
              <span>{nextRank.min - player.elo} ELO to go</span>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile icon={Percent} label="Win Rate" value={`${winPct}%`} color="text-success" bg="bg-success/10" />
          <StatTile icon={Trophy} label="Wins" value={`${player.wins}`} color="text-primary" bg="bg-primary/10" />
          <StatTile icon={Shield} label="Losses" value={`${player.losses}`} color="text-destructive" bg="bg-destructive/10" />
          <StatTile icon={Zap} label="ELO" value={`${player.elo}`} color="text-chart-3" bg="bg-chart-3/10" />
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <Card className="card-faceit border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Badges</h2>
              <span className="ml-auto text-xs text-muted-foreground">{badges.length} total</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {badges.map((pb) => (
                <div
                  key={pb.id}
                  className="group relative flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 transition-all hover:border-primary/30 hover:bg-muted/30"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 ring-1 ring-amber-500/20">
                    <Trophy className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{pb.badge?.name || "Badge"}</div>
                    {pb.reason && (
                      <div className="text-xs text-muted-foreground">{pb.reason}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {history.length > 0 && (
          <Card className="card-faceit border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="section-title">ELO Trend</div>
              <span className="text-xs text-muted-foreground">Last {history.length} matches</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="match"
                    stroke="oklch(0.66 0.015 250)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="oklch(0.66 0.015 250)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={["dataMin - 50", "dataMax + 50"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.205 0.01 250)",
                      border: "1px solid oklch(0.28 0.012 250)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="elo"
                    stroke="oklch(0.72 0.19 45)"
                    strokeWidth={2.5}
                    dot={{ fill: "oklch(0.72 0.19 45)", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  color = "text-primary",
  bg = "bg-primary/10",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
  bg?: string;
}) {
  return (
    <Card className="card-faceit border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        )}
      </div>
      <div className="mt-2 text-display text-2xl font-bold tabular-nums text-foreground">{value}</div>
    </Card>
  );
}
