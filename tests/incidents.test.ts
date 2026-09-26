import { describe, expect, it } from "vitest";
import { createSim, tick, selectIncident, leaveIncident, chooseOption, continueInformation, effectiveNodeKind, findNode, computeResult } from "../shared/engine";
import { scenarioDataSchema, type GameEvent } from "../shared/scenario";
import { multiIncidentScenario } from "../shared/scenarios/multi-incident";
import { replayAttempt, ReplayError } from "../shared/replay";
import { projectGameScene } from "../shared/visual";

function fixture() {
  const data = multiIncidentScenario();
  data.actors.forEach((a) => { a.steps = []; });
  return data;
}

function advance(s: ReturnType<typeof createSim>, data: ReturnType<typeof fixture>, to: number) {
  while (s.t + 1e-7 < to && !s.finished) tick(s, Math.min(0.05, to - s.t), data, { pauseWhileDialogue: true });
}

function option(data: ReturnType<typeof fixture>, s: ReturnType<typeof createSim>, id: string) {
  return findNode(data, s.active!.eventId, s.active!.nodeId)!.options.find((o) => o.id === id)!;
}

describe("meaningful choices", () => {
  it("условия, оставляющие один вариант, превращают узел в информацию без оценки и эффектов", () => {
    const data = fixture();
    const node = data.events[0].nodes[0];
    node.options[1].if = { flag: "delegate_available" };
    const s = createSim(data);
    advance(s, data, 10.1);
    selectIncident(s, data, "socket");
    expect(effectiveNodeKind(node, s)).toBe("information");
    chooseOption(s, data, node.options[0]);
    expect(s.log).toHaveLength(0);
    expect(continueInformation(s, data)).toBe(true);
    expect(s.active?.nodeId).toBe("socket-result");
    expect(s.loyalty).toBe(data.initial.loyalty);
    expect(s.log).toHaveLength(0);
  });

  it("дубликаты механики не создают выбор, а ноль доступных вариантов не блокирует игру", () => {
    const data = fixture();
    const node = data.events[0].nodes[0];
    node.options = [node.options[0], { ...node.options[0], id: "copy", text: "Другая надпись" }];
    const s = createSim(data);
    expect(effectiveNodeKind(node, s)).toBe("information");
    advance(s, data, 10.1);
    selectIncident(s, data, "socket");
    continueInformation(s, data);
    expect(s.active?.nodeId).toBe("socket-result");
    continueInformation(s, data);
    expect(s.active).toBeNull();
    node.options.forEach((o) => { o.if = { flag: "hidden" }; });
    const other = createSim(data);
    advance(other, data, 10.1);
    selectIncident(other, data, "socket");
    expect(continueInformation(other, data)).toBe(true);
    expect(other.active).toBeNull();
    expect(other.log).toHaveLength(0);
  });

  it("финальная информация не начисляет баллов и не ухудшается во время чтения", () => {
    const data = fixture();
    const s = createSim(data);
    advance(s, data, 10.1);
    selectIncident(s, data, "socket");
    chooseOption(s, data, option(data, s, "socket-delegate"));
    expect(s.incidents.socket.status).toBe("resolved");
    const before = computeResult(s, data);
    expect(continueInformation(s, data)).toBe(true);
    expect(computeResult(s, data)).toEqual(before);
    advance(s, data, 41);
    expect(s.log.some((l) => l.eventId === "socket" && l.cause === "escalation")).toBe(false);
  });
});

