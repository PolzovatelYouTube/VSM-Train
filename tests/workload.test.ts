import { describe, expect, it } from "vitest";
import { createSim, tick, selectIncident, leaveIncident, chooseOption, findNode, computeResult, incidentPriority, incidentObservation } from "../shared/engine";
import { scenarioDataSchema, workloadEntrySchema } from "../shared/scenario";
import { parallelSituationsScenario } from "../shared/scenarios/parallel-situations";
import { buildWorkloadDebrief } from "../shared/workload";
import { buildDebrief, categoryStats, topMistakes } from "../shared/analytics";
import { replayAttempt } from "../shared/replay";

const fixture = () => {
  const data = parallelSituationsScenario();
  data.actors.forEach((actor) => { actor.steps = []; });
  return data;
};
const advance = (s: ReturnType<typeof createSim>, data: ReturnType<typeof fixture>, to: number) => {
  while (s.t + 1e-7 < to && !s.finished) tick(s, Math.min(.05, to - s.t), data, { pauseWhileDialogue: true });
};
const choose = (s: ReturnType<typeof createSim>, data: ReturnType<typeof fixture>, id: string) =>
  chooseOption(s, data, findNode(data, s.active!.eventId, s.active!.nodeId)!.options.find((option) => option.id === id)!);

describe("динамический риск и управление нагрузкой", () => {
  it("сохраняет уточнённый контекст, узел и сроки при переключении", () => {
    const data = fixture(), s = createSim(data);
    advance(s, data, 24);
    selectIncident(s, data, "breathing"); choose(s, data, "medical-clarify");
    const dialogue = s.active;
    const episode = s.incidents.breathing.riskEpisodes.at(-1)!;
    selectIncident(s, data, "socket");
    advance(s, data, 27);
    selectIncident(s, data, "breathing");
    expect(s.active).toBe(dialogue);
    expect(s.active?.nodeId).toBe("medical-assessment");
    expect(s.incidents.breathing.context.medical_context_checked).toBe(true);
    expect(s.incidents.breathing.riskEpisodes.at(-1)).toBe(episode);
    expect(episode.startedAt).toBeCloseTo(26);
    expect(s.workload.filter((entry) => entry.kind === "selected").map((entry) => entry.eventId)).toEqual(["breathing", "socket", "breathing"]);
  });

  it("приоритет определяется признаками, временем и контекстом, без рейтинга категорий", () => {
    const data = fixture(), s = createSim(data);
    advance(s, data, 24);
    expect(incidentPriority(s, "seat-dispute")).toBeGreaterThan(incidentPriority(s, "breathing"));
    const medicalBefore = incidentPriority(s, "breathing");
    advance(s, data, 29);
    expect(incidentObservation(s, data, "seat-dispute")).toContain("толкает");
    expect(incidentObservation(s, data, "breathing")).toContain("болит голова");
    advance(s, data, 32);
    expect(incidentPriority(s, "breathing")).toBeGreaterThan(medicalBefore * 10);
    expect(incidentObservation(s, data, "breathing")).toContain("трудно дышать");
    expect(s.flags.medical_warning).toBe(true);
    const priorities = data.events.map((ev) => incidentPriority(s, ev.id));
    data.events.forEach((ev) => { ev.category = "request"; });
    expect(data.events.map((ev) => incidentPriority(s, ev.id))).toEqual(priorities);
    advance(s, data, 46);
    expect(incidentPriority(s, "unattended")).toBeGreaterThan(incidentPriority(s, "socket"));
  });

  it.each([["socket", "seat-dispute"], ["seat-dispute", "socket"]])("не штрафует разумный своевременный порядок: %s → %s", (first, second) => {
    const data = fixture();
    data.events = data.events.filter((ev) => [first, second].includes(ev.id));
    data.events.forEach((ev) => {
      ev.trigger = { type: "time", atSec: 0 }; ev.escalation = undefined; ev.priorityRules = undefined;
      ev.severity = 2; ev.urgency = "urgent"; ev.responseWindowSec = 30;
      ev.nodes[0].options.forEach((option) => { option.timeCostSec = 1; });
    });
    const s = createSim(data);
    advance(s, data, 2);
    for (const id of [first, second]) { selectIncident(s, data, id); chooseOption(s, data, findNode(data, id, s.active!.nodeId)!.options[0]); }
    advance(s, data, data.durationSec);
    expect(computeResult(s, data).competencies.prioritization).toBe(100);
    expect(computeResult(s, data).competencies.situational_awareness).toBe(100);
  });

  it("первый ответ не скрывает задержку при новом ухудшении; повторный выбор не перезапускает окно", () => {
    const data = fixture(), s = createSim(data);
    advance(s, data, 24); selectIncident(s, data, "breathing"); choose(s, data, "medical-clarify");
    selectIncident(s, data, "socket"); advance(s, data, 37);
    const risk = s.incidents.breathing.riskEpisodes.at(-1)!;
    expect(risk.responseAt).toBeUndefined();
    selectIncident(s, data, "breathing");
    const noticedAt = risk.noticedAt;
    leaveIncident(s); advance(s, data, 38); selectIncident(s, data, "breathing");
    expect(risk.noticedAt).toBe(noticedAt);
    expect(risk.startedAt).toBeCloseTo(31);
    advance(s, data, 40);
    expect(risk.failed).toBe(true);
    expect(computeResult(s, data).competencies.prioritization).toBeLessThan(70);
    expect(computeResult(s, data).competencies.situational_awareness).toBeLessThan(100);
  });

  it("тот же способ помощи оценивается по текущим признакам", () => {
    const data = fixture(), s = createSim(data);
    advance(s, data, 24); selectIncident(s, data, "breathing"); choose(s, data, "medical-clarify");
    advance(s, data, 32); choose(s, data, "medical-monitor");
    expect(s.log.at(-1)?.correct).toBe(false);
    expect(s.log.at(-1)?.effects.safety).toBe(-6);
    expect(s.log.at(-1)?.feedback).toContain("Признаки уже изменились");
  });

  it("разбор отделяет правильные действия от задержки и показывает нагрузку по времени", () => {
    const data = fixture(), s = createSim(data);
    advance(s, data, 24); selectIncident(s, data, "socket"); choose(s, data, "socket-inspect");
    selectIncident(s, data, "medical-worse"); choose(s, data, "worse-stay");
    const result = computeResult(s, data);
    expect(result.accuracy).toBe(1);
    expect(result.competencies.prioritization).toBeLessThan(70);
    expect(buildDebrief(data, s.log)).toHaveLength(2);
    expect(categoryStats(s.log).every((row) => row.accuracy === 100)).toBe(true);
    expect(topMistakes([{ scenarioId: 1, data, log: s.log }])).toEqual([]);
    const review = buildWorkloadDebrief(data, s.log, s.workload);
    expect(review.incidents.find((ev) => ev.eventId === "socket")?.actionsCorrect).toBe(true);
    const medical = review.incidents.find((ev) => ev.eventId === "breathing")!;
    expect(medical.recovered).toBe(true);
    expect(medical.delays.at(-1)).toMatchObject({ waitedSec: 8, worsened: true });
    expect(medical.penalties[0].effects?.safety).toBe(-6);
    expect(review.timeline.find((entry) => entry.kind === "action")?.description).toContain("ждали");
    expect(review.timeline.map((entry) => entry.t)).toEqual([...review.timeline.map((entry) => entry.t)].sort((a, b) => a - b));
    expect(s.workload.every((entry) => workloadEntrySchema.safeParse(entry).success)).toBe(true);
  });

  it.each(["training", "check"] as const)("сервер восстанавливает контекст, аудит и обе компетенции (%s)", (mode) => {
    const data = fixture();
    const actions = [
      { type: "select" as const, eventId: "breathing", timestampMs: 24000 },
      { type: "choice" as const, eventId: "breathing", nodeId: "breathing-start", choiceId: "medical-clarify", timestampMs: 24000 },
      { type: "select" as const, eventId: "socket", timestampMs: 27000 },
      { type: "select" as const, eventId: "breathing", timestampMs: 32000 },
      { type: "choice" as const, eventId: "breathing", nodeId: "medical-assessment", choiceId: "medical-call", timestampMs: 32000 },
    ];
    const replay = replayAttempt(data, mode, actions);
    const s = createSim(data);
    advance(s, data, 24); selectIncident(s, data, "breathing"); choose(s, data, "medical-clarify");
    advance(s, data, 27); selectIncident(s, data, "socket");
    advance(s, data, 32); selectIncident(s, data, "breathing"); choose(s, data, "medical-call");
    advance(s, data, data.durationSec);
    expect(replay.state.workload).toEqual(s.workload);
    expect(replay.state.incidents.breathing.context).toEqual(s.incidents.breathing.context);
    expect(replay.result).toEqual(computeResult(s, data));
  });

  it("отдельный сценарий содержит четыре обращения и валидируется общей схемой", () => {
    const data = fixture();
    expect(scenarioDataSchema.safeParse(data).success).toBe(true);
    expect(data.events.filter((ev) => ev.trigger.type === "time")).toHaveLength(4);
    expect(data.events.find((ev) => ev.id === "unattended")?.trigger).toEqual({ type: "time", atSec: 45 });
  });

  it("старые события без окна ответа не получают новый неявный штраф на 30-й секунде", () => {
    const data = fixture();
    data.events = data.events.filter((ev) => ev.id === "socket");
    data.events[0].responseWindowSec = undefined;
    data.events[0].severity = undefined;
    data.events[0].escalation = undefined;
    const s = createSim(data);
    advance(s, data, 45);
    expect(s.log).toEqual([]);
    expect(s.incidents.socket.status).toBe("waiting");
  });
});
