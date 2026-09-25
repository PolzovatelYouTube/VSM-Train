import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, Sparkles, Target, Flame, Trophy, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/player";
import { useNotifications, useMarkRead } from "@/lib/api";
import type { NotificationType } from "@shared/schema";

const ICON: Record<NotificationType, typeof Bell> = {
  new_scenario: Sparkles,
  challenge_started: Target,
  points_expiring: Flame,
  achievement: Trophy,
  level_up: TrendingUp,
};

/** Колокольчик в шапке: счётчик непрочитанных и список; клик — отметить прочитанным и перейти */
export function NotificationBell() {
  const { player } = useApp();
  const { data = [] } = useNotifications(player);
  const markRead = useMarkRead();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const unread = data.filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label={`Уведомления: ${unread} новых`} data-testid="button-notifications">
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[hsl(var(--danger))] text-white text-[10px] font-mono leading-4 text-center" data-testid="badge-unread">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-11 z-50 w-80 max-h-96 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg" data-testid="panel-notifications">
            <div className="px-3 py-2 border-b text-sm font-semibold">Уведомления</div>
            {!data.length && <p className="p-3 text-sm text-muted-foreground">Пока ничего нет.</p>}
            {data.map((n) => {
              const Icon = ICON[n.type];
              return (
                <button
                  key={n.id}
                  className={cn("flex w-full gap-2.5 px-3 py-2.5 text-left border-b last:border-0 hover:bg-accent/60", !n.readAt && "bg-accent/30")}
                  onClick={() => {
                    if (!n.readAt) markRead.mutate(n.id);
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                  data-testid={`notification-${n.id}`}
                >
                  <Icon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className={cn("block text-sm leading-tight", !n.readAt && "font-semibold")}>{n.title}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{n.body}</span>
                    <span className="block text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString("ru-RU")}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
