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
  Swords, Shield, Flame, BarChart3, ExternalLink 
} from "lucide-react";
import { getPlayerByDiscordId, getPlayerMatches, avatarUrl } from "@/lib/supabase-queries";
import { parseSession, getActiveGuildId, type Session } from "@/lib/session";

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

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-border bg-gradient-to-br from-card to-card/50 p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Avatar className="h-24 w-24 border-4 border-border">
                <AvatarImage src={avatarUrl(session)} alt={session.username} />
                <AvatarFallback className="text-2xl">
                  {session.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-display text-2xl font-bold">{session.username}</h1>
                  <Badge variant="outline" className="gap-1.5">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
                    Online
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
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{elo}</div>
                <div className="text-xs text-muted-foreground">ELO Rating</div>
              </div>
            </div>
          </Card>

          <Card className="border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Target className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">{winRate}%</div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
            </div>
          </Card>

          <Card className="border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                <Swords className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <div className="text-2xl font-bold">{wins}</div>
                <div className="text-xs text-muted-foreground">Wins</div>
              </div>
            </div>
          </Card>

          <Card className="border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <Shield className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold">{losses}</div>
                <div className="text-xs text-muted-foreground">Losses</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Matches */}
        <Card className="border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Recent Matches</h2>
            </div>
            <Link to="/matches" className="text-sm text-primary hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {matches.length > 0 ? (
              matches.map((m) => (
                <Link
                  key={m.id}
                  to="/matches/$id"
                  params={{ id: m.id }}
                  className="block"
                >
                  <Card className="border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={m.winner === "atk" ? "default" : "secondary"}
                          className="w-16 justify-center"
                        >
                          {m.winner === "atk" ? "WIN" : "LOSS"}
                        </Badge>
                        <div>
                          <div className="text-sm font-medium">{m.selected_map || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">
                            Match #{m.match_number} · {m.region}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {m.winner === "atk" ? "+" : "-"}
                          {Math.abs(m.elo_change || 0)} ELO
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="py-12 text-center">
                <Flame className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">No matches yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
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
