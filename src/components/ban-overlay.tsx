import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2, Shield, ShieldX, Map, Clock, Users,
  Sword, CheckCircle2,
} from "lucide-react";
import { avatarUrl } from "@/lib/supabase-queries";
import { MAP_POOL, getMapImage } from "@/lib/maps";

type BanMatchRow = {
  id: string;
  match_number: number;
  region: string;
  atk_team: string[];
  def_team: string[];
  selected_map: string | null;
  status: string;
  bans: string[];
  banners: Record<string, string>;
  ban_deadline: string;
  created_at: string;
};

type PlayerInfo = {
  user_id: string;
  username: string;
  avatar_url: string;
};

type Props = {
  match: BanMatchRow;
  session: { user_id: string; username: string; avatar_url: string };
  players: PlayerInfo[];
  onMapSelected: () => void;
};

export function BanOverlay({ match, session, players, onMapSelected }: Props) {
  const [bans, setBans] = useState<string[]>(match.bans || []);
  const [selectedMap, setSelectedMap] = useState<string | null>(match.selected_map);
  const [banning, setBanning] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(-1);

  const userIsBanner = match.banners?.atk === session.user_id || match.banners?.def === session.user_id;
  const isAtkBanner = match.banners?.atk === session.user_id;
  const myTeam = isAtkBanner ? "atk" : "def";
  const remainingMaps = MAP_POOL.filter((m) => !bans.includes(m));
  const myBanCount = myTeam === "atk"
    ? bans.filter((_, i) => i % 2 === 0).length
    : bans.filter((_, i) => i % 2 === 1).length;
  const atkTurn = bans.length % 2 === 0;
  const myTurn = atkTurn ? isAtkBanner : !isAtkBanner;
  const canBan = userIsBanner && myBanCount < 2 && myTurn && !selectedMap;

  useEffect(() => {
    const deadline = new Date(match.ban_deadline).getTime();
    const update = () => setTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [match.ban_deadline]);

  useEffect(() => {
    if (match.selected_map) {
      setSelectedMap(match.selected_map);
    }
  }, [match.selected_map]);

  useEffect(() => {
    if (match.bans) setBans(match.bans);
  }, [match.bans]);

  useEffect(() => {
    if (selectedMap || timeLeft > 0) return;
    console.log("[ban-overlay] timeLeft=0, starting auto-pick polling");
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/match/ban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user_id, matchId: match.id, mapName: "__auto__" }),
        });
        const data = await res.json();
        console.log("[ban-overlay] auto-pick response:", JSON.stringify(data));
        if (data.discord && !data.discord.notified) {
          console.error("[ban-overlay] DISCORD EMBED FAILED:", data.discord.error);
        }
        if (data.ok) {
          setBans(data.bans);
          if (data.selected_map) {
            setSelectedMap(data.selected_map);
            clearInterval(interval);
            setTimeout(onMapSelected, 2000);
          }
        }
      } catch (err) {
        console.error("[ban-overlay] auto-pick error:", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [timeLeft, selectedMap]);

  const handleBan = useCallback(async (mapName: string) => {
    if (!canBan || banning) return;
    setBanning(mapName);
    try {
      const res = await fetch("/api/match/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user_id,
          matchId: match.id,
          mapName,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBans(data.bans);
        if (data.selected_map) {
          setSelectedMap(data.selected_map);
          setTimeout(onMapSelected, 2000);
        }
      }
    } finally {
      setBanning(null);
    }
  }, [canBan, banning, session, match.id, onMapSelected]);

  function playerName(userId: string): string {
    const p = players.find((pl) => pl.user_id === userId);
    return p?.username || "Unknown";
  }

  function playerAvatarUrl(userId: string): string {
    const p = players.find((pl) => pl.user_id === userId);
    return p ? avatarUrl(p) : "";
  }

  const atkBans = bans.filter((_, i) => i % 2 === 0);
  const defBans = bans.filter((_, i) => i % 2 === 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20"
          >
            <Sword className="h-8 w-8 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-bold">Match #{match.match_number} Found!</h2>
          <p className="mt-1 text-muted-foreground">{match.region}</p>
        </div>

        {/* Timer */}
        <div className="flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
                className="text-muted-foreground/20" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - timeLeft / 60)}`}
                className="text-primary transition-all duration-500"
                strokeLinecap="round" />
            </svg>
            <span className="text-xl font-bold tabular-nums">
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* Teams */}
        <div className="grid grid-cols-2 gap-4">
          {/* T Team */}
          <Card className="border-red-500/30 bg-red-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">T ({match.atk_team.length})</span>
              {isAtkBanner && <Badge variant="outline" className="ml-auto border-red-400/40 text-[10px] text-red-400">YOU</Badge>}
            </div>
            <div className="space-y-1.5">
              {match.atk_team.map((uid) => (
                <div key={uid} className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={playerAvatarUrl(uid)} alt={playerName(uid)} />
                    <AvatarFallback className="text-[9px]">{playerName(uid).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm">{playerName(uid)}</span>
                  {match.banners?.atk === uid && (
                    <Shield className="h-3.5 w-3.5 text-red-400" />
                  )}
                </div>
              ))}
            </div>
            {atkBans.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {atkBans.map((m) => (
                  <Badge key={m} variant="outline" className="border-red-400/30 text-[10px] text-red-400 line-through">
                    <ShieldX className="mr-1 h-3 w-3" />{m}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          {/* CT Team */}
          <Card className="border-blue-500/30 bg-blue-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-400">CT ({match.def_team.length})</span>
              {!isAtkBanner && userIsBanner && <Badge variant="outline" className="ml-auto border-blue-400/40 text-[10px] text-blue-400">YOU</Badge>}
            </div>
            <div className="space-y-1.5">
              {match.def_team.map((uid) => (
                <div key={uid} className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={playerAvatarUrl(uid)} alt={playerName(uid)} />
                    <AvatarFallback className="text-[9px]">{playerName(uid).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm">{playerName(uid)}</span>
                  {match.banners?.def === uid && (
                    <Shield className="h-3.5 w-3.5 text-blue-400" />
                  )}
                </div>
              ))}
            </div>
            {defBans.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {defBans.map((m) => (
                  <Badge key={m} variant="outline" className="border-blue-400/30 text-[10px] text-blue-400 line-through">
                    <ShieldX className="mr-1 h-3 w-3" />{m}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        </div>

        {selectedMap ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <p className="text-lg font-bold">Map Selected</p>
            <p className="text-primary">{selectedMap}</p>
            <p className="mt-1 text-sm text-muted-foreground">Join your team voice channels in Discord</p>
          </motion.div>
        ) : (
          <>
            {/* Map Ban Grid */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Map className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Ban a Map</span>
                </div>
                {userIsBanner && canBan ? (
                  <span className="text-xs text-muted-foreground">Click a map to ban</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {userIsBanner ? "Waiting for other captain..." : `Waiting for ${atkTurn ? "ATK" : "DEF"} captain...`}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {MAP_POOL.map((mapName) => {
                  const isBanned = bans.includes(mapName);
                  const mapImg = getMapImage(mapName);
                  return (
                    <motion.button
                      key={mapName}
                      layout
                      onClick={() => handleBan(mapName)}
                      disabled={isBanned || banning === mapName || !canBan || timeLeft === 0}
                      className={`relative flex flex-col items-center gap-0 overflow-hidden rounded-xl border text-center transition-all ${
                        isBanned
                          ? "border-muted-foreground/20 opacity-40"
                          : canBan && timeLeft > 0
                            ? "border-primary/30 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 cursor-pointer"
                            : "border-border"
                      }`}
                      whileTap={canBan ? { scale: 0.95 } : undefined}
                      whileHover={canBan ? { scale: 1.03 } : undefined}
                    >
                      <div className="relative h-16 w-full overflow-hidden">
                        {mapImg ? (
                          <img
                            src={mapImg}
                            alt={mapName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted/50">
                            <Map className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                        {isBanned && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                            <ShieldX className="h-8 w-8 text-destructive" />
                          </div>
                        )}
                      </div>
                      <span className="w-full bg-card/80 py-1.5 text-xs font-semibold text-foreground">{mapName}</span>
                      {banning === mapName && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Info */}
            <p className="text-center text-xs text-muted-foreground">
              Each team bans two maps. The remaining map is played.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
