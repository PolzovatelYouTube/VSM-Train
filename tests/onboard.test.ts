import { describe, it, expect } from "vitest";
import { chooseOption, createSim, findNode, openNode, tick, computeResult, visibleOptions, continueInformation } from "../shared/engine";
import { scenarioDataSchema } from "../shared/scenario";
import { onboardScenario } from "../shared/scenarios/onboard";

const data = onboardScenario();

/** Выбрать вариант по id в текущем узле */
function pick(s: ReturnType<typeof createSim>, optionId: string) {
  const node = findNode(data, s.active!.eventId, s.active!.nodeId)!;
  const o = visibleOptions(node, s).find((x) => x.id === optionId);
  expect(o, `вариант ${optionId} виден в ${node.id}`).toBeDefined();
  chooseOption(s, data, o!);
}

describe("сценарий «Ситуации на борту»", () => {
  it("проходит валидацию схемы, все переходы ведут в существующие узлы", () => {
    expect(scenarioDataSchema.safeParse(data).success).toBe(true);
    for (const ev of data.events) {
      const ids = new Set(ev.nodes.map((n) => n.id));
      expect(ids.has(ev.startNode)).toBe(true);
      for (const n of ev.nodes) {
        const targets = [n.onTimeout?.next, ...n.options.flatMap((o) => [o.next, ...(o.nextIf ?? []).map((b) => b.next)])];
        for (const t of targets) if (t) expect(ids.has(t), `${ev.id}/${n.id} → ${t}`).toBe(true);
      }
    }
  });

  it("эталонная цепочка №4 проходит без нарушений ролевой модели", () => {
    const s = createSim(data);
    openNode(s, data, "ev_pet", "p1");
    for (const id of ["p1a", "p2a", "p3a"]) pick(s, id);
    expect(continueInformation(s, data)).toBe(true);
    expect(s.active).toBeNull();
    expect(s.log.every((l) => !l.violation)).toBe(true);
    expect(computeResult(s, data).competencies.roleModel).toBe(100);
  });

  it("№6: при безопасности < 40 решение ведёт к вызову ПТБ", () => {
    const s = createSim(data);
    s.safety = 25;
    openNode(s, data, "ev_drunk", "d3");
    pick(s, "d3a");
    expect(s.active?.nodeId).toBe("d_ptb");
  });

  it("№4: при отсутствии переносок не обещает продажу и вызывает начальника поезда", () => {
    const s = createSim(data);
    s.flags.carrier_out_of_stock = true;
    openNode(s, data, "ev_pet", "p3");

    expect(visibleOptions(findNode(data, "ev_pet", "p3")!, s).map((option) => option.id)).toEqual(["p3c", "p3b"]);
    pick(s, "p3c");
    expect(s.flags.np_called).toBe(true);
    expect(s.flags.carrier_shortage_reported).toBe(true);
  });

  it("№6: силовые действия получают безопасную альтернативу в обратной связи", () => {
    for (const id of ["d3b", "d6b"]) {
      const option = data.events.find((event) => event.id === "ev_drunk")!.nodes
        .flatMap((node) => node.options).find((item) => item.id === id)!;
      expect(option.feedback).toContain("изолирует других пассажиров");
      expect(option.feedback).toContain("транспортной полиции");
    }
  });

  it("№28: вариант «начальник поезда уже в курсе» виден только с флагом np_called", () => {
    const s = createSim(data);
    const m3 = findNode(data, "ev_medicine", "m3")!;
    expect(visibleOptions(m3, s).some((o) => o.id === "m3b")).toBe(false);
    s.flags.np_called = true;
    expect(visibleOptions(m3, s).some((o) => o.id === "m3b")).toBe(true);
  });

  it("№28: поиск медработника по громкой связи запрашивается у начальника поезда", () => {
    const option = findNode(data, "ev_medicine", "m3")!.options.find((item) => item.id === "m3a")!;
    expect(option.text).toContain("Запросить начальника поезда сделать объявление");
  });

  it("лояльность < 30 запускает жалобу начальнику поезда", () => {
    const s = createSim(data);
    s.loyalty = 25;
    tick(s, 0.1, data, { pauseWhileDialogue: false });
    expect(s.fired).toContain("ev_complaint");
  });
});
