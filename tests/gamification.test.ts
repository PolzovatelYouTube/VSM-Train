import { describe, it, expect } from "vitest";
import { xpForAttempt, levelFor, activePoints, expiringPoints } from "../shared/gamification";
import { LEVELS, XP_RULES, POINTS_TTL_DAYS } from "../shared/rules";

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

describe("сгорающие баллы", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 100 * DAY;
  const row = (daysAgo: number, points: number, mode = "check") => ({ mode, points, createdAt: now - daysAgo * DAY });

  it("рейтинг считает только несгоревшие баллы проверочных рейсов", () => {
    const rows = [row(1, 50), row(POINTS_TTL_DAYS + 1, 70), row(2, 40, "training")];
    expect(activePoints(rows, now)).toBe(50);
  });

  it("предупреждение: сколько сгорит и через сколько дней", () => {
    const rows = [row(POINTS_TTL_DAYS - 2, 120), row(POINTS_TTL_DAYS - 1, 30), row(1, 80)];
    expect(expiringPoints(rows, now)).toEqual({ points: 150, inDays: 1 });
  });

  it("нечему сгорать — null", () => {
    expect(expiringPoints([row(1, 80)], now)).toBeNull();
    expect(expiringPoints([row(POINTS_TTL_DAYS + 1, 80)], now)).toBeNull(); // уже сгорели
  });
});
