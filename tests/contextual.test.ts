import { describe, it, expect, vi, afterEach } from "vitest";
import { createSim, openNode, chooseOption, findNode, visibleOptions, tick, computeResult, resolveNext, resolveOutcome } from "../shared/engine";
import { buildDebrief } from "../shared/analytics";
import { scenarioDataSchema, type DialogueOption } from "../shared/scenario";
import { contextualScenario as buildContextualScenario } from "../shared/scenarios/contextual";
import { standardDemo } from "./helpers";
import { replayAttempt } from "../shared/replay";

const contextualScenario = () => {
  const data = buildContextualScenario();
  // Проверяем контракт контекстных решений отдельно от конкурентного диспетчера инцидентов.
  data.gameplay = "sequential";
  return data;
};

function pick(data: ReturnType<typeof contextualScenario>, state: ReturnType<typeof createSim>, id: string) {
  const node = findNode(data, state.active!.eventId, state.active!.nodeId)!;
  const option = visibleOptions(node, state).find((o) => o.id === id);
  expect(option, id).toBeDefined();
  chooseOption(state, data, option!);
}

describe("контекстные решения", () => {
  afterEach(() => vi.restoreAllMocks());
  it("один вариант даёт разные последствия; оценка предшествует установке собственных флагов", () => {
    const data = standardDemo();
    const option: DialogueOption = { id: "contextual", text: "Правило", next: null, correct: true,
      effects: { loyalty: -4, safety: 1 }, set: { known: true },
      outcomes: [
        { if: { flag: "known" }, correct: true, effects: { loyalty: 2, safety: 3 }, feedback: "Контекст был выяснен" },
        { if: { all: [] }, correct: false, effects: { loyalty: -4, safety: 1 }, feedback: "Контекст не выяснен" },
      ] };
    for (const known of [false, true]) {
      const s = createSim(data);
      s.flags.known = known;
      openNode(s, data, "ev_conflict", "n1");
      chooseOption(s, data, option);
      expect(s.log[0].correct).toBe(known);
      expect(s.log[0].effects.loyalty).toBe(known ? 2 : -4);
      expect(s.log[0].feedback).toBe(known ? "Контекст был выяснен" : "Контекст не выяснен");
      expect(s.flags.known).toBe(true);
      expect(computeResult(s, data)).toEqual(computeResult(s, data));
    }
  });

  it("уточнение открывает скрытый вариант и сохраняет оставшийся бюджет", () => {
    const data = contextualScenario();
    const s = createSim(data);
    openNode(s, data, "smell", "smell_start");
    const node = findNode(data, "smell", "smell_start")!;
    expect(visibleOptions(node, s).some((o) => o.id === "smell_talk")).toBe(false);
    pick(data, s, "smell_check");
    expect(visibleOptions(node, s).some((o) => o.id === "smell_talk")).toBe(true);
    expect(visibleOptions(node, s).some((o) => o.id === "smell_check")).toBe(false);
    expect(s.active?.limitSec).toBe(13);
    expect(s.log[0].context?.missing).toContain("Наличие свободных мест проверено");
    pick(data, s, "smell_talk");
    expect(s.log[1].context?.known).toContain("Наличие свободных мест проверено: да");
  });

  it("сбор информации нельзя повторять бесконечно, даже в тренировке", () => {
    const data = standardDemo();
    const s = createSim(data);
    openNode(s, data, "ev_conflict", "n1");
    const ask: DialogueOption = { id: "ask", text: "Уточнить", next: "n1", effects: { loyalty: 0, safety: 0 }, timeCostSec: 8, set: { learned: true } };
    chooseOption(s, data, ask);
    expect(s.active?.limitSec).toBe(12);
    chooseOption(s, data, ask);
    expect(s.active?.limitSec).toBe(4);
    delete s.flags.learned;
    chooseOption(s, data, ask);
    expect(s.active).toBeNull();
    expect(s.log.at(-1)?.optionId).toBeNull();
    expect(s.flags.learned).toBeUndefined();
  });

  it("стоимость учитывает время до выбора и истекает по таймеру", () => {
    const data = contextualScenario();
    const s = createSim(data);
    openNode(s, data, "smell", "smell_start");
    tick(s, 14, data, { pauseWhileDialogue: false });
    pick(data, s, "smell_check");
    expect(s.log.at(-1)?.optionId).toBeNull();
    expect(s.flags.seats_checked).toBeUndefined();
  });

  it("отложенное событие хранит ссылки на причины", () => {
    const data = contextualScenario();
    data.gameplay = "sequential"; // отдельно проверяем совместимость прежней очереди
    const s = createSim(data);
    openNode(s, data, "seat", "seat_start");
    pick(data, s, "seat_move");
    tick(s, 0.1, data, { pauseWhileDialogue: false });
    expect(s.fired).not.toContain("seat_followup");
    openNode(s, data, "care", "care_start");
    pick(data, s, "care_aisle");
    tick(s, 0.1, data, { pauseWhileDialogue: false });
    expect(s.fired).toContain("seat_followup");
    pick(data, s, "followup_review");
    expect(s.log[2].causes).toEqual([0, 1]);
    const debrief = buildDebrief(data, s.log);
    expect(debrief[0].consequences).toContain("Претензия после решения о месте");
    expect(debrief[0].changes).toContain("Претензия после пересадки без проверки: да");
    expect(debrief[2].effects.loyalty).toBe(-3);
    expect(debrief[2].competence).toContain("Коммуникация");
  });

  it("таймаут ставит причинный флаг, а очередь сохраняет исходную причину", () => {
    const data = contextualScenario();
    data.gameplay = "sequential";
    const s = createSim(data);
    openNode(s, data, "seat", "seat_start");
    tick(s, 22, data, { pauseWhileDialogue: false });
    expect(s.log[0].flagsSet).toEqual({ seat_complaint: true });
    openNode(s, data, "care", "care_start");
    pick(data, s, "care_aisle");
    openNode(s, data, "panic", "panic_start");
    tick(s, 0.1, data, { pauseWhileDialogue: false });
    expect(s.queue).toContain("seat_followup");
    expect(s.eventCauses?.seat_followup).toEqual([0, 1]);
    // Флаг меняется, пока событие ждёт показа: причиной остаётся исходный таймаут.
    s.flags.seat_complaint = false;
    pick(data, s, "panic_help");
    // Очистить более ранние события по времени, чтобы открыть ожидающее последствие.
    s.queue = ["seat_followup"];
    tick(s, 0.1, data, { pauseWhileDialogue: false });
    pick(data, s, "followup_review");
    expect(s.log.at(-1)?.causes).toEqual([0, 1]);
    expect(buildDebrief(data, s.log)[0].consequences).toContain("Претензия после решения о месте");
  });

  it("отрицательный ответ известен, а журнал учитывает границы шкал", () => {
    const data = contextualScenario();
    const s = createSim(data);
    s.flags.panic_context = false;
    s.safety = 99;
    openNode(s, data, "panic", "panic_start");
    pick(data, s, "panic_help");
    expect(s.log[0].context?.known).toContain("Уточнено: индивидуальное недомогание, массовой паники нет: нет");
    expect(s.log[0].context?.missing).toContain("Наблюдается быстрое ухудшение состояния");
    expect(s.log[0].effects.safety).toBe(1);
  });

  it("первый подходящий результат побеждает; отсутствие подходящего сохраняет базу", () => {
    const data = contextualScenario();
    const s = createSim(data);
    const option = findNode(data, "argument", "argument_start")!.options[1];
    expect(resolveOutcome(option, s).effects.loyalty).toBe(-4);
    const extended = { ...option, outcomes: [...option.outcomes!, { if: { all: [] }, correct: false, effects: { loyalty: -9, safety: 0 }, feedback: "Вторая ветка" }] };
    s.flags.heard_both = true;
    expect(resolveOutcome(extended, s).effects.loyalty).toBe(2);
    openNode(s, data, "argument", "argument_start");
    chooseOption(s, data, option);
    expect(s.log[0].violation).toBe("skipped_acknowledge");
    expect(s.log[0].correct).toBe(false);
  });

  it("старые данные загружаются без новых полей и сохраняют correct и эффекты", () => {
    const data = scenarioDataSchema.parse(standardDemo());
    const s = createSim(data);
    openNode(s, data, "ev_conflict", "n1");
    chooseOption(s, data, data.events[0].nodes[0].options[0]);
    expect(s.log[0]).toMatchObject({ correct: true, effects: { loyalty: 5, safety: 0 } });
    expect(data.events[0].nodes[0].options[0].outcomes).toBeUndefined();
  });

  it("контекстный разбор не предлагает недоступный статический эталон", () => {
    const data = contextualScenario();
    const s = createSim(data);
    openNode(s, data, "argument", "argument_start");
    pick(data, s, "argument_rule");
    expect(s.log[0].correct).toBe(false);
    expect(buildDebrief(data, s.log)[0].better).toBeNull();
    const informed = createSim(data);
    openNode(informed, data, "argument", "argument_start");
    pick(data, informed, "argument_listen");
    pick(data, informed, "argument_rule");
    expect(informed.log[1]).toMatchObject({ correct: true, effects: { loyalty: 2, safety: 2 } });
  });

  it("оценка одной просьбы различается по наблюдаемой стадии, а не роли", () => {
    const data = contextualScenario();
    const option = findNode(data, "stages", "stage_disorder")!.options[0];
    const s = createSim(data);
    s.flags.intoxication_stage = 2;
    expect(resolveOutcome(option, s).correct).toBe(true);
    s.flags.intoxication_stage = 3;
    expect(resolveOutcome(option, s)).toMatchObject({ correct: false, effects: { safety: -6 } });
  });

  it("сверка через ММТ ведёт к объяснению, соответствующему причине расхождения", () => {
    const data = contextualScenario();
    const s = createSim(data);
    const option = findNode(data, "seat", "seat_start")!.options.find((item) => item.id === "seat_check")!;

    expect(option.text).toContain("переносной терминал ММТ");
    s.flags.unclaimed_evoucher = true;
    expect(resolveNext(option, s)).toBe("seat_checked_unclaimed");
    s.flags.unclaimed_evoucher = false;
    s.flags.wrong_car = true;
    expect(resolveNext(option, s)).toBe("seat_checked_wrong_car");
  });

  it("при технической причине запаха доступен вызов бортинженера вместо разговора с соседом", () => {
    const data = contextualScenario();
    const s = createSim(data);
    s.flags.smell_ventilation = true;
    openNode(s, data, "smell", "smell_start");
    pick(data, s, "smell_check");
    const node = findNode(data, "smell", "smell_start")!;

    expect(visibleOptions(node, s).some((option) => option.id === "smell_talk")).toBe(false);
    expect(visibleOptions(node, s).some((option) => option.id === "smell_engineer")).toBe(true);
    expect(node.options.find((option) => option.id === "smell_talk")?.text).toContain("По отдельности");
    pick(data, s, "smell_engineer");
    expect(s.flags.ventilation_engineer_called).toBe(true);
  });

  it("уход за ребёнком начинается с подтверждённого санузла, а быстрое ухудшение передаётся ЛНП", () => {
    const data = contextualScenario();
    const care = createSim(data);
    openNode(care, data, "care", "care_start");
    pick(data, care, "care_ask");
    const careNode = findNode(data, "care", "care_start")!;
    expect(visibleOptions(careNode, care).some((option) => option.id === "care_toilet")).toBe(true);
    expect(visibleOptions(careNode, care).some((option) => option.id === "care_arrange")).toBe(false);

    const noToilet = createSim(data);
    noToilet.resources.capabilities[data.train.cars[1].id].babyCareSpace = false;
    openNode(noToilet, data, "care", "care_start");
    pick(data, noToilet, "care_ask");
    expect(visibleOptions(careNode, noToilet).some((option) => option.id === "care_toilet")).toBe(false);
    expect(visibleOptions(careNode, noToilet).some((option) => option.id === "care_arrange")).toBe(true);

    const emergency = createSim(data);
    openNode(emergency, data, "panic", "panic_start");
    pick(data, emergency, "panic_ask");
    pick(data, emergency, "panic_rapid_change");
    const panicNode = findNode(data, "panic", "panic_start")!;
    expect(visibleOptions(panicNode, emergency).some((option) => option.id === "panic_help")).toBe(false);
    expect(visibleOptions(panicNode, emergency).some((option) => option.id === "panic_escalate_stop")).toBe(true);
  });

  it("ситуации привязаны к разным пассажирам, без ещё не добавленного актора бармена", () => {
    const data = contextualScenario();
    expect(data.events.find((event) => event.id === "sale")?.actorId).toBe("drunk_passenger");
    expect(data.actors.map((actor) => actor.id)).toEqual(expect.arrayContaining([
      "mother_with_child", "drunk_passenger", "smell_complainer", "neighbour_grumpy",
    ]));
    expect(data.actors.some((actor) => actor.id === "bistro_attendant")).toBe(false);
    expect(findNode(data, "stages", "stages_observe")?.text).toContain("купленный в вагоне-бистро");
  });

  it.each(["training", "check"] as const)("серверный replay сохраняет стоимость и контекст (%s)", (mode) => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const data = contextualScenario();
    data.events = [data.events.find((e) => e.id === "smell")!];
    data.events[0].trigger = { type: "time", atSec: 0 };
    data.durationSec = 30;
    data.gameplay = "concurrent";
    const actions = [
      { type: "select" as const, eventId: "smell", timestampMs: 50 },
      { type: "choice" as const, nodeId: "smell_start", choiceId: "smell_check", timestampMs: 50 },
      { type: "choice" as const, nodeId: "smell_start", choiceId: "smell_talk", timestampMs: 7050 },
    ];
    const first = replayAttempt(data, mode, actions);
    expect(first.state.log[0].timeCostSec).toBe(7);
    expect(first.state.log[1].context?.known).toContain("Наличие свободных мест проверено: да");
    expect(first.result).toEqual(replayAttempt(data, mode, actions).result);
  });

  it("семь ситуаций и последствия валидны, переходы замкнуты, TODO сохраняются", () => {
    const data = scenarioDataSchema.parse(contextualScenario());
    expect(data.events.filter((e) => e.trigger.type === "time")).toHaveLength(7);
    for (const event of data.events) {
      const ids = new Set(event.nodes.map((n) => n.id));
      expect(ids.has(event.startNode)).toBe(true);
      for (const node of event.nodes) {
        for (const next of [node.onTimeout?.next, ...node.options.flatMap((o) => [o.next, ...(o.nextIf ?? []).map((b) => b.next)])])
          if (next) expect(ids.has(next)).toBe(true);
      }
    }
    expect(data.events.find((e) => e.id === "sale")?.contentTodo).toContain("TODO");
    expect(data.events.find((e) => e.id === "panic")?.contentTodo).toContain("TODO");
  });
});
