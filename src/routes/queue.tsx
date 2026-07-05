import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users, LogIn, Loader2, Clock,
  UserPlus, UserMinus, UserCheck, X, PartyPopper,
  Shield, Zap, Timer, TrendingUp,
} from "lucide-react";
import { rankFromElo, RANK_COLORS, type Rank } from "@/lib/ranks";
import { toast } from "sonner";
import { avatarUrl, getActiveMatchForUser, getPlayersByIds } from "@/lib/supabase-queries";
import { BanOverlay } from "@/components/ban-overlay";
import { parseSession, getActiveGuildId, type Session } from "@/lib/session";
import heroImg from "@/assets/APL.png";
import queueIcon from "@/assets/Queue.png";
import statusIcon from "@/assets/Status.png";

type QueuePlayer = {
  user_id: string;
  username: string;
  avatar_url: string;
  joined_at: string;
  elo: number;
};

type Party = {
  id: number;
  guild_id: string;
  leader_id: string;
  members: string[];
  channel_id: string;
  status: string;
};

type Invite = {
  id: number;
  party_id: number;
  from_user_id: string;
  from_username: string;
  to_user_id: string;
  created_at: string;
};

export const Route = createFileRoute("/queue")({
  component: QueuePage,
});

function QueuePage() {
  const [players, setPlayers] = useState<QueuePlayer[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  function getGuildId(): string | undefined {
    if (!session) return undefined;
    return getActiveGuildId(session) || undefined;
  }
  const [myParty, setMyParty] = useState<Party | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [partyLoading, setPartyLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<QueuePlayer[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [matchPlayers, setMatchPlayers] = useState<{ user_id: string; username: string; avatar_url: string }[]>([]);
  const [banInfo, setBanInfo] = useState<{ banned: boolean; expires_at?: string; reason?: string } | null>(null);
  const [banCountdown, setBanCountdown] = useState("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevMatchRef = useRef<any>(null);

  useEffect(() => {
    setSession(parseSession());
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const guildId = getGuildId();
      const res = await fetch(`/api/queue${guildId ? `?guildId=${guildId}` : ""}`);
      const data = await res.json();
      if (data.players) setPlayers(data.players);
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false);
    }
  }, [session]);

  const fetchParty = useCallback(async () => {
    if (!session) {
      setMyParty(null);
      setPendingInvites([]);
      return;
    }
    try {
      const guildId = getGuildId();
      const res = await fetch(`/api/party${guildId ? `?guildId=${guildId}` : ""}`);
      const data = await res.json();
      if (data.ok) {
        setMyParty(data.party);
        setPendingInvites(data.invites || []);
      }
    } catch {
      // ignore
    }
  }, [session]);

  const fetchActiveMatch = useCallback(async () => {
    if (!session) return;
    const guildId = getActiveGuildId(session) || undefined;
    try {
      const match = await getActiveMatchForUser(session.user_id, guildId);
      if (match) {
        setActiveMatch(match);
        const allIds = [...new Set([...match.atk_team, ...match.def_team])];
        const rows = await getPlayersByIds(allIds);
        setMatchPlayers(rows.map((r) => ({ user_id: r.discord_id, username: r.username || "Unknown", avatar_url: r.avatar_url || "" })));
      } else {
        setActiveMatch(null);
        setMatchPlayers([]);
      }
    } catch {
      // ignore polling errors
    }
  }, [session]);

  const fetchBanStatus = useCallback(async () => {
    if (!session) { setBanInfo(null); return; }
    try {
      const guildId = getGuildId();
      const res = await fetch(`/api/queue/ban-status?userId=${session.user_id}${guildId ? `&guildId=${guildId}` : ""}`);
      const data = await res.json();
      setBanInfo(data);
    } catch {
      setBanInfo(null);
    }
  }, [session]);

  useEffect(() => {
    fetchBanStatus();
    const interval = setInterval(fetchBanStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchBanStatus]);

  useEffect(() => {
    if (!banInfo?.banned || !banInfo.expires_at) { setBanCountdown(""); return; }
    const update = () => {
      const ms = new Date(banInfo.expires_at!).getTime() - Date.now();
      if (ms <= 0) { setBanCountdown(""); setBanInfo({ banned: false }); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setBanCountdown(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [banInfo]);

  useEffect(() => {
    if (session && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [session]);

  useEffect(() => {
    if (prevMatchRef.current === null && activeMatch) {
      try {
        const ctx = audioCtxRef.current || new AudioContext();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") ctx.resume();
        function playTone(freq: number, start: number, duration: number) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
          osc.connect(gain).connect(ctx.destination);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration);
        }
        playTone(880, 0, 0.15);
        playTone(1100, 0.15, 0.2);
      } catch {}
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Match Found!", { body: "Your match is ready. Check the queue page.", icon: heroImg });
      }
    }
    prevMatchRef.current = activeMatch;
  }, [activeMatch]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  useEffect(() => {
    fetchParty();
    const interval = setInterval(fetchParty, 3000);
    return () => clearInterval(interval);
  }, [fetchParty]);

  useEffect(() => {
    fetchActiveMatch();
    const interval = setInterval(fetchActiveMatch, 3000);
    return () => clearInterval(interval);
  }, [fetchActiveMatch]);

  const inQueue = session ? players.some((p) => p.user_id === session.user_id) : false;
  const myPlayer = session ? players.find((p) => p.user_id === session.user_id) : null;
  const count = players.length;

  const partyMembers = myParty
    ? [myParty.leader_id, ...myParty.members]
    : [];

  function getTimeInQueue(joinedAt: string): string {
    const now = new Date();
    const joined = new Date(joinedAt);
    const diffMs = now.getTime() - joined.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    if (diffMins > 0) return `${diffMins}m ${diffSecs}s`;
    return `${diffSecs}s`;
  }

  function partyMemberName(userId: string): string {
    const p = players.find((pl) => pl.user_id === userId);
    return p?.username || "Unknown";
  }

  function partyMemberAvatar(userId: string): string {
    const p = players.find((pl) => pl.user_id === userId);
    return p ? avatarUrl(p) : "";
  }

  async function handleJoin() {
    if (!session) return;
    setLoading(true);
    try {
      const guildId = getGuildId();
      await fetch(`/api/queue/join${guildId ? `?guildId=${guildId}` : ""}`, {
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
      const guildId = getGuildId();
      await fetch(`/api/queue/leave${guildId ? `?guildId=${guildId}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: session.user_id }),
      });
      await fetchQueue();
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateParty() {
    if (!session) return;
    setPartyLoading(true);
    try {
      const guildId = getGuildId();
      const res = await fetch("/api/party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMyParty(data.party);
        toast.success("Party created!");
        await fetchQueue();
      } else {
        toast.error(data.error || "Failed to create party");
      }
    } finally {
      setPartyLoading(false);
    }
  }

  async function handleLeaveParty() {
    if (!myParty || !session) return;
    setPartyLoading(true);
    try {
      const guildId = getGuildId();
      const res = await fetch("/api/party/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId: myParty.id, guildId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMyParty(null);
        toast.success(isPartyLeader ? "Party disbanded" : "Left party");
        await fetchQueue();
        await fetchParty();
      } else {
        toast.error(data.error || "Failed to leave party");
      }
    } finally {
      setPartyLoading(false);
    }
  }

  async function handleInvite(targetUserId: string, targetUsername: string) {
    if (!myParty || !session) return { ok: false, error: "Not logged in" };
    const guildId = getGuildId();
    const res = await fetch("/api/party/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partyId: myParty.id,
        targetUserId,
        targetUsername,
        guildId,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(`Invited ${targetUsername}`);
    } else {
      toast.error(data.error || "Failed to send invite");
    }
    return data;
  }

  async function handleAcceptInvite(invite: Invite) {
    setPartyLoading(true);
    try {
      const guildId = getGuildId();
      const res = await fetch("/api/party/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId: invite.party_id, guildId }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Joined party!");
        await fetchParty();
        await fetchQueue();
      } else {
        toast.error(data.error || "Failed to accept invite");
      }
    } finally {
      setPartyLoading(false);
    }
  }

  async function handleDeclineInvite(invite: Invite) {
    // Remove from list by refetching — the invite stays in DB but we ignore it
    setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
  }

  const isPartyLeader = myParty?.leader_id === session?.user_id;
  const availableToInvite = (allUsers.length > 0 ? allUsers : players).filter(
    (p) => !partyMembers.includes(p.user_id) && p.user_id !== session?.user_id,
  );
  const filteredUsers = availableToInvite.filter((p) =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const guildId = getGuildId();
      const res = await fetch(`/api/queue${guildId ? `?guildId=${guildId}` : ""}`);
      const data = await res.json();
      if (data.players) setAllUsers(data.players);
    } catch {
      // ignore
    } finally {
      setUsersLoading(false);
    }
  }, [session]);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <img src={queueIcon} alt="Queue" className="h-14 w-14 object-contain" />
            <div>
              <h1 className="text-display text-2xl font-bold text-foreground">Matchmaking Queue</h1>
              <p className="text-sm text-muted-foreground">Join the queue and get matched</p>
            </div>
          </div>
          {session && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-success/30 bg-success/5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
              <span className="text-success">Online</span>
            </Badge>
          )}
        </motion.div>


        {/* Invite Banners */}
        <AnimatePresence>
          {session && pendingInvites.map((invite) => (
            <motion.div
              key={invite.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card className="border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <PartyPopper className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium text-foreground">{invite.from_username}</span>
                      <span className="text-muted-foreground"> invited you to a party!</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvite(invite)}
                      disabled={partyLoading}
                      className="gap-1 h-9"
                    >
                      <UserCheck className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineInvite(invite)}
                      className="h-9"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Party Section */}
        {session && (
          <Card className="card-faceit border-border bg-gradient-to-br from-card to-card/50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Party</h2>
                  <p className="text-xs text-muted-foreground">Team up with friends</p>
                </div>
              </div>
              {myParty && (
                <Badge variant="secondary" className="font-mono">
                  {partyMembers.length}/3
                </Badge>
              )}
            </div>

            {!myParty ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    Team up with friends and get queued together on the same side.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleCreateParty}
                    disabled={partyLoading}
                    className="flex-1 gap-2 h-10"
                    variant="default"
                  >
                    {partyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Create Party
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  {partyMembers.map((uid) => {
                    const isLeader = uid === myParty.leader_id;
                    const isSelf = uid === session?.user_id;
                    return (
                      <div
                        key={uid}
                        className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/30"
                      >
                        <Avatar className="h-9 w-9 border-2 border-border">
                          <AvatarImage src={partyMemberAvatar(uid)} alt={partyMemberName(uid)} />
                          <AvatarFallback className="bg-muted text-xs">
                            {partyMemberName(uid).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {partyMemberName(uid)}
                            </span>
                            {isSelf && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">YOU</Badge>
                            )}
                            {isLeader && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30">
                                LEADER
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className={`h-2.5 w-2.5 rounded-full ${inQueue || partyMembers.includes(uid) ? "bg-success" : "bg-muted-foreground/30"}`} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  {isPartyLeader && (
                    <Button
                      onClick={() => { setShowInviteModal(true); setSearchQuery(""); fetchUsers(); }}
                      variant="outline"
                      className="flex-1 gap-2 h-10"
                      disabled={partyMembers.length >= 3}
                    >
                      <UserPlus className="h-4 w-4" />
                      Invite Player
                    </Button>
                  )}
                  <Button
                    onClick={handleLeaveParty}
                    disabled={partyLoading}
                    variant="destructive"
                    className="flex-1 gap-2 h-10"
                  >
                    {partyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserMinus className="h-4 w-4" />
                    )}
                    {isPartyLeader ? "Disband" : "Leave"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Invite Modal */}
        <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
          <DialogContent className="sm:max-w-md border-border/60">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Invite to Party
              </DialogTitle>
              <DialogDescription>
                Search and select a player to invite.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 pl-9 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No players match your search" : "No players available to invite"}
                    </p>
                  </div>
                ) : (
                  filteredUsers.map((p) => (
                    <button
                      key={p.user_id}
                      onClick={async () => {
                        const result = await handleInvite(p.user_id, p.username);
                        if (result.ok) setShowInviteModal(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3 text-left transition-all duration-200 hover:bg-muted/40 hover:border-border/60"
                    >
                      <Avatar className="h-9 w-9 border-2 border-border">
                        <AvatarImage src={avatarUrl(p)} alt={p.username} />
                        <AvatarFallback className="bg-muted text-xs">
                          {p.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{p.username}</div>
                      </div>
                      <UserPlus className="h-4 w-4 shrink-0 text-primary/70 group-hover:text-primary" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Queue Action Card */}
        <Card className="card-faceit border-border/60 bg-gradient-to-br from-card to-card/80 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={statusIcon} alt="Status" className="h-10 w-10 object-contain" />
              <div>
                <h2 className="font-semibold text-foreground">Queue Status</h2>
                <p className="text-xs text-muted-foreground">Ready to play</p>
              </div>
            </div>
            {myPlayer && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                <Timer className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-semibold text-primary">
                  {getTimeInQueue(myPlayer.joined_at)}
                </span>
              </div>
            )}
          </div>

          {!session ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-6 text-center">
                <Shield className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Login with Discord to join the matchmaking queue
                </p>
              </div>
              <Button asChild className="w-full gap-2 h-12 text-base bg-[#5865F2] text-white hover:bg-[#4752c4]">
                <a href="/api/auth/discord">
                  <LogIn className="h-5 w-5" /> Login with Discord
                </a>
              </Button>
            </div>
          ) : banInfo?.banned ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                    <X className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-destructive">Banned from Queue</div>
                    <div className="text-sm text-muted-foreground">
                      Expires in {banCountdown}
                      {banInfo.reason ? ` — ${banInfo.reason}` : ""}
                    </div>
                  </div>
                </div>
              </div>
              <Button disabled className="w-full gap-2 h-12 text-base opacity-50 cursor-not-allowed">
                <Users className="h-5 w-5" />
                Join Queue
              </Button>
            </div>
          ) : inQueue ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                    <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" />
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
                className="w-full gap-2 h-12 text-base"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Leave Queue
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleJoin} 
              disabled={loading} 
              className="w-full gap-2 h-12 text-base bg-primary hover:bg-primary/90 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
              Join Queue
            </Button>
          )}
        </Card>

        {/* Players List */}
        <Card className="border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Players in Queue</h2>
            </div>
            <Badge variant="secondary" className="font-mono">{count}</Badge>
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
                  <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3 transition-all duration-200 hover:bg-muted/40 hover:border-border/60">
                    <div className="relative">
                      <Avatar className="h-10 w-10 border-2 border-border">
                        <AvatarImage src={avatarUrl(p)} alt={p.username} />
                        <AvatarFallback className="bg-muted text-xs">
                          {p.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-foreground">{p.username}</div>
                        {p.user_id === session?.user_id && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">YOU</Badge>
                        )}
                        {partyMembers.includes(p.user_id) && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30">
                            PARTY
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: RANK_COLORS[rankFromElo(p.elo)] }}
                        >
                          {rankFromElo(p.elo)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                          <TrendingUp className="h-3 w-3" />
                          {p.elo}
                        </span>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {getTimeInQueue(p.joined_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {players.length === 0 && !loading && (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/30">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="mt-4 text-sm font-medium text-muted-foreground">Queue is empty</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
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

      {/* Match Found Overlay */}
      <AnimatePresence>
        {activeMatch && session && (
          <BanOverlay
            match={activeMatch}
            session={session}
            players={matchPlayers}
            onMapSelected={() => { setActiveMatch(null); setMatchPlayers([]); }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
