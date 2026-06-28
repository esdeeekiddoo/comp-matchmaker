import { createFileRoute, Link } from "@tanstack/react-router";
import { Rss, Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getPlayers } from "@/lib/supabase-queries";

export const Route = createFileRoute("/feed")({
  loader: async () => {
    const players = await getPlayers();
    return { players };
  },
  head: () => ({
    meta: [
      { title: "Feed — Jail Bird Matchmaking" },
      { name: "description", content: "Live activity feed of matches, rank-ups and tournament news." },
    ],
  }),
  component: Feed,
});

function Feed() {
  const { players } = Route.useLoaderData();

  const events = players.slice(0, 20).map((p) => ({
    time: new Date().toISOString(),
    title: `${p.username ?? p.discord_id} — ${p.elo} ELO`,
    sub: `${p.wins}W ${p.losses}L · season 4`,
    link: { to: "/players/$username" as const, params: { username: p.username ?? p.discord_id } },
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
        <div>
          <div className="section-title flex items-center gap-2">
            <Rss className="h-3.5 w-3.5" /> Activity Feed
          </div>
          <h1 className="text-display mt-1 text-3xl font-bold">Tracked Players</h1>
        </div>

        <div className="space-y-2">
          {events.map((e, i) => (
            <Link key={i} to={e.link.to} params={e.link.params}>
              <Card className="flex items-center gap-4 border-border bg-card p-4 transition hover:border-primary/40">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.sub}</div>
                </div>
              </Card>
            </Link>
          ))}
          {events.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No players tracked yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
