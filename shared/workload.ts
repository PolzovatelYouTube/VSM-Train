import type { ScenarioData, WorkloadEntry } from "./scenario";
import type { LogEntry } from "./engine";

export function buildWorkloadDebrief(data: ScenarioData, log: LogEntry[], workload: WorkloadEntry[]) {
  const title = (id: string) => data.events.find((ev) => ev.id === id)?.title ?? id;
  const timeline = workload.map((entry) => {
    let description = entry.text;
    if (entry.kind === "appeared") description = `Новое обращение: ${entry.text}`;
    if (entry.kind === "selected") description = entry.fromEventId
      ? `Переключились с «${title(entry.fromEventId)}»` : "Выбрали ситуацию";
    if (entry.kind === "risk_changed") description = `Признаки изменились: ${entry.text}`;
    if (entry.kind === "action") {
      description = `${entry.completedAt === undefined ? "Начали действие" : "Выполнили действие"}: ${entry.text}`;
      if (entry.competingEventIds?.length) description += `; в это время ждали: ${entry.competingEventIds.map(title).join(", ")}`;
    }
    return { ...entry, eventTitle: title(entry.eventId), description };
  }).sort((a, b) => a.t - b.t);

  const incidents = workload.filter((entry) => entry.kind === "appeared").map((appearance) => {
    const entries = workload.filter((entry) => entry.eventId === appearance.eventId);
    const actions = log.filter((entry) => entry.eventId === appearance.eventId && entry.optionId !== null);
    const firstAction = entries.find((entry) => entry.kind === "action");
    const successorId = data.events.find((ev) => ev.id === appearance.eventId)?.escalation?.nextEvent;
    const recovered = !!successorId && workload.some((entry) => entry.eventId === successorId && entry.kind === "resolved");
    const phases = entries.filter((entry) => entry.kind === "appeared" || entry.kind === "risk_changed");
    const delays = phases.map((phase, index) => {
      const next = phases[index + 1]?.t ?? Infinity;
      const response = entries.find((entry) => entry.kind === "action" && entry.t >= phase.t && entry.t < next);
      const penalty = entries.find((entry) => (entry.kind === "escalated" || entry.kind === "expired") && entry.t >= phase.t && entry.t < next);
      const waitedSec = response ? response.t - phase.t : penalty ? penalty.t - phase.t : undefined;
      return { text: phase.text, waitedSec: waitedSec === undefined ? undefined : Math.round(waitedSec * 10) / 10,
        overdueSec: waitedSec === undefined ? 0 : Math.max(0, Math.round((waitedSec - phase.responseWindowSec) * 10) / 10),
        worsened: !!penalty };
    });
    return { eventId: appearance.eventId, title: title(appearance.eventId),
      resolved: entries.some((entry) => entry.kind === "resolved"),
      recovered,
      actionsCorrect: actions.length > 0 && actions.every((entry) => entry.correct),
      waitingSec: firstAction ? Math.round((firstAction.t - appearance.t) * 10) / 10 : undefined,
      delays,
      penalties: entries.filter((entry) => entry.kind === "escalated" || entry.kind === "expired") };
  });
  return { timeline, incidents };
}

export type WorkloadDebrief = ReturnType<typeof buildWorkloadDebrief>;
