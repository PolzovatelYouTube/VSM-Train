import { describe, it, expect } from "vitest";
import { evalCondition, resolveNext, visibleOptions, createSim, chooseOption, openNode } from "../shared/engine";
import { type DialogueOption, type DialogueNode } from "../shared/scenario";
import { standardDemo } from "./helpers";

const st = (over: Partial<{ loyalty: number; safety: number; flags: Record<string, boolean | number> }> = {}) => ({
  loyalty: 50,
  safety: 50,
  flags: {},
  ...over,
});

describe("evalCondition", () => {
  it("флаг: выставлен / не выставлен / сравнение", () => {
    expect(evalCondition({ flag: "carrier" }, st({ flags: { carrier: true } }))).toBe(true);
    expect(evalCondition({ flag: "carrier" }, st())).toBe(false);
    expect(evalCondition({ flag: "carrier", eq: false }, st())).toBe(true); // неизвестный = false
    expect(evalCondition({ flag: "warnings", eq: 2 }, st({ flags: { warnings: 2 } }))).toBe(true);
    expect(evalCondition({ flag: "warnings", eq: 0 }, st())).toBe(true); // неизвестный = 0
    expect(evalCondition({ flag: "warnings" }, st({ flags: { warnings: 0 } }))).toBe(false);
  });

  it("диапазоны шкал: lt строго меньше, gte больше или равно", () => {
    expect(evalCondition({ loyalty: { lt: 30 } }, st({ loyalty: 29 }))).toBe(true);
    expect(evalCondition({ loyalty: { lt: 30 } }, st({ loyalty: 30 }))).toBe(false);
    expect(evalCondition({ safety: { gte: 40 } }, st({ safety: 40 }))).toBe(true);
    expect(evalCondition({ safety: { gte: 40, lt: 60 } }, st({ safety: 60 }))).toBe(false);
  });

  it("all / any, в том числе вложенные", () => {
    const c = { all: [{ flag: "a" }, { any: [{ loyalty: { lt: 30 } }, { safety: { lt: 40 } }] }] };
    expect(evalCondition(c, st({ flags: { a: true }, safety: 10 }))).toBe(true);
    expect(evalCondition(c, st({ flags: { a: true } }))).toBe(false);
    expect(evalCondition(c, st({ safety: 10 }))).toBe(false);
    expect(evalCondition({ all: [] }, st())).toBe(true);
    expect(evalCondition({ any: [] }, st())).toBe(false);
  });
});

describe("nextIf и видимость вариантов", () => {
  const opt: DialogueOption = {
    id: "o",
    text: "",
    next: "calm",
    effects: { loyalty: 0, safety: 0 },
    nextIf: [
      { if: { loyalty: { lt: 30 } }, next: "complaint" },
      { if: { safety: { lt: 40 } }, next: null },
    ],
  };

  it("первая сработавшая ветка побеждает, иначе next", () => {
    expect(resolveNext(opt, st({ loyalty: 10, safety: 10 }))).toBe("complaint");
    expect(resolveNext(opt, st({ safety: 10 }))).toBe(null); // ветка может завершать событие
    expect(resolveNext(opt, st())).toBe("calm");
  });

  it("вариант с if скрыт, пока условие ложно", () => {
    const node: DialogueNode = {
      id: "n",
      speaker: "",
      text: "",
      options: [
        { id: "a", text: "", next: null, effects: { loyalty: 0, safety: 0 } },
        { id: "b", text: "", next: null, effects: { loyalty: 0, safety: 0 }, if: { flag: "carrier" } },
      ],
    };
    expect(visibleOptions(node, st()).map((o) => o.id)).toEqual(["a"]);
    expect(visibleOptions(node, st({ flags: { carrier: true } })).map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("chooseOption выставляет флаги и считает переход после эффектов", () => {
    const data = standardDemo();
    const s = createSim(data);
    s.loyalty = 35;
    openNode(s, data, "ev_conflict", "n1");
    chooseOption(s, data, { ...opt, effects: { loyalty: -10, safety: 0 }, set: { argued: true }, nextIf: [{ if: { loyalty: { lt: 30 } }, next: "n3" }] });
    expect(s.flags.argued).toBe(true);
    expect(s.loyalty).toBe(25);
    expect(s.active?.nodeId).toBe("n3");
  });
});
