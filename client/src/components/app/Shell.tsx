import { Link, useLocation } from "wouter";
import { Moon, Sun, LayoutGrid, Trophy, UserRound } from "lucide-react";
import { Logo } from "./Logo";
import { useApp } from "@/lib/player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Сценарии", icon: LayoutGrid },
  { href: "/leaderboard", label: "Рейтинг", icon: Trophy },
  { href: "/profile", label: "Профиль", icon: UserRound },
];

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const [loc] = useLocation();
  const { player, setPlayer, theme, toggleTheme } = useApp();
  return (
    <div className="min-h-full flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-30">
        <div className={cn("mx-auto flex items-center gap-4 px-4 h-14", wide ? "max-w-none" : "max-w-6xl")}>
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" data-testid="link-home">
            <Logo />
            <span>
              ВСМ <span className="text-muted-foreground font-medium">Тренажёр</span>
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1 ml-4">
            {nav.map((n) => {
              const active = n.href === "/" ? loc === "/" : loc.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  data-testid={`link-nav-${n.label}`}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                    active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                  )}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <label className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="size-4" />
              <Input
                value={player}
                onChange={(e) => setPlayer(e.target.value)}
                className="h-8 w-40"
                aria-label="Имя сотрудника"
                data-testid="input-player"
              />
            </label>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Переключить тему" data-testid="button-theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>
      <main className={cn("flex-1 w-full mx-auto px-4 py-6", wide ? "max-w-none" : "max-w-6xl")}>{children}</main>
    </div>
  );
}
