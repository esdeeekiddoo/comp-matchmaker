import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, Swords, Users, ListOrdered, User, Zap } from "lucide-react";
import caplLogo from "@/assets/APL.jpg";
import { getGuildInfo } from "@/lib/guild-info";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const primary = [
  { title: "Home", url: "/", icon: Home, exact: true },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Queue", url: "/queue", icon: ListOrdered, accent: true },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Matches", url: "/matches", icon: Swords },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    getGuildInfo()
      .then((d) => setOnline(d.online))
      .catch(() => {});
  }, []);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 border border-primary/20 transition-all group-hover:bg-primary/20">
            <img src={caplLogo} alt="APL" className="h-6 w-6" />
          </div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="text-display text-sm font-extrabold uppercase tracking-wider text-foreground">
              APL
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Asia Premiere League
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url, item.exact)}
                    tooltip={item.title}
                    className={`transition-all duration-200 ${
                      item.accent && isActive(item.url, item.exact)
                        ? "bg-primary/10 text-primary"
                        : ""
                    }`}
                  >
                    <Link to={item.url}>
                      {item.accent ? (
                        <Zap className={isActive(item.url, item.exact) ? "text-primary" : ""} />
                      ) : (
                        <item.icon />
                      )}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 text-[10px] uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2 rounded-lg bg-success/5 px-2 py-1.5 border border-success/10">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-success font-medium">
            {online !== null ? `${online.toLocaleString()} online` : "—"}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
