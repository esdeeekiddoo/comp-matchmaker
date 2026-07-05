import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Trophy,
  Swords,
  Flame,
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
import hero from "@/assets/APL.png";

export const Route = createFileRoute("/")({
  loader: async () => {
    const guildId = typeof window !== "undefined" ? getActiveGuildId(parseSession()) : undefined;
    const [all, recent] = await Promise.all([getPlayers(guildId), getRecentMatches(5, guildId)]);
    const top = all.slice(0, 6);
    return { top, recent };
  },
  head: () => ({
    meta: [
      { title: "APL | Asia Premiere League" },
      { name: "description", content: "Track ranks, ELO, stats and match history." },
      { property: "og:title", content: "APL | Asia Premiere League" },
      { property: "og:description", content: "Climb the ladder. Queue from our website." },
    ],
  }),
  component: Home,
});

function Home() {
  const { top, recent } = Route.useLoaderData();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(parseSession());
  }, []);

  return (
    <AppShell>
      <div className="grid gap-6 p-4 lg:grid-cols-[1fr_320px] lg:p-6">
        <div className="space-y-6 min-w-0">
          <Hero session={session} />
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
      className="relative overflow-hidden rounded-2xl border border-border/60"
    >
      <img
        src={hero}
        alt="APL"
        className="absolute inset-0 h-full w-full object-cover opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/50" />
      <div className="relative grid gap-5 p-6 sm:p-10 md:max-w-2xl">
        <Badge className="w-fit gap-1.5 bg-primary/15 text-primary hover:bg-primary/20 border-primary/20">
          <Flame className="h-3 w-3" /> Season 1
        </Badge>
        <h1 className="text-display text-3xl font-extrabold leading-tight sm:text-5xl">
          <span className="text-primary">Asia Premiere</span>
          <br />
          <span className="text-foreground">League</span>
        </h1>
        <p className="max-w-lg text-sm text-muted-foreground sm:text-base leading-relaxed">
          Ranked matchmaking, leaderboards, and competitive play. Climb to the top!
        </p>
        <div className="flex flex-wrap gap-3">
          {!session ? (
            <Button asChild className="gap-2 h-11 px-6 bg-[#5865F2] text-white hover:bg-[#4752c4] transition-all duration-200 hover:shadow-lg hover:shadow-[#5865F2]/20">
              <a href="/api/auth/discord">
                <MessageCircle className="h-4 w-4" /> Connect Discord
              </a>
            </Button>
          ) : (
            <Button asChild className="gap-2 h-11 px-6 bg-primary hover:bg-primary/90 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20">
              <Link to="/queue">
                <Swords className="h-4 w-4" /> Join Queue
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="gap-2 h-11 px-6 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary transition-all duration-200"
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



function RecentMatches({ matches }: { matches: Awaited<ReturnType<typeof getRecentMatches>> }) {
  return (
    <Card className="card-faceit border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="section-title">Recent Matches</div>
        <Link to="/matches" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          View all →
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
              className="flex items-center gap-3 rounded-xl p-2.5 transition-all duration-200 hover:bg-muted/40 border border-transparent hover:border-border/40"
            >
              {img ? (
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg">
                  <img
                    src={img}
                    alt={m.selected_map ?? ""}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                  <Map className="h-5 w-5 text-muted-foreground/50" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{m.selected_map ?? "Unknown map"}</div>
                <div className="text-xs text-muted-foreground">
                  #{m.match_number} · {m.region}
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={`text-[10px] capitalize ${
                  m.winner === "atk" ? "border-red-500/30 text-red-400 bg-red-500/10" :
                  m.winner === "def" ? "border-blue-500/30 text-blue-400 bg-blue-500/10" :
                  "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
                }`}
              >
                {m.winner === "atk" ? "T" : m.winner === "def" ? "CT" : "?"}
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
    <Card className="card-faceit border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="section-title">Top Players</div>
        <Link to="/leaderboard" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          View all →
        </Link>
      </div>
      <div className="space-y-2">
        {top.map((p, i) => {
          const name = p.username ?? p.discord_id;
          const isTop3 = i < 3;
          return (
            <Link
              key={p.discord_id}
              to="/players/$username"
              params={{ username: name }}
              className={`flex items-center gap-3 rounded-xl p-2.5 transition-all duration-200 hover:bg-muted/40 border border-transparent hover:border-border/40 ${
                isTop3 ? "bg-primary/5" : ""
              }`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${
                isTop3 ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
              }`}>
                <span className="font-display text-xs font-bold">{i + 1}</span>
              </div>
              <Avatar className={`h-9 w-9 border-2 ${isTop3 ? "border-primary/50" : "border-border"}`}>
                <AvatarImage src={avatarUrl(p)} alt={name} />
                <AvatarFallback className="bg-muted text-xs">{name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{name}</div>
                <RankBadge elo={p.elo} size="sm" />
              </div>
            </Link>
          );
        })}
        {top.length === 0 && (
          <div className="py-8 text-center">
            <Trophy className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No tracked players yet</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function DiscordCard() {
  return (
    <Card className="card-faceit border-border/60 bg-card overflow-hidden">
      <div className="bg-gradient-to-br from-[#5865F2] to-[#4752c4] p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 mx-auto">
          <MessageCircle className="h-7 w-7 text-white" />
        </div>
      </div>
      <CardContent className="space-y-3 p-5 text-center">
        <div className="text-sm font-semibold text-foreground">Join the Community</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Queue through our website, get notifications in Discord, and track your progress.
        </p>
        <Button asChild className="w-full gap-2 h-10 bg-[#5865F2] text-white hover:bg-[#4752c4] transition-all duration-200 hover:shadow-lg hover:shadow-[#5865F2]/20">
          <a href="https://discord.gg/F6ZfYevYXd" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> Join Discord
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
