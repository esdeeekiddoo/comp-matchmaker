import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/rank-badge";
import { 
  User, Trophy, Target, TrendingUp, Calendar, 
  Swords, Shield, Flame, BarChart3, ExternalLink,
  ChevronRight, Zap, MapPin
} from "lucide-react";
import { getPlayerByDiscordId, getPlayerMatches, avatarUrl } from "@/lib/supabase-queries";
import { parseSession, getActiveGuildId, type Session } from "@/lib/session";
import { rankFromElo, RANK_COLORS, type Rank } from "@/lib/ranks";
import { getMapImage } from "@/lib/maps";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = parseSession();
    setSession(s);
    
    if (s) {
      loadPlayerData(s.user_id, s);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadPlayerData(userId: string, s: Session) {
    try {
      const guildId = getActiveGuildId(s) || undefined;
      const [playerData, matchData] = await Promise.all([
        getPlayerByDiscordId(userId),
        getPlayerMatches(userId, 10, guildId),
      ]);
      setPlayer(playerData);
      setMatches(matchData || []);
    } catch (err) {
      console.error("Failed to load player data:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <Card className="max-w-md border-border bg-card p-8 text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">Login Required</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect your Discord account to view your profile and stats
            </p>
            <Button asChild className="mt-6 w-full gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4]">
              <a href="/api/auth/discord">
                <ExternalLink className="h-4 w-4" /> Login with Discord
              </a>
            </Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  const wins = player?.wins || 0;
  const losses = player?.losses || 0;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : "0.0";
  const elo = player?.elo || 100;

  const currentRank = rankFromElo(elo);
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
    ? Math.min(100, ((elo - prevRankMin) / (nextRank.min - prevRankMin)) * 100)
    : 100;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="card-faceit border-border bg-gradient-to-br from-card to-card/50 p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Avatar className="h-24 w-24 border-4 border-border shadow-lg">
                <AvatarImage src={avatarUrl(session)} alt={session.username} />
                <AvatarFallback className="bg-muted text-2xl">
                  {session.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-display text-2xl font-bold text-foreground">{session.username}</h1>
                  <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/5">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
                    <span className="text-success">Online</span>
                  </Badge>
                </div>
                <div className="mt-2">
                  <RankBadge elo={elo} size="lg" />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Discord ID: {session.user_id}
                </p>
              </div>
            </div>

            {/* Rank Progression Bar */}
            {nextRank && (
              <div className="mt-6 rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-2">
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
                  <span>{elo} ELO</span>
                  <span>{nextRank.min - elo} ELO to go</span>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="card-faceit border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{elo}</div>
                <div className="text-xs text-muted-foreground">ELO Rating</div>
              </div>
            </div>
          </Card>

          <Card className="card-faceit border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                <Target className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{winRate}%</div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
            </div>
          </Card>

          <Card className="card-faceit border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-3/10">
                <Swords className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{wins}</div>
                <div className="text-xs text-muted-foreground">Wins</div>
              </div>
            </div>
          </Card>

          <Card className="card-faceit border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <Shield className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{losses}</div>
                <div className="text-xs text-muted-foreground">Losses</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Matches */}
        <Card className="card-faceit border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Recent Matches</h2>
            </div>
            <Link to="/matches" className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors">
              View All <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {matches.length > 0 ? (
              matches.map((m) => {
                const mapImg = getMapImage(m.selected_map);
                return (
                  <Link
                    key={m.id}
                    to="/matches/$id"
                    params={{ id: m.id }}
                    className="block"
                  >
                    <Card className="border-border/40 bg-muted/20 p-3 transition-all duration-200 hover:bg-muted/40 hover:border-border/60">
                      <div className="flex items-center gap-3">
                        {mapImg ? (
                          <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg">
                            <img
                              src={mapImg}
                              alt={m.selected_map ?? ""}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                            <MapPin className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="flex flex-1 items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge
                              className={`w-16 justify-center ${
                                m.winner === "atk"
                                  ? "bg-success/20 text-success border-success/30"
                                  : "bg-destructive/20 text-destructive border-destructive/30"
                              }`}
                            >
                              {m.winner === "atk" ? "WIN" : "LOSS"}
                            </Badge>
                            <div>
                              <div className="text-sm font-medium text-foreground">{m.selected_map || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground">
                                Match #{m.match_number} · {m.region}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-semibold ${
                              m.winner === "atk" ? "text-success" : "text-destructive"
                            }`}>
                              {m.winner === "atk" ? "+" : "-"}
                              {Math.abs(m.elo_change || 0)} ELO
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(m.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })
            ) : (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/30">
                  <Flame className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="mt-4 text-sm font-medium text-muted-foreground">No matches yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Join the queue to start your competitive journey!
                </p>
                <Button asChild className="mt-4" size="sm">
                  <Link to="/queue">Join Queue</Link>
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
