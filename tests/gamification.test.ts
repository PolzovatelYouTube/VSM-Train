import { describe, it, expect } from "vitest";
import { xpForAttempt, levelFor } from "../shared/gamification";
import { LEVELS, XP_RULES } from "../shared/rules";

describe("опыт и уровни", () => {
  it("опыт за попытку: проверочный рейс даёт больше тренировки", () => {
    expect(xpForAttempt("training", 80)).toBe(Math.round(XP_RULES.training.base + 80 * XP_RULES.training.perScore));
    expect(xpForAttempt("check", 80)).toBeGreaterThan(xpForAttempt("training", 80));
    expect(xpForAttempt("check", -5)).toBe(XP_RULES.check.base); // отрицательный балл не отнимает опыт
  });

  it("уровень по порогам, прогресс до следующего", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: LEVELS[0].title, progress: 0 });
    const mid = LEVELS[1].minXp + (LEVELS[2].minXp - LEVELS[1].minXp) / 2;
    expect(levelFor(mid)).toMatchObject({ level: 2, nextLevelXp: LEVELS[2].minXp, progress: 0.5 });
    expect(levelFor(LEVELS[1].minXp).level).toBe(2); // порог включительно
  });

  it("максимальный уровень: следующего нет, прогресс 1", () => {
    const top = levelFor(LEVELS[LEVELS.length - 1].minXp + 1000);
    expect(top.level).toBe(LEVELS.length);
    expect(top.nextLevelXp).toBeNull();
    expect(top.progress).toBe(1);
  });
});
