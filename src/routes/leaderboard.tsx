import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Trophy, Search, TrendingUp, Flame } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getPlayers, getPeriodLeaderboard, avatarUrl, type PlayerRow, type PeriodPlayerRow } from "@/lib/supabase-queries";
import { parseSession, getActiveGuildId } from "@/lib/session";

type Tab = "all" | "week" | "month";

const tabs: { key: Tab; label: string }[] = [
  { key: "all", label: "Season 1" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

export const Route = createFileRoute("/leaderboard")({
  loader: async () => {
    const guildId = typeof window !== "undefined" ? getActiveGuildId(parseSession()) : undefined;
    const [all, weekly, monthly] = await Promise.all([
      getPlayers(guildId),
      getPeriodLeaderboard(7, guildId),
      getPeriodLeaderboard(30, guildId),
    ]);
    return { all, weekly, monthly };
  },
  head: () => ({
    meta: [
      { title: "Leaderboard — CAPL | Counter-Blox APL" },
      { name: "description", content: "Top ranked 5v5 players sorted by ELO." },
      { property: "og:title", content: "CAPL | Counter-Blox APL — Leaderboard" },
      { property: "og:description", content: "Climb the ranked ladder." },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const { all, weekly, monthly } = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const currentData = tab === "all" ? all : tab === "week" ? weekly : monthly;

  const rows = useMemo(() => {
    return currentData
      .filter((p: any) => (p.username ?? p.discord_id).toLowerCase().includes(q.toLowerCase()))
      .sort((a: any, b: any) => {
        if (tab === "all") return b.elo - a.elo;
        return (b as PeriodPlayerRow).elo_gained - (a as PeriodPlayerRow).elo_gained;
      });
  }, [q, currentData, tab]);

  return (
    <AppShell>
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-title flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" /> Leaderboard
            </div>
            <h1 className="text-display mt-1 text-3xl font-bold">Season 1 Ladder</h1>
            <p className="text-sm text-muted-foreground">
              Live standings across all regions · Updated every match
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search player"
              className="h-9 w-52 border-border bg-muted pl-9"
            />
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.key === "week" || t.key === "month" ? (
                <span className="inline-flex items-center gap-1.5">
                  {t.key === "week" ? <TrendingUp className="h-3.5 w-3.5" /> : <Flame className="h-3.5 w-3.5" />}
                  {t.label}
                </span>
              ) : (
                t.label
              )}
            </button>
          ))}
        </div>

        {tab === "all" ? (
          <AllTimeTable rows={rows as PlayerRow[]} q={q} />
        ) : (
          <PeriodTable rows={rows as PeriodPlayerRow[]} q={q} />
        )}
      </div>
    </AppShell>
  );
}

function AllTimeTable({ rows }: { rows: PlayerRow[]; q: string }) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <div className="grid grid-cols-[60px_minmax(0,1fr)_90px_80px_80px] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Rank</span>
        <span>Player</span>
        <span className="text-right">ELO</span>
        <span className="text-right">W/L</span>
        <span className="text-right">Win%</span>
      </div>
      <div>
        {rows.map((p, i) => {
          const total = p.wins + p.losses;
          const winPct = total > 0 ? Math.round((p.wins / total) * 100) : 0;
          const name = p.username ?? p.discord_id;
          return (
            <Link
              key={p.discord_id}
              to="/players/$username"
              params={{ username: name }}
              className="grid grid-cols-[60px_minmax(0,1fr)_90px_80px_80px] items-center gap-3 border-b border-border/60 px-4 py-3 transition last:border-b-0 hover:bg-muted/40"
            >
              <div className="flex items-center gap-1.5">
                <span className={`font-display text-sm font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                  #{i + 1}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage src={avatarUrl(p)} />
                  <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="truncate text-sm font-medium">{name}</div>
              </div>
              <div className="text-right font-display font-bold text-primary">{p.elo}</div>
              <div className="text-right text-sm tabular-nums">
                <span className="text-success">{p.wins}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-destructive">{p.losses}</span>
              </div>
              <div className="text-right text-sm font-semibold tabular-nums">{winPct}%</div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No players yet. Matches are tracked after they end.
          </div>
        )}
      </div>
    </Card>
  );
}

function PeriodTable({ rows }: { rows: PeriodPlayerRow[]; q: string }) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <div className="grid grid-cols-[60px_minmax(0,1fr)_90px_80px_80px] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Rank</span>
        <span>Player</span>
        <span className="text-right">+/- ELO</span>
        <span className="text-right">W/L</span>
        <span className="text-right">Matches</span>
      </div>
      <div>
        {rows.map((p, i) => {
          const periodTotal = p.period_wins + p.period_losses;
          const periodWinPct = periodTotal > 0 ? Math.round((p.period_wins / periodTotal) * 100) : 0;
          const name = p.username ?? p.discord_id;
          const gained = p.elo_gained;
          return (
            <Link
              key={p.discord_id}
              to="/players/$username"
              params={{ username: name }}
              className="grid grid-cols-[60px_minmax(0,1fr)_90px_80px_80px] items-center gap-3 border-b border-border/60 px-4 py-3 transition last:border-b-0 hover:bg-muted/40"
            >
              <div className="flex items-center gap-1.5">
                <span className={`font-display text-sm font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                  #{i + 1}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage src={avatarUrl(p)} />
                  <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="truncate text-sm font-medium">{name}</div>
              </div>
              <div className={`text-right font-display font-bold tabular-nums ${gained > 0 ? "text-success" : gained < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {gained > 0 ? "+" : ""}{gained}
              </div>
              <div className="text-right text-sm tabular-nums">
                <span className="text-success">{p.period_wins}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-destructive">{p.period_losses}</span>
              </div>
              <div className="text-right text-sm font-semibold tabular-nums text-muted-foreground">
                {periodTotal > 0 ? `${periodWinPct}%` : "—"}
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No matches in this period.
          </div>
        )}
      </div>
    </Card>
  );
}
