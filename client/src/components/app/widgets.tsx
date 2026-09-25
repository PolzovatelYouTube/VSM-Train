import type { Car } from "@shared/scenario";
import { CAR_TYPE_LABEL, CAR_TYPE_SHORT } from "@shared/scenario";
import { cn } from "@/lib/utils";
import { Heart, ShieldCheck, Timer } from "lucide-react";

/** Схема состава: переключение между вагонами */
export function TrainStrip({
  cars,
  selectedId,
  onSelect,
  badges = {},
}: {
  cars: Car[];
  selectedId: string;
  onSelect: (id: string) => void;
  badges?: Record<string, number>; // carId → число акторов/событий
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1" role="tablist" aria-label="Вагоны состава">
      <span className="text-xs text-muted-foreground mr-1 shrink-0">Хвост</span>
      {cars.map((c) => {
        const active = c.id === selectedId;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(c.id)}
            data-testid={`button-car-${c.number}`}
            className={cn(
              "relative shrink-0 rounded-md border px-3 py-1.5 text-sm transition-colors",
              active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent",
            )}
            title={CAR_TYPE_LABEL[c.type]}
          >
            <span className="font-mono font-semibold">{c.number}</span>
            <span className={cn("ml-1.5 text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {CAR_TYPE_SHORT[c.type]}
            </span>
            {badges[c.id] ? (
              <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-[hsl(var(--loyalty))] text-[10px] font-bold text-white grid place-items-center">
                {badges[c.id]}
              </span>
            ) : null}
          </button>
        );
      })}
      <span className="text-xs text-muted-foreground ml-1 shrink-0">Голова →</span>
    </div>
  );
}

/** Шкала лояльности/безопасности */
export function Meter({
  label,
  value,
  kind,
  compact = false,
}: {
  label: string;
  value: number;
  kind: "loyalty" | "safety";
  compact?: boolean;
}) {
  const Icon = kind === "loyalty" ? Heart : ShieldCheck;
  const color = value < 40 ? "hsl(var(--danger))" : `hsl(var(--${kind}))`;
  return (
    <div className={cn("flex items-center gap-2", compact ? "min-w-36" : "min-w-48")} data-testid={`meter-${kind}`}>
      <Icon className="size-4 shrink-0" style={{ color }} />
      <div className="flex-1">
        {!compact && <div className="text-xs text-muted-foreground leading-none mb-1">{label}</div>}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${value}%`, background: color }} />
        </div>
      </div>
      <span className="font-mono text-sm font-semibold tabular w-8 text-right">{Math.round(value)}</span>
    </div>
  );
}

export function Clock({ t, total }: { t: number; total: number }) {
  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60);
  return (
    <div className="flex items-center gap-2" data-testid="text-clock">
      <Timer className="size-4 text-muted-foreground" />
      <span className="font-mono text-sm font-semibold tabular">
        {mm}:{ss.toString().padStart(2, "0")}
      </span>
      <span className="text-xs text-muted-foreground font-mono">/ {Math.floor(total / 60)}:{(total % 60).toString().padStart(2, "0")}</span>
    </div>
  );
}

/** Круговой таймер для диалога */
export function TimerRing({ left, total }: { left: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, left / total) : 1;
  const color = frac > 0.5 ? "hsl(var(--safety))" : frac > 0.25 ? "hsl(var(--loyalty))" : "hsl(var(--danger))";
  return (
    <div className="relative size-12 shrink-0" aria-label={`Осталось ${Math.ceil(left)} секунд`} data-testid="timer-ring">
      <svg viewBox="0 0 48 48" className="size-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-sm font-bold tabular">{Math.ceil(left)}</span>
    </div>
  );
}

export const CATEGORY_COLOR: Record<string, string> = {
  conflict: "bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]",
  medical: "bg-[hsl(var(--chart-5))]/15 text-[hsl(var(--chart-5))]",
  technical: "bg-[hsl(var(--loyalty))]/15 text-[hsl(var(--loyalty))]",
  request: "bg-primary/15 text-primary",
};
