import { Link } from "wouter";
import { ArrowLeft, GraduationCap, ClipboardCheck } from "lucide-react";
import { Meter, Clock } from "@/components/app/widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SceneConsequence } from "@shared/visual";
import { cn } from "@/lib/utils";

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Delta({ value, k }: { value: number; k: string }) {
  if (!value) return null;
  return (
    <span
      key={k}
      className={cn("g-delta absolute -top-3 right-0 rounded px-1 font-mono text-xs font-bold", value > 0 ? "text-[hsl(var(--safety))]" : "text-[hsl(var(--danger))]")}
      aria-hidden
    >
      {fmt(value)}
    </span>
  );
}

/** Верхняя панель смены: время, шкалы с всплывающими дельтами, режим */
export function GameHud({
  scenarioName,
  trainName,
  training,
  t,
  total,
  loyalty,
  safety,
  consequence,
  consequenceKey,
}: {
  scenarioName: string;
  trainName: string;
  training: boolean;
  t: number;
  total: number;
  loyalty: number;
  safety: number;
  consequence?: SceneConsequence;
  consequenceKey: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="game-hud">
      <Button variant="ghost" size="sm" className="min-h-11 px-2" asChild>
        <Link href="/" data-testid="link-back" aria-label="К сценариям">
          <ArrowLeft className="size-4 sm:mr-1" /> <span className="hidden sm:inline">Сценарии</span>
        </Link>
      </Button>
      <div className="min-w-0 hidden sm:block">
        <div className="truncate text-sm font-semibold">{scenarioName}</div>
        <div className="text-xs text-muted-foreground">{trainName}</div>
      </div>
      <Badge variant={training ? "secondary" : "default"} className="gap-1" data-testid="badge-mode">
        {training ? <GraduationCap className="size-3.5" /> : <ClipboardCheck className="size-3.5" />}
        {training ? "Тренировка" : "Проверочный рейс"}
      </Badge>
      <Clock t={t} total={total} />
      <div className="ml-auto flex flex-wrap gap-x-4 gap-y-2">
        <div className="relative">
          <Meter label="Лояльность пассажиров" value={loyalty} kind="loyalty" compact />
          <Delta value={consequence?.loyalty ?? 0} k={`${consequenceKey}-l`} />
        </div>
        <div className="relative">
          <Meter label="Рейтинг безопасности" value={safety} kind="safety" compact />
          <Delta value={consequence?.safety ?? 0} k={`${consequenceKey}-s`} />
        </div>
      </div>
    </div>
  );
}
