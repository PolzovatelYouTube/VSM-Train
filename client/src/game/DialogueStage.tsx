import { useEffect, useRef } from "react";
import { Lightbulb, Radio, TimerReset } from "lucide-react";
import type { DialogueNode, DialogueOption, GameEvent } from "@shared/scenario";
import { EVENT_CATEGORY_LABEL, ROLE_STEP_LABEL, CAR_TYPE_LABEL, type CarType } from "@shared/scenario";
import { PATIENCE_BY_CLASS } from "@shared/rules";
import { CATEGORY_COLOR } from "@/components/app/widgets";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Диалоговая панель: имя, реплика (aria-live), варианты с последовательным появлением,
 * подсказки в тренировке, таймер-полоса + текст в проверке. Клавиши 1–4, Tab/Enter, touch.
 * locked — пока показывается реакция на выбор: повторный выбор невозможен.
 */
export function DialogueStage({
  event,
  node,
  options,
  training,
  timerLeft,
  limitSec,
  locked,
  speakerInScene,
  eventCar,
  onChoose,
}: {
  event: GameEvent;
  node: DialogueNode;
  options: DialogueOption[];
  training: boolean;
  timerLeft: number | null;
  limitSec?: number;
  locked: boolean;
  speakerInScene: boolean;
  eventCar: CarType | null;
  onChoose: (o: DialogueOption) => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= Math.min(4, options.length)) {
        e.preventDefault();
        onChoose(options[n - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options, locked, onChoose]);

  const share = timerLeft !== null && limitSec ? Math.max(0, timerLeft / limitSec) : null;
  const urgent = share !== null && share <= 0.3;

  return (
    <div
      key={`${event.id}/${node.id}`}
      className="g-rise rounded-xl border bg-card/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-card/90"
      data-testid="card-dialogue"
      aria-busy={locked}
    >
      {share !== null && (
        <div className="h-1.5 overflow-hidden rounded-t-xl bg-muted" aria-hidden>
          <div
            className={cn("h-full origin-left transition-transform duration-200 ease-linear", urgent ? "bg-[hsl(var(--danger))]" : share > 0.5 ? "bg-[hsl(var(--safety))]" : "bg-[hsl(var(--loyalty))]")}
            style={{ transform: `scaleX(${share})` }}
          />
        </div>
      )}
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("border-0", CATEGORY_COLOR[event.category])}>{EVENT_CATEGORY_LABEL[event.category]}</Badge>
          <span className="text-sm font-semibold leading-tight">{event.title}</span>
          {timerLeft !== null && (
            <span
              className={cn("ml-auto inline-flex items-center gap-1 font-mono text-sm tabular", urgent ? "text-[hsl(var(--danger))] font-bold" : "text-muted-foreground")}
              data-testid="text-timer"
            >
              <TimerReset className="size-4" /> {urgent ? "Срочно: " : "Осталось "}
              {Math.ceil(timerLeft)} с
            </span>
          )}
        </div>
        {eventCar && PATIENCE_BY_CLASS[eventCar].timer < 1 && (
          <p className="text-xs text-muted-foreground" data-testid="text-patience">
            {CAR_TYPE_LABEL[eventCar]}: пассажир ждёт меньше, потеря лояльности ×{PATIENCE_BY_CLASS[eventCar].loyaltyLoss}
          </p>
        )}
        <div className="rounded-lg bg-muted/70 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            {!speakerInScene && <Radio className="size-3.5" aria-label="по рации" />}
            {node.speaker}
            {!speakerInScene && <span className="font-normal">· по рации</span>}
          </div>
          <p className="text-sm leading-relaxed sm:text-[15px]" aria-live="polite" data-testid="text-dialogue">
            {node.text}
          </p>
        </div>
        <div className="grid gap-2" role="group" aria-label="Варианты ответа (клавиши 1–4)">
          {options.map((o, i) => (
            <button
              key={o.id}
              ref={i === 0 ? firstRef : undefined}
              disabled={locked}
              onClick={() => onChoose(o)}
              data-testid={`button-option-${o.id}`}
              style={{ ["--i" as string]: i }}
              className={cn(
                "g-opt min-h-11 w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                "hover:bg-accent hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed",
                training && o.correct && "border-[hsl(var(--safety))]/60 bg-[hsl(var(--safety))]/5",
              )}
            >
              <span className="mr-2 inline-grid size-5 place-items-center rounded bg-muted font-mono text-xs text-muted-foreground">{i + 1}</span>
              {o.text}
              {training && o.step && (
                <Badge variant="outline" className="ml-2 px-1.5 align-middle text-[10px]">
                  {ROLE_STEP_LABEL[o.step]}
                </Badge>
              )}
              {training && o.hint && o.correct && (
                <span className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-[hsl(var(--loyalty))]" /> {o.hint}
                </span>
              )}
            </button>
          ))}
        </div>
        {training && <p className="text-xs text-muted-foreground">Тренировка: рейс на паузе, верный вариант подсвечен. Клавиши 1–{Math.min(4, options.length)}.</p>}
      </div>
    </div>
  );
}