describe("одновременные ситуации", () => {
  it("в тренировке время идёт, несколько обращений ждут выбора игрока", () => {
    const data = fixture();
    const s = createSim(data);
    advance(s, data, 24);
    expect(s.t).toBeCloseTo(24);
    expect(s.active).toBeNull();
    expect(["socket", "seat-dispute", "breathing"].map((id) => s.incidents[id].status)).toEqual(["waiting", "waiting", "waiting"]);
    selectIncident(s, data, "socket");
    advance(s, data, 25);
    expect(s.t).toBeCloseTo(25);
    expect(s.active?.eventId).toBe("socket");
  });

  it("переключение сохраняет узел и исходный дедлайн, уход оставляет ситуацию ждать", () => {
    const data = fixture();
    data.events[1].nodes[0].timerSec = 15;
    const s = createSim(data);
    advance(s, data, 24);
    selectIncident(s, data, "seat-dispute");
    const dialogue = { ...s.active! };
    selectIncident(s, data, "breathing");
    advance(s, data, 26);
    selectIncident(s, data, "seat-dispute");
    expect(s.active).toEqual(dialogue);
    leaveIncident(s);
    expect(s.incidents["seat-dispute"].status).toBe("waiting");
    expect(s.active).toBeNull();
  });

  it("занятость розеткой приводит к медицинской эскалации; розетка не исчезает", () => {
    const data = fixture();
    const s = createSim(data);
    advance(s, data, 24);
    selectIncident(s, data, "socket");
    advance(s, data, 36);
    expect(s.incidents.breathing.status).toBe("expired");
    expect(s.incidents["medical-worse"].status).toBe("waiting");
    expect(s.incidents.socket.status).toBe("active");
    expect(s.safety).toBe(data.initial.safety - 18);
    advance(s, data, 42);
    expect(s.incidents.socket.status).toBe("active");
    expect(s.flags["socket.waited"]).toBe(true);
    expect(s.log.filter((l) => l.eventId === "socket" && l.cause === "escalation")).toHaveLength(1);
    selectIncident(s, data, "medical-worse");
    advance(s, data, 44);
    expect(s.log.filter((l) => l.eventId === "breathing" && l.cause === "escalation")).toHaveLength(1);
  });

  it("стоимость действия двигает общие часы и запускает остальные ситуации", () => {
    const data = fixture();
    const s = createSim(data);
    advance(s, data, 17);
    selectIncident(s, data, "socket");
    chooseOption(s, data, option(data, s, "socket-inspect"));
    expect(s.t).toBeCloseTo(37);
    expect(s.incidents["seat-dispute"].status).toBe("waiting");
    expect(s.flags["medical.worse"]).toBe(true);
    expect(s.incidents.socket.status).toBe("resolved");
  });

  it("фоновый таймаут не заменяет фокус и применяет onTimeout", () => {
    const data = fixture();
    const ev = data.events[1];
    ev.nodes[0].timerSec = 3;
    ev.nodes[0].onTimeout = { next: null, effects: { loyalty: -2, safety: -1 }, set: { timeout_seen: true }, text: "Спор не остановлен" };
    const s = createSim(data);
    advance(s, data, 19);
    selectIncident(s, data, "socket");
    advance(s, data, 22);
    expect(s.active?.eventId).toBe("socket");
    expect(s.incidents[ev.id].status).toBe("expired");
    expect(s.flags.timeout_seen).toBe(true);
    expect(s.log.filter((l) => l.eventId === ev.id)).toHaveLength(1);
  });

  it("эскалация nextNode меняет стадию фонового инцидента, не меняя выбранный", () => {
    const data = fixture();
    const socket = data.events.find((event) => event.id === "socket")!;
    socket.nodes.push({ id: "socket-escalated", kind: "decision", speaker: "Пассажир", text: "Нужно выбрать дальнейшее действие.", options: [
      { id: "escalated-a", text: "Передать информацию", next: null, effects: { loyalty: 0, safety: 1 }, correct: true },
      { id: "escalated-b", text: "Организовать наблюдение", next: null, effects: { loyalty: 0, safety: 2 }, correct: true },
    ] });
    socket.escalation = { afterSec: 5, nextNode: "socket-escalated", effects: { loyalty: -1, safety: 0 } };
    const s = createSim(data);
    advance(s, data, 24);
    selectIncident(s, data, "breathing");
    advance(s, data, 25);
    expect(s.active?.eventId).toBe("breathing");
    expect(s.incidents.socket.status).toBe("waiting");
    expect(s.incidents.socket.dialogue?.nodeId).toBe("socket-escalated");
    expect(s.log.filter((entry) => entry.eventId === "socket" && entry.cause === "escalation")).toHaveLength(1);
  });

  it("бесхозный предмет появляется поздно и даёт содержательный выбор", () => {
    const data = fixture();
    const s = createSim(data);
    advance(s, data, 44.9);
    expect(s.incidents.unattended.status).toBe("pending");
    advance(s, data, 45.1);
    expect(s.incidents.unattended.status).toBe("waiting");
    expect(findNode(data, "unattended", "item-start")?.options).toHaveLength(2);
  });

  it("конец рейса закрывает нерешённые ситуации и фиксирует их последствия", () => {
    const data = fixture();
    const s = createSim(data);
    advance(s, data, data.durationSec);
    expect(s.finished).toBe(true);
    expect(s.active).toBeNull();
    expect(Object.values(s.incidents).every((i) => i.status === "expired" || i.status === "resolved")).toBe(true);
    expect(s.log.some((l) => l.cause === "ride_ended")).toBe(true);
    expect(selectIncident(s, data, "socket")).toBe(false);
  });

  it("уровень срочности влияет на оценку своевременного ответа", () => {
    const data = fixture();
    const s = createSim(data);
    advance(s, data, 24);
    selectIncident(s, data, "breathing");
    chooseOption(s, data, option(data, s, "medical-radio"));
    expect(computeResult(s, data).competencies.prioritization).toBe(100); // Остальные окна ещё не истекли: порядок допустим.
  });

  it("локация без актора используется чистым проектором", () => {
    const data = fixture();
    data.events[0].actorId = null;
    const s = createSim(data);
    advance(s, data, 11);
    selectIncident(s, data, "socket");
    const snapshot = JSON.stringify(s);
    expect(projectGameScene(data, s).carId).toBe(data.events[0].location!.carId);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe("replay нескольких ситуаций", () => {
  it.each(["training", "check"] as const)("воспроизводит фокус, ожидание, действие и продолжение (%s)", (mode) => {
    const data = fixture();
    const actions = [
      { type: "select" as const, eventId: "socket", timestampMs: 17000 },
      { type: "leave" as const, timestampMs: 18000 },
      { type: "select" as const, eventId: "breathing", timestampMs: 24000 },
      { type: "choice" as const, eventId: "breathing", nodeId: "breathing-start", choiceId: "medical-radio", timestampMs: 24000 },
      { type: "select" as const, eventId: "socket", timestampMs: 25000 },
      { type: "choice" as const, eventId: "socket", nodeId: "socket-start", choiceId: "socket-delegate", timestampMs: 25000 },
      { type: "continue" as const, eventId: "socket", nodeId: "socket-result", timestampMs: 29000 },
    ];
    const replay = replayAttempt(data, mode, actions);
    const s = createSim(data);
    advance(s, data, 17); selectIncident(s, data, "socket");
    advance(s, data, 18); leaveIncident(s);
    advance(s, data, 24); selectIncident(s, data, "breathing"); chooseOption(s, data, option(data, s, "medical-radio"));
    selectIncident(s, data, "socket"); chooseOption(s, data, option(data, s, "socket-delegate"));
    advance(s, data, 29); continueInformation(s, data);
    advance(s, data, data.durationSec);
    expect(replay.result).toEqual(computeResult(s, data));
    expect(replay.state.flags).toEqual(s.flags);
    expect(replay.state.log.map((l) => [l.eventId, l.optionId, l.effects])).toEqual(s.log.map((l) => [l.eventId, l.optionId, l.effects]));
  });

  it("отклоняет скрытый/непоявившийся инцидент, чужой ответ и choice вместо информации", () => {
    const data = fixture();
    expect(() => replayAttempt(data, "check", [{ type: "select", eventId: "breathing", timestampMs: 10000 }])).toThrow(ReplayError);
    expect(() => replayAttempt(data, "check", [
      { type: "select", eventId: "socket", timestampMs: 24000 },
      { type: "choice", eventId: "breathing", nodeId: "socket-start", choiceId: "socket-delegate", timestampMs: 24000 },
    ])).toThrow(ReplayError);
    expect(() => replayAttempt(data, "check", [
      { type: "select", eventId: "socket", timestampMs: 11000 },
      { type: "choice", eventId: "socket", nodeId: "socket-start", choiceId: "socket-delegate", timestampMs: 11000 },
      { type: "choice", eventId: "socket", nodeId: "socket-result", choiceId: "fake", timestampMs: 14000 },
    ])).toThrow(ReplayError);
  });

  it("поля новых сценариев валидны; старый формат без kind/lifecycle продолжает загружаться", () => {
    const data = fixture();
    expect(scenarioDataSchema.safeParse(data).success).toBe(true);
    delete data.gameplay;
    data.events.forEach((ev: GameEvent) => {
      delete ev.urgency; delete ev.escalation; delete ev.responseWindowSec; delete ev.location;
      ev.nodes.forEach((n) => { delete n.kind; });
    });
    expect(scenarioDataSchema.safeParse(data).success).toBe(true);
  });
});
