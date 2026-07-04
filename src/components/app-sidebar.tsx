import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, Swords, Users, ListOrdered, User } from "lucide-react";
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
  { title: "Queue", url: "/queue", icon: ListOrdered },
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
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center">
            <img src={caplLogo} alt="APL" className="h-7 w-7" />
          </div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="text-display text-sm font-extrabold uppercase tracking-wider">
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
                  >
                    <Link to={item.url}>
                      <item.icon />
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
        <div className="flex items-center gap-2">
          <Users className="h-3 w-3 text-success" />
          <span>{online !== null ? `${online.toLocaleString()} online` : "—"}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
