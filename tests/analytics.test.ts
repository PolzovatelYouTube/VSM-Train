import { describe, it, expect } from "vitest";
import { createSim, openNode, chooseOption, findNode, timeoutDialogue, type LogEntry } from "../shared/engine";
import { buildDebrief, describeEffects, referenceOption, skillProfile, buildInsights, teamMatrix, topMistakes, isReady, type AnalyticsRow } from "../shared/analytics";
import { SKILL_THRESHOLDS, CRITICAL_SKILLS } from "../shared/rules";
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

describe("навыки и выводы", () => {
  const entry = (category: LogEntry["category"], correct: boolean, extra: Partial<LogEntry> = {}): LogEntry => ({
    t: 0,
    eventId: "e",
    category,
    nodeId: "n",
    optionId: "o",
    reactionMs: 1000,
    correct,
    effects: { loyalty: 0, safety: 0 },
    ...extra,
  });
  const row = (competencies: AnalyticsRow["competencies"], log: LogEntry[] = []): AnalyticsRow => ({ competencies, log });

  it("среднее по окну, статус по порогу из rules.ts, тренд к предыдущему окну", () => {
    const rows = [row({ safety: 90 }), row({ safety: 80 }), row({ safety: 40 }), row({ safety: 50 })];
    const safety = skillProfile(rows, 2).find((s) => s.key === "safety")!;
    expect(safety.value).toBe(85);
    expect(safety.status).toBe(85 >= SKILL_THRESHOLDS.safety ? "mastered" : "weak");
    expect(safety.trend).toBe(85 - 45);
    expect(skillProfile([], 2).every((s) => s.status === "none")).toBe(true);
  });

  it("вывод: уверенно в медицине, но в конфликтах пропускает «Признать ситуацию»", () => {
    const log = [
      entry("medical", true),
      entry("medical", true),
      entry("conflict", false, { step: "rule", violation: "skipped_acknowledge" }),
      entry("conflict", true),
    ];
    const [first] = buildInsights([row({ roleModel: 50 }, log)]);
    expect(first).toBe(
      "Вы уверенно действуете в медицинских ситуациях (100% верных решений), но в конфликтах часто пропускаете шаг «Признать ситуацию».",
    );
  });

  it("слабая категория, пропуски по таймеру и проседающие навыки", () => {
    const log = [entry("technical", false), entry("technical", false, { optionId: null }), entry("technical", true, { optionId: null })];
    const text = buildInsights([row({ speed: 10 }, log)]).join(" ");
    expect(text).toContain("Слабое место — технические ситуации");
    expect(text).toContain("2 решения пропущены по таймеру");
    expect(text).toContain("скорость реакции (10)");
  });

  it("нет попыток — одна подсказка, выводов не больше 4", () => {
    expect(buildInsights([])).toHaveLength(1);
    const log = [entry("medical", true), entry("medical", true), entry("conflict", false), entry("conflict", false, { optionId: null }), entry("conflict", false, { optionId: null })];
    expect(buildInsights([row({ speed: 0, safety: 0, protocol: 0 }, log)]).length).toBeLessThanOrEqual(4);
  });
});

describe("страница руководителя", () => {
  it("готовность — все критичные навыки выше порога", () => {
    const high = Object.fromEntries(CRITICAL_SKILLS.map((k) => [k, SKILL_THRESHOLDS[k]]));
    const [ready, notReady] = teamMatrix([
      { name: "А", rows: [{ competencies: high, log: [] }] },
      { name: "Б", rows: [{ competencies: { ...high, [CRITICAL_SKILLS[0]]: 0 }, log: [] }] },
    ]);
    expect(ready.ready).toBe(true);
    expect(notReady.ready).toBe(false);
    expect(isReady(skillProfile([]))).toBe(false);
  });

  it("частые ошибки агрегируются по узлу и варианту, таймауты отдельно", () => {
    const run = (optionId: string | null) => {
      const s = createSim(data);
      openNode(s, data, "ev_medicine", "m1");
      if (optionId) pick(s, optionId);
      else timeoutDialogue(s, data);
      return { scenarioId: 1, data, log: s.log };
    };
    const top = topMistakes([run("m1b"), run("m1b"), run(null), run("m1a")]);
    expect(top).toHaveLength(2);
    expect(top[0]).toMatchObject({ count: 2, category: "medical" });
    expect(top[0].better).toContain("Сочувствую");
    expect(top[1].text).toMatch(/^Не успели ответить/);
  });
});
