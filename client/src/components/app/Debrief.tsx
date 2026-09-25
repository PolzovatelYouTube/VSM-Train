import { CheckCircle2, XCircle, TimerOff, Lightbulb, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORY_COLOR } from "@/components/app/widgets";
import { EVENT_CATEGORY_LABEL, ROLE_STEP_LABEL } from "@shared/scenario";
import { describeEffects, type DebriefItem } from "@shared/analytics";

/** Разбор после рейса: каждое решение — что было, что выбрано, как изменились шкалы и почему, как лучше */
export function DebriefCard({ items }: { items: DebriefItem[] }) {
  const decisions = items.filter((i) => i.choice !== null);
  const timeouts = items.filter((i) => i.choice === null);
  return (
    <Card data-testid="card-debrief">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Разбор решений</CardTitle>
        <p className="text-xs text-muted-foreground">
          {decisions.length} решений, верных — {decisions.filter((d) => d.correct).length}
          {timeouts.length > 0 && `, пропущено по таймеру — ${timeouts.length}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!items.length && <p className="text-sm text-muted-foreground">В этом рейсе не было решений.</p>}
        {decisions.map((d, i) => (
          <DebriefRow key={i} item={d} n={i + 1} />
        ))}
        {timeouts.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="text-sm font-semibold inline-flex items-center gap-1.5 text-[hsl(var(--danger))]">
              <TimerOff className="size-4" /> Пропущенные решения
            </div>
            {timeouts.map((d, i) => (
              <DebriefRow key={i} item={d} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DebriefRow({ item: d, n }: { item: DebriefItem; n?: number }) {
  const timeout = d.choice === null;
  return (
    <div className={cn("rounded-md border p-3 space-y-2 text-sm", timeout && "border-[hsl(var(--danger))]/40")} data-testid="debrief-item">
      <div className="flex flex-wrap items-center gap-2">
        {n !== undefined && <span className="font-mono text-xs text-muted-foreground">{n}</span>}
        <Badge className={cn("border-0", CATEGORY_COLOR[d.category])}>{EVENT_CATEGORY_LABEL[d.category]}</Badge>
        <span className="font-medium">{d.eventTitle}</span>
        <span className={cn("ml-auto font-mono text-xs tabular", d.effects.loyalty + d.effects.safety < 0 ? "text-[hsl(var(--danger))]" : "text-[hsl(var(--safety))]")}>
          {describeEffects(d.effects)}
        </span>
      </div>
      <p className="text-muted-foreground">
        <span className="text-xs">{d.speaker}:</span> {d.situation}
      </p>
      {!timeout && (
        <p className="flex items-start gap-1.5">
          {d.correct ? (
            <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-[hsl(var(--safety))]" />
          ) : (
            <XCircle className="size-4 shrink-0 mt-0.5 text-[hsl(var(--danger))]" />
          )}
          <span>
            {d.choice}
            {d.step && <Badge variant="outline" className="ml-2 text-[10px] px-1.5 align-middle">{ROLE_STEP_LABEL[d.step]}</Badge>}
          </span>
        </p>
      )}
      <p className="text-xs">
        <span className="font-semibold">Почему: </span>
        {d.why}
      </p>
      {d.violation && (
        <p className="flex items-start gap-1.5 text-xs text-[hsl(var(--danger))]">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" /> {d.violation}
        </p>
      )}
      {d.better && (
        <div className="rounded bg-[hsl(var(--safety))]/5 border border-[hsl(var(--safety))]/30 p-2 text-xs space-y-1">
          <div className="font-semibold">Как можно было лучше</div>
          <div>{d.better.text}</div>
          {d.better.hint && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <Lightbulb className="size-3.5 shrink-0 mt-0.5 text-[hsl(var(--loyalty))]" /> {d.better.hint}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
