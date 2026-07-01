import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Bell, Search, MessageCircle, LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { avatarUrl } from "@/lib/supabase-queries";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppSidebar } from "@/components/app-sidebar";
import { BackgroundEffects } from "@/components/background-effects";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function parseSession(): { user_id: string; username: string; avatar_url: string } | null {
  if (typeof window === "undefined") return null;
  const cookie = getCookie("capl_session");
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ReturnType<typeof parseSession>>(null);

  useEffect(() => {
    setSession(parseSession());
  }, []);

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
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-5">
            <SidebarTrigger />
            <div className="relative hidden md:block md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search players, matches…"
                className="h-9 border-border bg-muted pl-9 text-sm"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {!session ? (
                <Button
                  asChild
                  size="sm"
                  className="hidden gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4] sm:inline-flex"
                >
                  <a href="/api/auth/discord">
                    <MessageCircle className="h-4 w-4" />
                    Login with Discord
                  </a>
                </Button>
              ) : (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
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
                    size="sm"
                    variant="ghost"
                    onClick={handleLogout}
                    className="hidden gap-2 text-muted-foreground hover:text-foreground sm:inline-flex"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
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
