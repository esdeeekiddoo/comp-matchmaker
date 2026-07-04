import { createFileRoute, Link } from "@tanstack/react-router";
import { Swords } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <div className="section-title flex items-center gap-2">
          <Swords className="h-3.5 w-3.5" /> Match History
        </div>
        <h1 className="text-display mt-1 text-3xl font-bold">Recent Matches</h1>
        <p className="text-sm text-muted-foreground">{matches.length} matches · all regions</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {matches.map((m) => (
          <Link key={m.id} to="/matches/$id" params={{ id: m.id }}>
            <Card className="group flex h-24 overflow-hidden border-border/60 bg-card transition hover:border-primary/30">
              {(() => {
                const img = getMapImage(m.selected_map);
                return img ? (
                  <div className="relative w-36 shrink-0 overflow-hidden">
                    <img
                      src={img}
                      alt={m.selected_map ?? ""}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background" />
                  </div>
                ) : null;
              })()}
              <div className="flex flex-1 flex-col justify-center p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Badge variant="outline" className="border-border text-[10px]">
                    #{m.match_number}
                  </Badge>
                  <span>{m.region}</span>
                  {m.winner ? (
                    <Badge
                      className={
                        m.winner === "atk"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-blue-500/15 text-blue-400"
                      }
                    >
                      {m.winner === "atk" ? "T" : "CT"} Wins
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-border">
                      Pending
                    </Badge>
                  )}
                </div>
                <div className="text-display mt-1 truncate text-base font-bold">
                  {m.selected_map ?? "Voting"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {matches.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-muted-foreground">
            No matches yet.
          </p>
        )}
      </div>
    </div>
  );
}
