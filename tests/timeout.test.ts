import { describe, it, expect } from "vitest";
import { createSim, tick, timeoutDialogue, openNode } from "../shared/engine";
import { standardDemo } from "./helpers";
import { TIMEOUT_PENALTY } from "../shared/rules";

describe("onTimeout", () => {
  it("без onTimeout — штраф TIMEOUT_PENALTY и конец события", () => {
    const data = standardDemo();
    const s = createSim(data);
    openNode(s, data, "ev_conflict", "n1");
    timeoutDialogue(s, data);
    expect(s.loyalty).toBe(data.initial.loyalty + TIMEOUT_PENALTY.loyalty);
    expect(s.safety).toBe(data.initial.safety + TIMEOUT_PENALTY.safety);
    expect(s.active).toBeNull();
    expect(s.log[0].optionId).toBeNull();
  });

  it("с onTimeout — свои эффекты, флаг и переход в узел-последствие", () => {
    const data = standardDemo();
    const ev = data.events.find((e) => e.id === "ev_conflict")!;
    ev.nodes[0].onTimeout = {
      next: "n3",
      effects: { loyalty: -25, safety: 0 },
      set: { complained: true },
      text: "пассажир ушёл жаловаться начальнику поезда",
    };
    const s = createSim(data);
    openNode(s, data, "ev_conflict", "n1");
    timeoutDialogue(s, data);
    expect(s.loyalty).toBe(data.initial.loyalty - 25);
    expect(s.safety).toBe(data.initial.safety);
    expect(s.flags.complained).toBe(true);
    expect(s.active?.nodeId).toBe("n3");
    expect(s.feed.at(-1)?.text).toContain("жаловаться");
  });

  it("tick вызывает таймаут, когда таймер узла истёк (проверочный режим)", () => {
    const data = standardDemo();
    const s = createSim(data);
    openNode(s, data, "ev_conflict", "n1"); // timerSec = 20
    for (let i = 0; i < 21; i++) tick(s, 1, data, { pauseWhileDialogue: false });
    expect(s.log.some((l) => l.optionId === null)).toBe(true);
  });
});
