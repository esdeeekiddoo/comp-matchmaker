import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, Trophy, Swords, Users, Flame, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RankBadge } from "@/components/rank-badge";
import { getPlayers, avatarUrl } from "@/lib/supabase-queries";
import { toast } from "sonner";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  loader: async () => {
    const all = await getPlayers();
    const top = all.slice(0, 6);
    return { top, total: all.length };
  },
  head: () => ({
    meta: [
      { title: "Jail Bird Matchmaking — Competitive 5v5" },
      { name: "description", content: "Track ranks, ELO, stats and match history." },
      { property: "og:title", content: "Jail Bird Matchmaking — Competitive 5v5" },
      { property: "og:description", content: "Climb the ladder. Queue directly from Discord." },
    ],
  }),
  component: Home,
});

function Home() {
  const { top, total } = Route.useLoaderData();

  return (
    <AppShell>
      <div className="grid gap-6 p-4 lg:grid-cols-[1fr_320px] lg:p-6">
        <div className="space-y-6 min-w-0">
          <Hero />
          <LiveStats total={total} />
        </div>
        <aside className="space-y-6">
          <TopPlayersCard top={top} />
        </aside>
      </div>
    </AppShell>
  );
}

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl border border-border"
    >
      <img
        src={hero}
        alt="Jail Bird Matchmaking"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
      <div className="relative grid gap-5 p-6 sm:p-10 md:max-w-2xl">
        <Badge className="w-fit gap-1 bg-primary/15 text-primary hover:bg-primary/20">
          <Flame className="h-3 w-3" /> Season 1
        </Badge>
        <h1 className="text-display text-3xl font-extrabold leading-tight sm:text-5xl">
          Queue Smarter. <span className="text-primary">Climb Harder.</span>
        </h1>
        <p className="max-w-lg text-sm text-muted-foreground sm:text-base">
          Jail Bird Matchmaking — competitive 5v5 ranked matchmaking. Queue through Discord, track
          your stats, and climb the leaderboard.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() =>
              toast("Discord login coming soon", {
                description: "Connect your account to sync your matches.",
              })
            }
            className="gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4]"
          >
            <MessageCircle className="h-4 w-4" /> Connect Discord
          </Button>
          <Button
            asChild
            variant="outline"
            className="gap-2 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <Link to="/leaderboard">
              <Trophy className="h-4 w-4" /> View Leaderboard
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function LiveStats({ total }: { total: number }) {
  const stats = [
    { label: "Tracked Players", value: total, icon: Users, color: "text-success" },
    { label: "Live Matches", value: "—", icon: Swords, color: "text-primary" },
    { label: "Status", value: "Active", icon: Flame, color: "text-warning" },
    { label: "Queue", value: "Discord", icon: Trophy, color: "text-chart-3" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-semibold uppercase tracking-wider">{s.label}</span>
            <s.icon className={`h-4 w-4 ${s.color}`} />
          </div>
          <div className="mt-2 text-display text-2xl font-bold">{s.value}</div>
        </Card>
      ))}
    </div>
  );
}

function TopPlayersCard({ top }: { top: Awaited<ReturnType<typeof getPlayers>> }) {
  return (
    <Card className="border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="section-title">Top Players</div>
        <Link to="/leaderboard" className="text-xs text-muted-foreground hover:text-primary">
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {top.map((p, i) => {
          const name = p.username ?? p.discord_id;
          return (
            <Link
              key={p.discord_id}
              to="/players/$username"
              params={{ username: name }}
              className="flex items-center gap-3 rounded-md p-1.5 transition hover:bg-muted/50"
            >
              <span className={`w-5 text-center font-display text-sm font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                {i + 1}
              </span>
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={avatarUrl(p)} alt={name} />
                <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{name}</div>
                <RankBadge elo={p.elo} size="sm" />
              </div>
            </Link>
          );
        })}
        {top.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No tracked players yet.</p>
        )}
      </div>
    </Card>
  );
}
