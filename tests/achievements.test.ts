import { describe, it, expect } from "vitest";
import { evaluateAchievements, ruleMet, ACHIEVEMENTS, type AchievementRow } from "../shared/achievements";
import { ACHIEVEMENT_THRESHOLDS as T } from "../shared/rules";

const row = (over: Partial<AchievementRow> = {}): AchievementRow => ({
  mode: "check",
  safety: 60,
  loyalty: 60,
  accuracy: 0.5,
  avgReactionMs: 9000,
  competencies: {},
  ...over,
});
const unlocked = (rows: AchievementRow[], challengesCompleted = 0) =>
  evaluateAchievements({ attempts: rows, challengesCompleted }).filter((a) => a.unlocked).map((a) => a.id);

describe("справочник достижений", () => {
  it("id уникальны", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("без попыток ничего не открыто", () => {
    expect(unlocked([])).toEqual([]);
  });

  it("«По методичке» — за roleModel не ниже порога", () => {
    expect(unlocked([row({ competencies: { roleModel: T.roleModel - 1 } })])).not.toContain("role_model");
    expect(unlocked([row({ competencies: { roleModel: T.roleModel } })])).toContain("role_model");
  });

  it("«Челленджер» — за выполненный челлендж", () => {
    expect(unlocked([row()], 0)).not.toContain("challenger");
    expect(unlocked([row()], 1)).toContain("challenger");
  });

  it("«Без ошибок» засчитывается только в проверочном рейсе", () => {
    expect(unlocked([row({ mode: "training", accuracy: 1 })])).not.toContain("flawless");
    expect(unlocked([row({ mode: "check", accuracy: 1 })])).toContain("flawless");
  });

  it("новая ачивка добавляется одной записью", () => {
    const defs = [...ACHIEVEMENTS, { id: "speedy", title: "Шустрый", description: "", rule: { type: "reaction_below" as const, ms: 2000 } }];
    const res = evaluateAchievements({ attempts: [row({ avgReactionMs: 1500 })], challengesCompleted: 0 }, defs);
    expect(res.find((a) => a.id === "speedy")?.unlocked).toBe(true);
    expect(ruleMet({ type: "attempts", count: 2 }, { attempts: [row()], challengesCompleted: 0 })).toBe(false);
  });
});
