import { createFileRoute, Link } from "@tanstack/react-router";
import { Swords } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/matches")({
  loader: async () => {
    const { data } = await supabase
      .from("matches")
      .select("id, region, match_number, selected_map, status, winner, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    return { matches: data ?? [] };
  },
  head: () => ({
    meta: [
      { title: "Match History — Jail Bird Matchmaking" },
      { name: "description", content: "Recent 5v5 ranked matches." },
      { property: "og:title", content: "Jail Bird — Match History" },
    ],
  }),
  component: Matches,
});

function Matches() {
  const { matches } = Route.useLoaderData();

  return (
    <AppShell>
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
              <Card className="group border-border bg-card p-4 transition hover:border-primary/50">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-border text-[10px]">
                      #{m.match_number}
                    </Badge>
                    <span>{m.region}</span>
                  </div>
                  <Badge className={m.status === "active" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}>
                    {m.status}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-display truncate text-lg font-bold">{m.selected_map ?? "Voting"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-display text-lg font-bold">
                    {m.winner ? (
                      <Badge className={m.winner === "atk" ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"}>
                        {m.winner === "atk" ? "🔴 ATK" : "🔵 DEF"} Wins
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-border">Pending</Badge>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {matches.length === 0 && (
            <p className="col-span-2 py-10 text-center text-sm text-muted-foreground">No matches yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
