import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Crown, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/matches/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .eq("id", params.id)
      .single();
    if (!data) throw notFound();
    return { match: data };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Match #${loaderData.match.match_number} — Jail Bird` : "Match — Jail Bird" },
      { name: "description", content: loaderData ? `Match #${loaderData.match.match_number} · ${loaderData.match.region}` : "Match detail" },
    ],
  }),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-10 text-center text-muted-foreground">Match not found.</div>
    </AppShell>
  ),
  errorComponent: () => (
    <AppShell>
      <div className="p-10 text-center text-muted-foreground">Couldn't load this match.</div>
    </AppShell>
  ),
  component: MatchPage,
});

function MatchPage() {
  const { match } = Route.useLoaderData();
  const winner = match.winner;

  return (
    <AppShell>
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

        <Card className="overflow-hidden border-border bg-card p-6">
          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Badge variant="outline" className="border-border text-[10px]">
              Match #{match.match_number}
            </Badge>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {match.selected_map ?? "Voting"}
            </span>
            <span>· {match.region}</span>
            <span>· {new Date(match.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <div className={`text-right ${winner === "atk" ? "text-success" : "text-muted-foreground"}`}>
              <div className="text-[10px] uppercase tracking-wider">🔴 ATK</div>
              <div className="text-display text-3xl font-extrabold">
                {winner === "atk" ? "WIN" : "—"}
              </div>
            </div>
            <div className="text-display text-xl font-bold text-muted-foreground">VS</div>
            <div className={`${winner === "def" ? "text-success" : "text-muted-foreground"}`}>
              <div className="text-[10px] uppercase tracking-wider">🔵 DEF</div>
              <div className="text-display text-3xl font-extrabold">
                {winner === "def" ? "WIN" : "—"}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <TeamCard label="🔴 ATK" players={match.atk_team} hostId={match.host_id} />
          <TeamCard label="🔵 DEF" players={match.def_team} hostId={match.host_id} />
        </div>
      </div>
    </AppShell>
  );
}

function TeamCard({ label, players, hostId }: { label: string; players: string[]; hostId: string }) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <div className="text-display text-sm font-bold uppercase tracking-wider">{label}</div>
        <Badge className="bg-muted text-muted-foreground">{players.length} players</Badge>
      </div>
      {players.map((id) => (
        <div
          key={id}
          className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 text-sm last:border-b-0"
        >
          {id === hostId && <Crown className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className="font-medium">{id}</span>
        </div>
      ))}
    </Card>
  );
}
