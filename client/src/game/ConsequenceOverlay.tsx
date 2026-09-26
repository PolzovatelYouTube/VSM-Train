import { CheckCircle2, AlertTriangle, Hourglass } from "lucide-react";
import type { SceneConsequence } from "@shared/visual";
import { cn } from "@/lib/utils";

const META = {
  positive: { title: "Верное решение", icon: CheckCircle2, ring: "rgba(16,185,129,.55)", cls: "bg-emerald-600" },
  negative: { title: "Спорное решение", icon: AlertTriangle, ring: "rgba(239,68,68,.55)", cls: "bg-red-600" },
  timeout: { title: "Время вышло", icon: Hourglass, ring: "rgba(245,158,11,.6)", cls: "bg-amber-600" },
} as const;

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Реакция на выбор поверх сцены: вспышка по краю + плашка с изменением шкал и коротким разбором */
export function ConsequenceOverlay({ c, feedback }: { c: SceneConsequence; feedback?: string }) {
  const m = META[c.kind];
  const Icon = m.icon;
  return (
    <div className="pointer-events-none absolute inset-0 z-30" data-testid="consequence-overlay" data-kind={c.kind}>
      <div className="g-flash absolute inset-0" style={{ boxShadow: `inset 0 0 90px 10px ${m.ring}` }} />
      <div className="absolute inset-x-0 top-3 flex justify-center px-3">
        <div className={cn("g-mark flex max-w-md items-start gap-2.5 rounded-xl px-4 py-2.5 text-white shadow-2xl", m.cls)} role="status">
          <Icon className="mt-0.5 size-5 shrink-0" />
          <div>
            <div className="font-semibold leading-tight">{m.title}</div>
            <div className="font-mono text-xs opacity-90">
              Лояльность {fmt(c.loyalty)} · Безопасность {fmt(c.safety)}
            </div>
            {feedback && <div className="mt-1 text-xs leading-snug opacity-95">{feedback}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
