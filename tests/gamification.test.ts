import { describe, it, expect } from "vitest";
import { xpForAttempt, levelFor, activePoints, expiringPoints, challengeProgress, type ProgressRow } from "../shared/gamification";
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

describe("челленджи", () => {
  const win = { startsAt: 1000, endsAt: 2000 };
  const med = { category: "medical" as const, optionId: "o1" };
  const timeout = { category: "conflict" as const, optionId: null };
  const row = (createdAt: number, score: number, log: ProgressRow["log"]) => ({ createdAt, score, log });

  it("complete_category: считаются только попытки с нужной категорией внутри окна", () => {
    const rows = [row(1500, 50, [med]), row(1600, 50, [timeout]), row(2500, 50, [med])];
    expect(challengeProgress({ type: "complete_category", category: "medical", count: 2 }, win, rows)).toEqual({ current: 1, target: 2, done: false });
  });

  it("min_score и no_timeouts", () => {
    const rows = [row(1100, 90, [med]), row(1200, 60, [med, timeout]), row(1300, 85, [med])];
    expect(challengeProgress({ type: "min_score", score: 80, count: 2 }, win, rows).done).toBe(true);
    expect(challengeProgress({ type: "no_timeouts", count: 3 }, win, rows).current).toBe(2);
  });

  it("прогресс не превышает цель", () => {
    const rows = [row(1100, 90, [med]), row(1200, 95, [med]), row(1300, 99, [med])];
    expect(challengeProgress({ type: "min_score", score: 80, count: 2 }, win, rows)).toEqual({ current: 2, target: 2, done: true });
  });
});
