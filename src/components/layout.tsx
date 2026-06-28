import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, BarChart3, History, LayoutDashboard, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { signOut } from "~/lib/auth-client";
import { cn } from "~/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Übersicht", icon: LayoutDashboard },
  { to: "/statistics", label: "Statistik", icon: BarChart3 },
  { to: "/history", label: "Verlauf", icon: History },
  { to: "/settings", label: "Einstellungen", icon: Settings },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    await signOut();
    queryClient.clear();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Activity className="size-5 text-primary" />
            <span>DiaTrack</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Abmelden">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-10">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-5xl items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground transition-colors [&.active]:text-primary",
              )}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
