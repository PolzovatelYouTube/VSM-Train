import { Link, useLocation } from "wouter";
import { LayoutGrid, LogOut, Moon, Sun, Trophy, UserRound, UsersRound } from "lucide-react";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { useApp } from "@/lib/player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Сценарии", icon: LayoutGrid },
  { href: "/leaderboard", label: "Рейтинг", icon: Trophy },
  { href: "/profile", label: "Профиль", icon: UserRound },
  { href: "/team", label: "Бригада", icon: UsersRound },
];

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const [loc] = useLocation();
  const { player, user, logout, theme, toggleTheme } = useApp();

  return (
    <div className="rzd-page flex min-h-full flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-card/92 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-black tracking-tight" data-testid="link-home">
            <Logo size={40} />
            <span className="leading-tight">
              ВСМ <span className="block text-xs font-bold uppercase text-[hsl(var(--danger))]">Тренажер</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {nav.filter((n) => n.href !== "/team" || user?.role === "supervisor").map((n) => {
              const active = n.href === "/" ? loc === "/" : loc.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  data-testid={`link-nav-${n.label}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                    active ? "bg-[hsl(var(--danger))] text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
              <UserRound className="size-4" />
              <span>{player}</span>
              {user?.role === "supervisor" && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">руководитель</span>}
            </div>
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Выйти" data-testid="button-logout">
              <LogOut className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Переключить тему" data-testid="button-theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-8", wide ? "max-w-none" : "max-w-[1500px]")}>
        {children}
      </main>
    </div>
  );
}
