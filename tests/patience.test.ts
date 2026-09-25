import { describe, it, expect } from "vitest";
import { createSim, chooseOption, openNode, timeoutDialogue, eventCarType } from "../shared/engine";
import { buildCar, carSchema, aisleRow, demoScenario, type CarType } from "../shared/scenario";
import { PATIENCE_BY_CLASS, TIMEOUT_PENALTY } from "../shared/rules";

/** Демо, где вагон с конфликтным пассажиром (№2) получает заданный класс */
function demoWithClass(type: CarType) {
  const data = demoScenario();
  data.train.cars[1].type = type;
  return data;
}

describe("терпение по классу вагона", () => {
  it("таймер узла масштабируется: первый класс быстрее стандарта", () => {
    const first = demoWithClass("first");
    const std = demoWithClass("standard");
    const s1 = createSim(first);
    const s2 = createSim(std);
    openNode(s1, first, "ev_conflict", "n1"); // timerSec = 20
    openNode(s2, std, "ev_conflict", "n1");
    expect(eventCarType(s1, first, "ev_conflict")).toBe("first");
    expect(s1.active?.limitSec).toBe(20 * PATIENCE_BY_CLASS.first.timer);
    expect(s2.active?.limitSec).toBe(20);
    expect(s1.active!.limitSec!).toBeLessThan(s2.active!.limitSec!);
  });

  it("потеря лояльности усиливается, рост — нет", () => {
    const data = demoWithClass("first");
    const s = createSim(data);
    s.loyalty = 50;
    openNode(s, data, "ev_conflict", "n1");
    timeoutDialogue(s, data);
    expect(s.loyalty).toBe(50 + Math.round(TIMEOUT_PENALTY.loyalty * PATIENCE_BY_CLASS.first.loyaltyLoss));
    openNode(s, data, "ev_conflict", "n2");
    chooseOption(s, data, { id: "x", text: "", next: null, effects: { loyalty: 10, safety: 0 } });
    expect(s.log.at(-1)?.effects.loyalty).toBe(10);
  });
});

describe("компоновки вагонов", () => {
  const seatsInRow = (type: CarType) => buildCar(1, type, 4).cells.filter((c) => c.kind === "seat" && c.x === 2).length;
  it("first 2+1, business/comfort 2+2, standard 3+2", () => {
    expect(seatsInRow("first")).toBe(3);
    expect(seatsInRow("business")).toBe(4);
    expect(seatsInRow("comfort")).toBe(4);
    expect(seatsInRow("standard")).toBe(5);
    expect(aisleRow("standard")).toBe(3);
  });
  it("старый тип second мигрирует в comfort", () => {
    const car = { ...buildCar(1, "comfort", 4), type: "second" };
    expect(carSchema.parse(car).type).toBe("comfort");
  });
});
