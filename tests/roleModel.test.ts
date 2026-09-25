import { describe, it, expect } from "vitest";
import { roleStepViolation, roleModelScore, createSim, chooseOption, computeResult, openNode, type LogEntry } from "../shared/engine";
import { type DialogueOption, type RoleStep } from "../shared/scenario";
import { standardDemo } from "./helpers";
import { ROLE_MODEL } from "../shared/rules";

describe("roleStepViolation", () => {
  it("правило без признания — нарушение", () => {
    expect(roleStepViolation([], "rule")).toBe("skipped_acknowledge");
    expect(roleStepViolation(["acknowledge"], "rule")).toBeNull();
  });
  it("шаг назад — нарушение порядка, возврат к «Признать» разрешён", () => {
    expect(roleStepViolation(["acknowledge", "rule", "assure"], "solution")).toBe("order");
    expect(roleStepViolation(["acknowledge", "rule", "solution"], "acknowledge")).toBeNull();
    expect(roleStepViolation(["acknowledge"], "solution")).toBeNull(); // правило можно пропустить
  });
});

describe("roleModelScore", () => {
  const e = (step?: RoleStep, violation?: LogEntry["violation"]): LogEntry => ({
    t: 0, eventId: "e", category: "conflict", nodeId: "n", optionId: "o", reactionMs: 0, correct: true,
    effects: { loyalty: 0, safety: 0 }, step, violation,
  });
  it("нет размеченных реплик — 100", () => expect(roleModelScore([e(), e()])).toBe(100));
  it("доля реплик без нарушений", () => {
    expect(roleModelScore([e("acknowledge"), e("rule"), e("solution"), e("assure")])).toBe(100);
    expect(roleModelScore([e("rule", "skipped_acknowledge"), e("solution"), e(), e("assure")])).toBe(67);
  });
});

describe("chooseOption и ролевая модель", () => {
  const opt = (id: string, step: RoleStep): DialogueOption => ({ id, text: "", next: "n1", effects: { loyalty: 0, safety: 0 }, step });
  const setup = () => {
    const data = standardDemo();
    const s = createSim(data);
    s.loyalty = 50;
    openNode(s, data, "ev_conflict", "n1");
    return { data, s };
  };

  it("штраф за правило без признания попадает в шкалу и в журнал", () => {
    const { data, s } = setup();
    chooseOption(s, data, opt("r", "rule"));
    expect(s.loyalty).toBe(50 + ROLE_MODEL.violationPenalty.loyalty);
    expect(s.log[0].violation).toBe("skipped_acknowledge");
    expect(computeResult(s, data).competencies.roleModel).toBe(0);
  });

  it("бонус за полную цепочку", () => {
    const { data, s } = setup();
    for (const step of ["acknowledge", "rule", "solution", "assure"] as RoleStep[]) chooseOption(s, data, opt(step, step));
    expect(s.loyalty).toBe(50 + ROLE_MODEL.fullChainBonus.loyalty);
    expect(computeResult(s, data).competencies.roleModel).toBe(100);
  });
});
