import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import caplLogo from "@/assets/APL.png";
import counterbloxIcon from "@/assets/CAPL (2).png";
import bloxstrikeIcon from "@/assets/BAPL.png";
import { getGuildInfo } from "@/lib/guild-info";
import { avatarUrl } from "@/lib/supabase-queries";
import { parseSession, getActiveGuildId, setActiveGuildId, type Session } from "@/lib/session";
import { BackgroundEffects } from "@/components/background-effects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const GUILD_ICONS: Record<string, string> = {
  "1484564086074380311": counterbloxIcon,
  "1522610593465368737": bloxstrikeIcon,
};

const NAV_LINKS = [
  { title: "Home", url: "/", exact: true },
  { title: "Profile", url: "/profile" },
  { title: "Queue", url: "/queue" },
  { title: "Leaderboard", url: "/leaderboard" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [activeGuild, setActiveGuild] = useState<string>("");
  const [online, setOnline] = useState<number | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const s = parseSession();
    setSession(s);
    setActiveGuild(getActiveGuildId(s) || "");
    getGuildInfo()
      .then((d) => setOnline(d.online))
      .catch(() => {});
  }, []);

  function handleGuildChange(guildId: string) {
    setActiveGuild(guildId);
    setActiveGuildId(guildId);
  }

  function handleLogout() {
    document.cookie = "capl_session=; Path=/; Max-Age=0";
    window.location.href = "/";
  }

  function isActive(url: string, exact?: boolean) {
    return exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");
  }

  return (
    <div className="min-h-screen bg-background">
      <BackgroundEffects />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 h-16 border-b border-[rgba(255,85,0,0.18)] bg-[#0b0d0b]/80 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6">
          {/* Logo */}
          <Link to="/" className="mr-8 flex shrink-0 items-center gap-2.5">
            <img src={caplLogo} alt="APL" className="h-9 w-9 object-contain" />
            <span className="font-display text-base font-bold uppercase tracking-wider text-foreground hidden sm:inline">
              APL
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.url}
                to={link.url}
                className={`nav-link ${isActive(link.url, link.exact) ? "active" : ""}`}
              >
                {link.title}
              </Link>
            ))}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Desktop Right Side */}
          <div className="hidden items-center gap-3 md:flex">
            {/* Game Selector */}
            {session && session.guild_ids?.length > 1 && (
              <Select value={activeGuild} onValueChange={handleGuildChange}>
                <SelectTrigger className="h-9 w-[140px] shrink-0 border-[rgba(255,85,0,0.35)] bg-surface text-xs text-foreground shadow-[0_0_16px_rgba(255,85,0,0.1)]">
                  <SelectValue placeholder="Select game" />
                </SelectTrigger>
                <SelectContent>
                  {session.guild_ids.map((g) => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        {GUILD_ICONS[g.id] && (
                          <img src={GUILD_ICONS[g.id]} alt="" className="h-4 w-4 rounded-sm object-cover" />
                        )}
                        {g.game_name ?? g.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* User Area */}
            {!session ? (
              <a href="/api/auth/discord" className="nav-btn nav-btn-solid text-xs">
                Login with Discord
              </a>
            ) : (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border border-[rgba(255,85,0,0.35)]">
                  <AvatarImage src={avatarUrl(session)} alt={session.username} />
                  <AvatarFallback className="bg-surface text-xs text-foreground">
                    {session.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleLogout}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Mobile Game Selector */}
            {session && session.guild_ids?.length > 1 && (
              <Select value={activeGuild} onValueChange={handleGuildChange}>
                <SelectTrigger className="h-9 w-[120px] shrink-0 border-[rgba(255,85,0,0.35)] bg-surface text-[11px] text-foreground">
                  <SelectValue placeholder="Game" />
                </SelectTrigger>
                <SelectContent>
                  {session.guild_ids.map((g) => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        {GUILD_ICONS[g.id] && (
                          <img src={GUILD_ICONS[g.id]} alt="" className="h-4 w-4 rounded-sm object-cover" />
                        )}
                        {g.game_name ?? g.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!session ? (
              <a href="/api/auth/discord" className="nav-btn nav-btn-solid text-[11px] px-3 py-1.5">
                Login
              </a>
            ) : (
              <Avatar className="h-8 w-8 border border-[rgba(255,85,0,0.35)]">
                <AvatarImage src={avatarUrl(session)} alt={session.username} />
                <AvatarFallback className="bg-surface text-xs text-foreground">
                  {session.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}

            <Sheet>
              <SheetTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(255,85,0,0.18)] bg-surface text-foreground transition-colors hover:border-[rgba(255,85,0,0.45)]">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 border-[rgba(255,85,0,0.18)] bg-[#0b0d0b] p-0">
                <div className="flex h-full flex-col">
                  <div className="flex items-center gap-2.5 border-b border-[rgba(255,85,0,0.18)] px-5 py-4">
                    <img src={caplLogo} alt="APL" className="h-8 w-8 object-contain" />
                    <span className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                      APL
                    </span>
                  </div>
                  <nav className="flex flex-col gap-1 p-4">
                    {NAV_LINKS.map((link) => (
                      <SheetClose asChild key={link.url}>
                        <Link
                          to={link.url}
                          className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                            isActive(link.url, link.exact)
                              ? "bg-[rgba(255,85,0,0.1)] text-primary"
                              : "text-muted-foreground hover:bg-surface hover:text-foreground"
                          }`}
                        >
                          {link.title}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                  <div className="mt-auto border-t border-[rgba(255,85,0,0.18)] p-4">
                    {online !== null && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        <span>{online.toLocaleString()} online</span>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="relative z-10">{children}</main>
    </div>
  );
}
