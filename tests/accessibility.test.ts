import { describe, it, expect } from "vitest";
import { chooseOption, createSim, findNode, openNode, tick, computeResult, visibleOptions, timeoutDialogue, continueInformation } from "../shared/engine";
import { scenarioDataSchema } from "../shared/scenario";
import { accessibilityScenario } from "../shared/scenarios/accessibility";
import { buildDebrief } from "../shared/analytics";

const data = accessibilityScenario();

function pick(s: ReturnType<typeof createSim>, optionId: string) {
  const node = findNode(data, s.active!.eventId, s.active!.nodeId)!;
  const o = visibleOptions(node, s).find((x) => x.id === optionId);
  expect(o, `вариант ${optionId} виден в ${node.id}`).toBeDefined();
  chooseOption(s, data, o!);
}

describe("сценарий «Маломобильные пассажиры и бесхозная вещь»", () => {
  it("проходит валидацию схемы, все переходы ведут в существующие узлы, в каждом узле есть верный вариант", () => {
    expect(scenarioDataSchema.safeParse(data).success).toBe(true);
    for (const ev of data.events) {
      const ids = new Set(ev.nodes.map((n) => n.id));
      expect(ids.has(ev.startNode)).toBe(true);
      for (const n of ev.nodes) {
        expect(n.kind === "information" || n.options.some((o) => o.correct), `${ev.id}/${n.id}`).toBe(true);
        const targets = [n.onTimeout?.next, ...n.options.flatMap((o) => [o.next, ...(o.nextIf ?? []).map((b) => b.next)])];
        for (const t of targets) if (t) expect(ids.has(t), `${ev.id}/${n.id} → ${t}`).toBe(true);
      }
    }
  });

  it.each([
    ["ev_wheelchair", "w1", ["w1a", "w2a", "w3a"]],
    ["ev_guide_dog", "g1", ["g1a", "g2a", "g3a"]],
    ["ev_item", "i1", ["i1a", "i2a", "i3a"]],
  ])("эталонная цепочка %s — без нарушений ролевой модели", (eventId, start, chain) => {
    const s = createSim(data);
    openNode(s, data, eventId, start);
    for (const id of chain) pick(s, id);
    const before = computeResult(s, data);
    expect(continueInformation(s, data)).toBe(true);
    expect(computeResult(s, data)).toEqual(before);
    expect(s.active).toBeNull();
    expect(s.log.every((l) => l.correct && !l.violation)).toBe(true);
    expect(computeResult(s, data).competencies.roleModel).toBe(100);
  });

  it("кресло-коляска: таймаут ведёт в ветку «чемодан падает», разбор объясняет последствие", () => {
    const s = createSim(data);
    openNode(s, data, "ev_wheelchair", "w1");
    timeoutDialogue(s, data);
    expect(s.active?.nodeId).toBe("w_bad");
    expect(buildDebrief(data, s.log)[0].why).toContain("кресло перекрыло проход");
  });

  it("кресло-коляска: заранее согласованная помощь фиксирует приоритет обслуживания", () => {
    const s = createSim(data);
    openNode(s, data, "ev_wheelchair", "w1");
    expect(findNode(data, "ev_wheelchair", "w1")?.text).toContain("контакт-центр");
    pick(s, "w1a");
    expect(s.flags.boarding_priority_given).toBe(true);
  });

  it("собака-проводник: требовать переноску — ошибка с пояснением про п. 4.5", () => {
    const s = createSim(data);
    openNode(s, data, "ev_guide_dog", "g1");
    pick(s, "g1b");
    const [item] = buildDebrief(data, s.log);
    expect(item.correct).toBe(false);
    expect(item.why).toContain("п. 4.5");
    expect(item.violation).toMatch(/не признав/);
  });

  it("собака-проводник: документы объясняют исключение, а проход остаётся свободным", () => {
    const s = createSim(data);
    openNode(s, data, "ev_guide_dog", "g1");
    pick(s, "g1a");
    expect(findNode(data, "ev_guide_dog", "g2")?.options.find((option) => option.id === "g2a")?.text).toContain("документ");
    pick(s, "g2a");
    pick(s, "g3a");
    expect(s.flags.dog_passage_clear).toBe(true);
  });

  it("ориентация и слух используют сопровождение и электронный визуальный канал", () => {
    expect(findNode(data, "ev_vision", "v2")?.options.find((option) => option.id === "v2a")?.text).toContain("сопровождение под руку");
    expect(findNode(data, "ev_hearing", "h2")?.options.find((option) => option.id === "h2a")?.text).toMatch(/дисплее|приложении/);
  });

  it("бесхозная вещь: разбор после касания открывается только на станции", () => {
    const s = createSim(data);
    expect(data.events.find((event) => event.id === "ev_item")?.category).toBe("security");
    openNode(s, data, "ev_item", "i1");
    pick(s, "i1b");
    expect(s.flags.item_touched).toBe(true);
    s.active = null;
    tick(s, 0.1, data, {});
    expect(s.fired).not.toContain("ev_ptb");
    openNode(s, data, "ev_station_arrival", "station_arrival");
    expect(continueInformation(s, data)).toBe(true);
    tick(s, 0.1, data, {});
    expect(s.fired).toContain("ev_ptb");
  });
});
