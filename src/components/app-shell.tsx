import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Bell, Search, MessageCircle, LogOut, Gamepad2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { avatarUrl } from "@/lib/supabase-queries";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppSidebar } from "@/components/app-sidebar";
import { BackgroundEffects } from "@/components/background-effects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseSession, getActiveGuildId, setActiveGuildId, type Session } from "@/lib/session";
import counterbloxIcon from "@/assets/CAPL (2).png";
import bloxstrikeIcon from "@/assets/BAPL.png";

const GUILD_ICONS: Record<string, string> = {
  "1484564086074380311": counterbloxIcon,
  "1522610593465368737": bloxstrikeIcon,
};

export function AppShell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [activeGuild, setActiveGuild] = useState<string>("");

  useEffect(() => {
    const s = parseSession();
    setSession(s);
    setActiveGuild(getActiveGuildId(s) || "");
  }, []);

  function handleGuildChange(guildId: string) {
    setActiveGuild(guildId);
    setActiveGuildId(guildId);
  }

  function handleLogout() {
    document.cookie = "capl_session=; Path=/; Max-Age=0";
    window.location.href = "/";
  }
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <BackgroundEffects />
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-5">
            <SidebarTrigger />
            {session && session.guild_ids?.length > 1 && (
              <Select value={activeGuild} onValueChange={handleGuildChange}>
                <SelectTrigger className="h-8 w-[140px] shrink-0 border-border bg-muted text-xs sm:w-[160px]">
                  <Gamepad2 className="mr-1 h-3.5 w-3.5 shrink-0 text-primary" />
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
            <div className="relative hidden min-w-0 flex-1 md:block md:max-w-xs lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search players, matches…"
                className="h-9 w-full border-border bg-muted pl-9 text-sm"
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              {!session ? (
                <Button
                  asChild
                  size="sm"
                  className="hidden gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4] sm:inline-flex"
                >
                  <a href="/api/auth/discord">
                    <MessageCircle className="h-4 w-4" />
                    Login
                  </a>
                </Button>
              ) : (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hidden h-8 w-8 text-muted-foreground hover:text-foreground sm:inline-flex"
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={avatarUrl(session)} alt={session.username} />
                    <AvatarFallback className="bg-muted text-xs">
                      {session.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleLogout}
                    className="hidden h-8 w-8 text-muted-foreground hover:text-foreground sm:inline-flex"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </header>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
