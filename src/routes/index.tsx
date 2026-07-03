import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Trophy,
  Swords,
  Users,
  Flame,
  Headphones,
  Map,
  ExternalLink,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RankBadge } from "@/components/rank-badge";
import { getPlayers, getRecentMatches, avatarUrl } from "@/lib/supabase-queries";
import { getMapImage } from "@/lib/maps";
import { parseSession, getActiveGuildId, type Session } from "@/lib/session";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  loader: async () => {
    const guildId = typeof window !== "undefined" ? getActiveGuildId(parseSession()) : undefined;
    const [all, recent] = await Promise.all([getPlayers(guildId), getRecentMatches(5, guildId)]);
    const top = all.slice(0, 6);
    return { top, recent, total: all.length };
  },
  head: () => ({
    meta: [
      { title: "CAPL | Counter-Blox APL" },
      { name: "description", content: "Track ranks, ELO, stats and match history." },
      { property: "og:title", content: "CAPL | Counter-Blox APL" },
      { property: "og:description", content: "Climb the ladder. Queue from our website." },
    ],
  }),
  component: Home,
});

function Home() {
  const { top, recent, total } = Route.useLoaderData();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(parseSession());
  }, []);

  return (
    <AppShell>
      <div className="grid gap-6 p-4 lg:grid-cols-[1fr_320px] lg:p-6">
        <div className="space-y-6 min-w-0">
          <Hero session={session} />
          <LiveStats total={total} />
          {recent.length > 0 && <RecentMatches matches={recent} />}
        </div>
        <aside className="space-y-6">
          <TopPlayersCard top={top} />
          <DiscordCard />
        </aside>
      </div>
    </AppShell>
  );
}

function Hero({
  session,
}: {
  session: { user_id: string; username: string; avatar_url: string } | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl border border-border"
    >
      <img
        src={hero}
        alt="CAPL"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
      <div className="relative grid gap-5 p-6 sm:p-10 md:max-w-2xl">
        <Badge className="w-fit gap-1 bg-primary/15 text-primary hover:bg-primary/20">
          <Flame className="h-3 w-3" /> Season 1
        </Badge>
        <h1 className="text-display text-3xl font-extrabold leading-tight sm:text-5xl">
          Home of <span className="text-primary">Asia CounterBlox</span>
        </h1>
        <p className="max-w-lg text-sm text-muted-foreground sm:text-base">
          CAPL | Counter-Blox Asia Premier League — Home of Asia Counter-Blox Series. Climb to the Leaderboards!
        </p>
        <div className="flex flex-wrap gap-3">
          {!session ? (
            <Button asChild className="gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4]">
              <a href="/api/auth/discord">
                <MessageCircle className="h-4 w-4" /> Connect Discord
              </a>
            </Button>
          ) : (
            <Button asChild className="gap-2">
              <Link to="/queue">
                <Swords className="h-4 w-4" /> Join Queue
              </Link>
            </Button>
          )}
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
    { label: "Seasons", value: "1", icon: Trophy, color: "text-chart-3" },
    { label: "Status", value: "Live", icon: Flame, color: "text-warning" },
    { label: "Queue", value: "Web", icon: Headphones, color: "text-primary" },
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


function RecentMatches({ matches }: { matches: Awaited<ReturnType<typeof getRecentMatches>> }) {
  return (
    <Card className="border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="section-title">Recent Matches</div>
        <Link to="/matches" className="text-xs text-muted-foreground hover:text-primary">
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {matches.map((m) => {
          const img = getMapImage(m.selected_map);
          return (
            <Link
              key={m.id}
              to="/matches/$id"
              params={{ id: m.id }}
              className="flex items-center gap-3 rounded-md p-2 transition hover:bg-muted/50"
            >
              {img ? (
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded">
                  <img
                    src={img}
                    alt={m.selected_map ?? ""}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <Map className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{m.selected_map ?? "Unknown map"}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · #{m.match_number} · {m.region}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {m.winner ?? "?"}
              </Badge>
            </Link>
          );
        })}
      </div>
    </Card>
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
              <span
                className={`w-5 text-center font-display text-sm font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}
              >
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

function DiscordCard() {
  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className="bg-[#5865F2] p-4 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-white" />
      </div>
      <CardContent className="space-y-3 p-4 text-center">
        <div className="text-sm font-semibold">Join the Community</div>
        <p className="text-xs text-muted-foreground">
          Queue through our website, get notifications in Discord, and track your progress.
        </p>
        <Button asChild className="w-full gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4]">
          <a href="https://discord.gg/F6ZfYevYXd" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> Join Discord
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
