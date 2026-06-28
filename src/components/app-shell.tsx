import type { ReactNode } from "react";
import { Bell, Search, MessageCircle } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
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
              <Button
                size="sm"
                onClick={() =>
                  toast("Discord login coming soon", {
                    description: "Queue runs through our Discord bots.",
                  })
                }
                className="hidden gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4] sm:inline-flex"
              >
                <MessageCircle className="h-4 w-4" />
                Login with Discord
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-muted text-xs">YOU</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
