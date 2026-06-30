import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Crown, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { getPlayersByIds, avatarUrl } from "@/lib/supabase-queries";
import { getMapImage } from "@/lib/maps";

export const Route = createFileRoute("/matches/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase.from("matches").select("*").eq("id", params.id).single();
    if (!data) throw notFound();

    const allIds = [...(data.atk_team ?? []), ...(data.def_team ?? [])];
    const players = await getPlayersByIds(allIds);
    const playerMap: Record<string, (typeof players)[0]> = {};
    for (const p of players) playerMap[p.discord_id] = p;

    return { match: data, playerMap };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Match #${loaderData.match.match_number} — CAPL | Counter-Blox APL`
          : "Match — CAPL | Counter-Blox APL",
      },
      {
        name: "description",
        content: loaderData
          ? `Match #${loaderData.match.match_number} · ${loaderData.match.region}`
          : "Match detail",
      },
    ],
  }),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-10 text-center text-muted-foreground">Match not found.</div>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="p-10 text-center text-muted-foreground">
        Couldn't load this match. {(error as Error)?.message}
      </div>
    </AppShell>
  ),
  component: MatchPage,
});

function MatchPage() {
  const { match, playerMap } = Route.useLoaderData();
  const winner = match.winner;
  const eloChanges = (match.elo_changes as Record<string, number>) ?? {};

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="gap-1 text-muted-foreground hover:text-foreground"
      >
        <Link to="/matches">
          <ArrowLeft className="h-4 w-4" /> Back to matches
        </Link>
      </Button>

      <Card className="overflow-hidden border-border bg-card">
        {(() => {
          const img = getMapImage(match.selected_map);
          return img ? (
            <div className="relative h-48 overflow-hidden">
              <img
                src={img}
                alt={match.selected_map ?? ""}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <Badge
                  variant="outline"
                  className="border-border/60 bg-background/60 text-[10px] backdrop-blur-sm"
                >
                  Match #{match.match_number}
                </Badge>
                <h2 className="text-display mt-2 text-2xl font-extrabold text-white drop-shadow-lg">
                  {match.selected_map ?? "Voting"}
                </h2>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <Badge variant="outline" className="border-border text-[10px]">
                Match #{match.match_number}
              </Badge>
              <h2 className="text-display mt-2 text-2xl font-extrabold">
                {match.selected_map ?? "Voting"}
              </h2>
            </div>
          );
        })()}
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{match.region}</span>
          <span>· {new Date(match.created_at).toLocaleString()}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 border-t border-border p-6">
          <div
            className={`text-right ${winner === "atk" ? "text-success" : "text-muted-foreground"}`}
          >
            <div className="text-[10px] uppercase tracking-wider">T</div>
            <div className="text-display text-3xl font-extrabold">
              {winner === "atk" ? "WIN" : "LOSS"}
            </div>
          </div>
          <div className="text-display text-xl font-bold text-muted-foreground">VS</div>
          <div className={`${winner === "def" ? "text-success" : "text-muted-foreground"}`}>
            <div className="text-[10px] uppercase tracking-wider">CT</div>
            <div className="text-display text-3xl font-extrabold">
              {winner === "def" ? "WIN" : "LOSS"}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <TeamCard
          label="T"
          players={match.atk_team}
          hostId={match.host_id}
          winner={winner}
          teamSide="atk"
          playerMap={playerMap}
          eloChanges={eloChanges}
        />
        <TeamCard
          label="CT"
          players={match.def_team}
          hostId={match.host_id}
          winner={winner}
          teamSide="def"
          playerMap={playerMap}
          eloChanges={eloChanges}
        />
      </div>
    </div>
  );
}

function TeamCard({
  label,
  players,
  hostId,
  winner,
  teamSide,
  playerMap,
  eloChanges,
}: {
  label: string;
  players: string[];
  hostId: string;
  winner: string | null;
  teamSide: string;
  playerMap: Record<
    string,
    { discord_id: string; username: string | null; avatar_url: string | null; elo: number }
  >;
  eloChanges: Record<string, number>;
}) {
  const isWinner = winner === teamSide;

  return (
    <Card
      className={`overflow-hidden border-border bg-card ${isWinner ? "ring-1 ring-success/40" : ""}`}
    >
      <div
        className={`flex items-center justify-between border-b px-4 py-3 ${
          isWinner ? "border-success/20 bg-success/10" : "border-border bg-muted/40"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`text-display text-sm font-bold uppercase tracking-wider ${isWinner ? "text-success" : ""}`}
          >
            {label}
          </div>
          {isWinner && <Crown className="h-4 w-4 text-success" />}
        </div>
        <Badge
          className={
            isWinner
              ? "bg-success/20 text-success hover:bg-success/30"
              : "bg-muted text-muted-foreground"
          }
        >
          {isWinner ? "WINNER" : `${players.length} players`}
        </Badge>
      </div>
      {players.map((id) => {
        const p = playerMap[id];
        const change = eloChanges[id];
        const name = p?.username ?? id;
        return (
          <Link
            key={id}
            to={p ? "/players/$username" : "#"}
            params={p ? { username: p.username ?? id } : {}}
            className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm transition last:border-b-0 hover:bg-muted/30"
          >
            <Avatar className="h-7 w-7 border border-border">
              <AvatarImage src={p ? avatarUrl(p) : ""} alt={name} />
              <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            {id === hostId && <Crown className="h-3 w-3 shrink-0 text-primary" />}
            <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
            {change != null && (
              <span
                className={`flex items-center gap-0.5 whitespace-nowrap text-xs font-bold tabular-nums ${
                  change > 0 ? "text-success" : "text-destructive"
                }`}
              >
                {change > 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {Math.abs(change)}
              </span>
            )}
          </Link>
        );
      })}
    </Card>
  );
}

function Minus(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className ?? "h-3 w-3"}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
