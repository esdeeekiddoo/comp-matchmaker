import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getPlayers } from "@/lib/supabase-queries";

export const Route = createFileRoute("/track")({
  loader: async () => {
    const players = await getPlayers();
    return { players };
  },
  head: () => ({
    meta: [
      { title: "Track — Jail Bird Matchmaking" },
      { name: "description", content: "Track ELO progression and performance trends." },
    ],
  }),
  component: Track,
});

function Track() {
  const { players } = Route.useLoaderData();
  const top = players.slice(0, 10);

  return (
    <AppShell>
      <div className="space-y-6 p-4 lg:p-6">
        <div>
          <div className="section-title flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> Player Rankings
          </div>
          <h1 className="text-display mt-1 text-3xl font-bold">Top Players</h1>
          <p className="text-sm text-muted-foreground">
            Current standings across all tracked players.
          </p>
        </div>

        <Card className="border-border bg-card p-5">
          <div className="space-y-2">
            {top.map((p, i) => {
              const total = p.wins + p.losses;
              const winPct = total > 0 ? Math.round((p.wins / total) * 100) : 0;
              const name = p.username ?? p.discord_id;
              return (
                <div key={p.discord_id} className="flex items-center gap-3 rounded-md bg-muted/30 px-4 py-2.5">
                  <span className="w-6 text-center font-display text-sm font-bold text-muted-foreground">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <span className="font-bold text-primary">{p.elo}</span>
                    <span className="text-muted-foreground"> ELO</span>
                  </div>
                  <div className="w-20 text-right text-xs text-muted-foreground">{winPct}% WR</div>
                </div>
              );
            })}
            {top.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No players tracked yet.</p>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
