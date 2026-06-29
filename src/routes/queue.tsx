import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Swords, Users, LogIn, Loader2, Clock, Zap, Trophy, Target } from "lucide-react";

type QueuePlayer = {
  user_id: string;
  username: string;
  avatar_url: string;
  joined_at: string;
};

export const Route = createFileRoute("/queue")({
  component: QueuePage,
});

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function parseSession(): { user_id: string; username: string; avatar_url: string } | null {
  const cookie = getCookie("capl_session");
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length < 2) return null;
  try {
    // Handle both base64 and base64url encoding
    const base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch (e) {
    console.error("Failed to parse session:", e);
    return null;
  }
}

function QueuePage() {
  const [players, setPlayers] = useState<QueuePlayer[]>([]);
  const [session, setSession] = useState<ReturnType<typeof parseSession>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(parseSession());
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/queue");
      const data = await res.json();
      if (data.players) setPlayers(data.players);
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const inQueue = session ? players.some((p) => p.user_id === session.user_id) : false;
  const myPlayer = session ? players.find((p) => p.user_id === session.user_id) : null;
  const count = players.length;
  
  function getTimeInQueue(joinedAt: string): string {
    const now = new Date();
    const joined = new Date(joinedAt);
    const diffMs = now.getTime() - joined.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMins > 0) return `${diffMins}m ${diffSecs}s`;
    return `${diffSecs}s`;
  }

  async function handleJoin() {
    if (!session) return;
    setLoading(true);
    try {
      await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });
      await fetchQueue();
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave() {
    if (!session) return;
    setLoading(true);
    try {
      await fetch("/api/queue/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: session.user_id }),
      });
      await fetchQueue();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Swords className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-display text-2xl font-bold">Matchmaking Queue</h1>
              <p className="text-sm text-muted-foreground">Join the queue and get matched</p>
            </div>
          </div>
          {session && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
              Online
            </Badge>
          )}
        </motion.div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">In Queue</div>
              </div>
            </div>
          </Card>
          <Card className="border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Zap className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">~2m</div>
                <div className="text-xs text-muted-foreground">Avg Wait</div>
              </div>
            </div>
          </Card>
          <Card className="border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                <Trophy className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <div className="text-2xl font-bold">5v5</div>
                <div className="text-xs text-muted-foreground">Match Size</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Queue Action Card */}
        <Card className="border-border bg-gradient-to-br from-card to-card/50 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="font-semibold">Queue Status</span>
            </div>
            {myPlayer && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-mono font-semibold text-primary">
                  {getTimeInQueue(myPlayer.joined_at)}
                </span>
              </div>
            )}
          </div>

          {!session ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Login with Discord to join the matchmaking queue
                </p>
              </div>
              <Button asChild className="w-full gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4]">
                <a href="/api/auth/discord">
                  <LogIn className="h-4 w-4" /> Login with Discord
                </a>
              </Button>
            </div>
          ) : inQueue ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-primary">Searching for match...</div>
                    <div className="text-sm text-muted-foreground">
                      You'll be notified when a match is found
                    </div>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleLeave}
                disabled={loading}
                variant="destructive"
                className="w-full gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Leave Queue
              </Button>
            </div>
          ) : (
            <Button onClick={handleJoin} disabled={loading} className="w-full gap-2 h-12 text-base">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Users className="h-5 w-5" />
              )}
              Join Queue
            </Button>
          )}
        </Card>

        {/* Players List */}
        <Card className="border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Players in Queue</h2>
            <Badge variant="secondary">{count}</Badge>
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {players.map((p, i) => (
                <motion.div
                  key={p.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10 border-2 border-border">
                          <AvatarImage src={p.avatar_url} alt={p.username} />
                          <AvatarFallback>{p.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{p.username}</div>
                          {p.user_id === session?.user_id && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">YOU</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Joined {getTimeInQueue(p.joined_at)} ago
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
            {players.length === 0 && !loading && (
              <div className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">Queue is empty</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Be the first to join and start a match!
                </p>
              </div>
            )}
            {players.length === 0 && loading && (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Loading queue...</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
