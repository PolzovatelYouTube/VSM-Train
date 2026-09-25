import { describe, it, expect } from "vitest";
import { chooseOption, createSim, findNode, openNode, tick, computeResult, visibleOptions, timeoutDialogue } from "../shared/engine";
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
        expect(n.options.some((o) => o.correct), `${ev.id}/${n.id}`).toBe(true);
        const targets = [n.onTimeout?.next, ...n.options.flatMap((o) => [o.next, ...(o.nextIf ?? []).map((b) => b.next)])];
        for (const t of targets) if (t) expect(ids.has(t), `${ev.id}/${n.id} → ${t}`).toBe(true);
      }
    }
  });

  it.each([
    ["ev_wheelchair", "w1", ["w1a", "w2a", "w3a", "w4a"]],
    ["ev_guide_dog", "g1", ["g1a", "g2a", "g3a", "g4a"]],
    ["ev_item", "i1", ["i1a", "i2a", "i3a", "i4a"]],
  ])("эталонная цепочка %s — без нарушений ролевой модели", (eventId, start, chain) => {
    const s = createSim(data);
    openNode(s, data, eventId, start);
    for (const id of chain) pick(s, id);
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

  it("собака-проводник: требовать переноску — ошибка с пояснением про п. 4.5", () => {
    const s = createSim(data);
    openNode(s, data, "ev_guide_dog", "g1");
    pick(s, "g1b");
    const [item] = buildDebrief(data, s.log);
    expect(item.correct).toBe(false);
    expect(item.why).toContain("п. 4.5");
    expect(item.violation).toMatch(/не признав/);
  });

  it("№41: если вещь трогали, срабатывает событие «Вопросы ПТБ»", () => {
    const s = createSim(data);
    openNode(s, data, "ev_item", "i1");
    pick(s, "i1b");
    expect(s.flags.item_touched).toBe(true);
    s.active = null;
    tick(s, 0.1, data, {});
    expect(s.fired).toContain("ev_ptb");
  });
});
