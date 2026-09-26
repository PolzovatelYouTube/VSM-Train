import type { Car } from "@shared/scenario";
import { CAR_TYPE_LABEL, CAR_TYPE_SHORT } from "@shared/scenario";
import { cn } from "@/lib/utils";
import { Heart, ShieldCheck, Timer, Flame } from "lucide-react";
import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import type { LevelInfo, ExpiringPoints } from "@shared/gamification";
import { TRAIN_ASSETS } from "@/game/assets";

function TrainTerminal({ side }: { side: "tail" | "head" }) {
  const isHead = side === "head";
  const asset = isHead ? TRAIN_ASSETS.head : TRAIN_ASSETS.tail;
  return (
    <div className={cn("train-terminal", isHead ? "train-terminal--head" : "train-terminal--tail")} role="img" aria-label={isHead ? "Голова поезда" : "Хвост поезда"}>
      <img className="train-terminal__image" src={asset} alt="" onError={({ currentTarget }) => { currentTarget.hidden = true; }} />
      <svg className="train-terminal__fallback" viewBox="0 0 96 64" aria-hidden="true">
        {isHead ? (
          <>
            <path className="train-terminal__body" d="M6 53V18c0-7 5-12 12-12h45c10 0 18 4 25 12l5 6c3 4 3 10 0 14l-5 6c-7 8-15 12-25 12H18C11 56 6 55 6 53Z" />
            <path className="train-terminal__window" d="M19 15h42c7 0 12 2 17 8l3 4H18v-7c0-3 1-5 1-5Z" />
            <circle className="train-terminal__light" cx="82" cy="35" r="3.5" />
          </>
        ) : (
          <>
            <path className="train-terminal__body" d="M90 53V18c0-7-5-12-12-12H33c-10 0-18 4-25 12l-5 6c-3 4-3 10 0 14l5 6c7 8 15 12 25 12h45c7 0 12-1 12-3Z" />
            <path className="train-terminal__window" d="M77 15H35c-7 0-12 2-17 8l-3 4h63v-7c0-3-1-5-1-5Z" />
            <circle className="train-terminal__tail-light" cx="14" cy="35" r="3.5" />
          </>
        )}
        <path className="train-terminal__rail" d="M12 56h72" />
      </svg>
      <span>{isHead ? "Голова" : "Хвост"}</span>
    </div>
  );
}

/** Схема состава: переключение между вагонами */
export function TrainStrip({
  cars,
  selectedId,
  onSelect,
  badges = {},
  className,
}: {
  cars: Car[];
  className?: string;
  selectedId: string;
  onSelect: (id: string) => void;
  badges?: Record<string, number>; // carId → число акторов/событий
}) {
  return (
    <div className={cn("train-navigator", className)} role="tablist" aria-label="Вагоны состава">
      <TrainTerminal side="tail" />
      {cars.map((c) => {
        const active = c.id === selectedId;
        return (
          <div className="train-car-slot" key={c.id}>
            <button
              role="tab"
              aria-selected={active}
              aria-label={`Вагон ${c.number}: ${CAR_TYPE_LABEL[c.type]}`}
              onClick={() => onSelect(c.id)}
              data-testid={`button-car-${c.number}`}
              className={cn(
                "train-car-card",
                active && "train-car-card--active",
              )}
              title={CAR_TYPE_LABEL[c.type]}
            >
              <img className="train-car-card__image" src={TRAIN_ASSETS.car} alt="" onError={({ currentTarget }) => { currentTarget.hidden = true; }} />
              {badges[c.id] ? (
                <span className="train-car-card__badge">
                  {badges[c.id]}
                </span>
              ) : null}
            </button>
            <span className="train-car-card__label" aria-hidden="true">
              <span className="train-car-card__number">{c.number}</span>
              <span className="train-car-card__type">{CAR_TYPE_SHORT[c.type]}</span>
            </span>
          </div>
        );
      })}
      <TrainTerminal side="head" />
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

/** Уровень и прогресс опыта до следующего */
export function LevelBar({ level }: { level: LevelInfo }) {
  return (
    <div data-testid="level-bar">
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="font-semibold">
          Уровень {level.level} · {level.title}
        </span>
        <span className="font-mono text-xs tabular text-muted-foreground">
          {level.nextLevelXp === null ? `${level.xp} XP · максимум` : `${level.xp} / ${level.nextLevelXp} XP`}
        </span>
      </div>
      <Progress value={level.progress * 100} className="h-1.5" />
    </div>
  );
}

/** Предупреждение о сгорающих баллах */
export function ExpiringNote({ expiring }: { expiring: ExpiringPoints }) {
  return (
    <p className="flex items-center gap-2 rounded-md border border-[hsl(var(--loyalty))]/40 bg-[hsl(var(--loyalty))]/5 p-2.5 text-sm" data-testid="text-expiring">
      <Flame className="size-4 shrink-0 text-[hsl(var(--loyalty))]" />
      Через {expiring.inDays} дн. сгорит {expiring.points} баллов — пройдите проверочный рейс, чтобы удержать место.
    </p>
  );
}

export function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted/60 p-2.5">
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">{icon}{label}</div>
      <div className="font-mono text-xl font-bold tabular leading-tight">{value}</div>
    </div>
  );
}
