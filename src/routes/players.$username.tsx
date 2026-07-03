import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Percent } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RankBadge } from "@/components/rank-badge";
import { getPlayerByUsername, getEloHistory, avatarUrl } from "@/lib/supabase-queries";

export const Route = createFileRoute("/players/$username")({
  loader: async ({ params }) => {
    const player = await getPlayerByUsername(params.username);
    if (!player) throw notFound();
    const history = await getEloHistory(player.discord_id);
    return { player, history };
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
  const { player, history } = Route.useLoaderData();
  const total = player.wins + player.losses;
  const winPct = total > 0 ? Math.round((player.wins / total) * 100) : 0;
  const name = player.username ?? player.discord_id;

  const trendData = history.map((h, i) => ({ match: i + 1, elo: h.elo }));

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

        <Card className="overflow-hidden border-border bg-card">
          <div className="relative h-32 bg-gradient-to-r from-primary/30 via-primary/10 to-background">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.12),transparent_60%)]" />
          </div>
          <div className="flex flex-wrap items-end gap-5 p-6 -mt-12">
            <Avatar className="h-24 w-24 border-4 border-card shadow-lg">
              <AvatarImage src={avatarUrl(player)} />
              <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-display text-3xl font-extrabold">{name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <RankBadge elo={player.elo} />
              </div>
            </div>
            <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Season 1</Badge>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile icon={Percent} label="Win Rate" value={`${winPct}%`} />
          <StatTile label="Wins" value={`${player.wins}`} />
          <StatTile label="Losses" value={`${player.losses}`} />
          <StatTile label="ELO" value={`${player.elo}`} />
        </div>

        {history.length > 0 && (
          <Card className="border-border bg-card p-5">
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
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
      </div>
      <div className="mt-1.5 text-display text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
