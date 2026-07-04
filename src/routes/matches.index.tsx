import { createFileRoute, Link } from "@tanstack/react-router";
import { Swords, MapPin, Clock, Trophy, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import { getMapImage } from "@/lib/maps";
import { parseSession, getActiveGuildId } from "@/lib/session";

export const Route = createFileRoute("/matches/")({
  loader: async () => {
    const guildId = typeof window !== "undefined" ? getActiveGuildId(parseSession()) : undefined;
    let query = supabase
      .from("matches")
      .select("id, region, match_number, selected_map, status, winner, created_at, guild_id")
      .order("created_at", { ascending: false })
      .limit(20);
    if (guildId) query = query.eq("guild_id", guildId);
    const { data } = await query;
    return { matches: data ?? [] };
  },
  component: MatchesList,
});

function MatchesList() {
  const { matches } = Route.useLoaderData();

  return (
    <AppShell>
      <div className="space-y-6 p-4 lg:p-6">
        <div>
          <div className="section-title flex items-center gap-2">
            <Swords className="h-3.5 w-3.5" /> Match History
          </div>
          <h1 className="text-display mt-1 text-2xl font-bold sm:text-3xl">Recent Matches</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{matches.length} matches · all regions</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {matches.map((m) => (
            <Link key={m.id} to="/matches/$id" params={{ id: m.id }}>
              <Card className="card-faceit group flex h-28 overflow-hidden border-border/60 bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                {(() => {
                  const img = getMapImage(m.selected_map);
                  return img ? (
                    <div className="relative w-40 shrink-0 overflow-hidden">
                      <img
                        src={img}
                        alt={m.selected_map ?? ""}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/80" />
                    </div>
                  ) : (
                    <div className="flex w-40 shrink-0 items-center justify-center bg-muted/50">
                      <MapPin className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  );
                })()}
                <div className="flex flex-1 flex-col justify-center p-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Badge variant="outline" className="border-border text-[10px] font-mono">
                      #{m.match_number}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {m.region}
                    </span>
                    {m.winner ? (
                      <Badge
                        className={
                          m.winner === "atk"
                            ? "bg-red-500/15 text-red-400 border-red-500/30"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        }
                      >
                        <Trophy className="mr-1 h-3 w-3" />
                        {m.winner === "atk" ? "T" : "CT"} Wins
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <div className="text-display mt-1.5 truncate text-lg font-bold text-foreground">
                    {m.selected_map ?? "Voting"}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center pr-4 text-muted-foreground/50 group-hover:text-primary transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </Card>
            </Link>
          ))}
          {matches.length === 0 && (
            <Card className="col-span-2 flex flex-col items-center justify-center py-16 border-border/40 bg-card/50">
              <Swords className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">No matches yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Matches will appear here after they're played</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
