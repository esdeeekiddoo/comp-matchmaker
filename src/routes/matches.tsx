import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "Match History — APL" },
      { name: "description", content: "Recent 5v5 ranked matches." },
      { property: "og:title", content: "APL — Match History" },
    ],
  }),
  component: MatchesLayout,
});

function MatchesLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
