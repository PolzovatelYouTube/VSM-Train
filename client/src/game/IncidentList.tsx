import type { ScenarioData } from "@shared/scenario";
import { incidentObservation, type SimState } from "@shared/engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Только наблюдаемые признаки. Срочность и оценку определяет движок. */
export function IncidentList({ data, sim, disabled, onSelect, onLeave }: {
  data: ScenarioData; sim: SimState; disabled: boolean; onSelect: (id: string) => void; onLeave: () => void;
}) {
  const incidents = data.events.filter((ev) => ["waiting", "active"].includes(sim.incidents[ev.id]?.status));
  return (
    <Card data-testid="incident-list">
      <CardHeader className="pb-2"><CardTitle className="text-base">Активные ситуации · {incidents.length}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {!incidents.length && <p className="text-xs text-muted-foreground">Новых обращений нет.</p>}
        {incidents.map((ev) => {
          const incident = sim.incidents[ev.id];
          const actor = sim.actors.find((a) => a.id === ev.actorId);
          const car = data.train.cars.find((c) => c.id === (ev.location?.carId ?? actor?.carId));
          return (
            <Button key={ev.id} variant={incident.status === "active" ? "secondary" : "outline"} disabled={disabled}
              onClick={() => onSelect(ev.id)} className="h-auto min-h-11 w-full whitespace-normal text-left justify-start" data-testid={`button-incident-${ev.id}`}>
              <span>
                <span className="block font-semibold">{car ? `Вагон ${car.number} · ` : "По рации · "}{ev.title}</span>
                <span className="block text-xs font-normal">{incidentObservation(sim, data, ev.id)}</span>
                <span className="block text-xs font-normal text-muted-foreground">{incident.status === "active" ? "Вы занимаетесь этой ситуацией" : "Ожидает"} · {Math.floor(sim.t - (incident.triggeredAt ?? sim.t))} с</span>
              </span>
            </Button>
          );
        })}
        {sim.active && <Button variant="ghost" disabled={disabled} onClick={onLeave} className="min-h-11 w-full">Оставить ждать и продолжить обход</Button>}
      </CardContent>
    </Card>
  );
}
