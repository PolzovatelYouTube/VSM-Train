import { describe, it, expect } from "vitest";
import { createSim, openNode, chooseOption, findNode, timeoutDialogue } from "../shared/engine";
import { buildDebrief, describeEffects, referenceOption } from "../shared/analytics";
import { onboardScenario } from "../shared/scenarios/onboard";

const data = onboardScenario();
const pick = (s: ReturnType<typeof createSim>, id: string) =>
  chooseOption(s, data, findNode(data, s.active!.eventId, s.active!.nodeId)!.options.find((o) => o.id === id)!);

describe("разбор рейса", () => {
  it("для неверного решения показывает эталонный вариант узла и подсказку", () => {
    const s = createSim(data);
    openNode(s, data, "ev_medicine", "m1");
    pick(s, "m1b"); // дать свою таблетку
    const [item] = buildDebrief(data, s.log);
    expect(item.correct).toBe(false);
    expect(item.choice).toContain("личной аптечки");
    expect(item.better?.text).toContain("Сочувствую");
    expect(item.better?.hint).toBe("Выяснить причину недомогания.");
  });

  it("для верного решения «как лучше» не показывается", () => {
    const s = createSim(data);
    openNode(s, data, "ev_pet", "p1");
    pick(s, "p1a");
    expect(buildDebrief(data, s.log)[0].better).toBeNull();
  });

  it("нарушение ролевой модели попадает в разбор", () => {
    const s = createSim(data);
    openNode(s, data, "ev_pet", "p1");
    pick(s, "p1b"); // сразу правило, не признав ситуацию
    expect(buildDebrief(data, s.log)[0].violation).toMatch(/не признав/);
  });

  it("таймаут: выбор null, в «почему» — последствие ветки onTimeout", () => {
    const s = createSim(data);
    openNode(s, data, "ev_pet", "p1");
    timeoutDialogue(s, data);
    const [item] = buildDebrief(data, s.log);
    expect(item.choice).toBeNull();
    expect(item.why).toContain("собака спрыгнула");
  });

  it("describeEffects и referenceOption", () => {
    expect(describeEffects({ loyalty: -15, safety: 5 })).toBe("лояльность -15, безопасность +5");
    expect(describeEffects({ loyalty: 0, safety: 0 })).toBe("шкалы не изменились");
    // m3: эталон — вариант без условия показа, а не «НП уже в курсе» (виден только с флагом)
    expect(referenceOption(findNode(data, "ev_medicine", "m3")!.options)?.id).toBe("m3a");
  });
});
