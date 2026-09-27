import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeEffects } from "@shared/analytics";
import type { WorkloadDebrief } from "@shared/workload";
import type { SimResult } from "@shared/engine";

const time = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export function WorkloadDebriefCard({ review, competencies }: { review: WorkloadDebrief; competencies: SimResult["competencies"] }) {
  if (!review.timeline.length) return null;
  return <Card data-testid="card-workload-debrief">
    <CardHeader>
      <CardTitle className="text-base">Управление нагрузкой</CardTitle>
      <p className="text-sm">Приоритизация: {competencies.prioritization} — {competencies.prioritization >= 70 ? "освоена" : "требует улучшения"}.
        Ситуационная осведомлённость: {competencies.situational_awareness}.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      {review.incidents.map((incident) => <div key={incident.eventId} className="rounded-md border p-3 text-sm space-y-1">
        <p className="font-medium">{incident.title}</p>
        <p>{incident.actionsCorrect ? "✓ Выполненные действия корректны" : "Выполненные действия разобраны ниже"}{incident.resolved ? "; ситуация решена" : incident.recovered ? "; помощь организована после ухудшения" : "; ситуация не завершена"}.</p>
        <p className="text-xs">{incident.waitingSec === undefined ? "Ответа на обращение не было" : `До первого действия прошло ${incident.waitingSec} сек.`}</p>
        {incident.delays.filter((delay) => delay.worsened || delay.overdueSec > 0).map((delay, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
          ⚠ {delay.text} — ожидание {delay.waitedSec} сек.{delay.overdueSec > 0 && `; превышение окна ответа ${delay.overdueSec} сек.`}{delay.worsened && "; ситуация ухудшилась до решения"}.
        </p>)}
        {incident.penalties.map((penalty, i) => <p key={i} className="text-xs">{penalty.text}: {penalty.effects && describeEffects(penalty.effects)}.</p>)}
      </div>)}
      <ol className="space-y-2 text-xs" aria-label="Хронология управления ситуациями">
        {review.timeline.map((entry, i) => <li key={i} className="flex gap-3">
          <time className="shrink-0 font-mono tabular-nums">{time(entry.t)}</time>
          <span><strong>{entry.eventTitle}</strong> · {entry.description}{entry.effects && ` (${describeEffects(entry.effects)})`}</span>
        </li>)}
      </ol>
    </CardContent>
  </Card>;
}
