/**
 * Геймификация: чистые функции над историей попыток (без БД и Express).
 * Все числа — из ./rules, чтобы правило менялось в одном месте.
 */
import { XP_RULES, LEVELS, POINTS_TTL_DAYS, EXPIRY_WARNING_DAYS } from "./rules";
import { EVENT_CATEGORY_LABEL } from "./scenario";
import type { ChallengeRule } from "./schema";
import type { LogEntry } from "./engine";

export type AttemptMode = "training" | "check";

export const xpForAttempt = (mode: AttemptMode, score: number) =>
  Math.round(XP_RULES[mode].base + Math.max(0, score) * XP_RULES[mode].perScore);

export interface LevelInfo {
  level: number; // 1..LEVELS.length
  title: string;
  xp: number;
  levelMinXp: number;
  nextLevelXp: number | null; // null — максимальный уровень
  progress: number; // 0..1 до следующего уровня
}

export function levelFor(xp: number): LevelInfo {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].minXp) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  return {
    level: i + 1,
    title: cur.title,
    xp,
    levelMinXp: cur.minXp,
    nextLevelXp: next?.minXp ?? null,
    progress: next ? (xp - cur.minXp) / (next.minXp - cur.minXp) : 1,
  };
}

// ───────────────────────────── Сгорающие баллы ─────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** Минимум полей попытки, нужный для подсчёта баллов */
export interface PointsRow {
  mode: string;
  points: number;
  createdAt: number;
}

export const expiresAt = (row: PointsRow) => row.createdAt + POINTS_TTL_DAYS * DAY_MS;

/** Несгоревшие баллы практики на момент now */
export const activePoints = (rows: PointsRow[], now: number) =>
  rows.filter((r) => r.mode === "check" && expiresAt(r) > now).reduce((s, r) => s + r.points, 0);

export interface ExpiringPoints {
  points: number; // сколько баллов сгорит в окне предупреждения
  inDays: number; // через сколько дней сгорит ближайшая партия (округление вверх)
}

/** Баллы, которые сгорят в ближайшие EXPIRY_WARNING_DAYS дней; null — сгорать нечему */
export function expiringPoints(rows: PointsRow[], now: number): ExpiringPoints | null {
  const soon = rows.filter((r) => {
    const left = expiresAt(r) - now;
    return r.mode === "check" && r.points > 0 && left > 0 && left <= EXPIRY_WARNING_DAYS * DAY_MS;
  });
  if (!soon.length) return null;
  const nearest = Math.min(...soon.map(expiresAt));
  return {
    points: soon.reduce((s, r) => s + r.points, 0),
    inDays: Math.max(1, Math.ceil((nearest - now) / DAY_MS)),
  };
}

// ───────────────────────────── Челленджи ─────────────────────────────

/** Минимум полей попытки для подсчёта прогресса челленджа (log уже распарсен) */
export interface ProgressRow {
  score: number;
  createdAt: number;
  log: Pick<LogEntry, "category" | "optionId">[];
}

/** Подходит ли попытка под правило челленджа */
export function attemptCounts(rule: ChallengeRule, row: ProgressRow): boolean {
  switch (rule.type) {
    case "complete_category":
      return row.log.some((l) => l.category === rule.category);
    case "min_score":
      return row.score >= rule.score;
    case "no_timeouts":
      return row.log.length > 0 && row.log.every((l) => l.optionId !== null);
  }
}

/** Прогресс по попыткам внутри окна челленджа */
export function challengeProgress(
  rule: ChallengeRule,
  window: { startsAt: number; endsAt: number },
  rows: ProgressRow[],
) {
  const current = rows.filter((r) => r.createdAt >= window.startsAt && r.createdAt <= window.endsAt && attemptCounts(rule, r)).length;
  return { current: Math.min(current, rule.count), target: rule.count, done: current >= rule.count };
}

export function describeRule(rule: ChallengeRule): string {
  switch (rule.type) {
    case "complete_category":
      return `Пройти ${rule.count} рейс(а) с ситуацией «${EVENT_CATEGORY_LABEL[rule.category]}»`;
    case "min_score":
      return `Набрать ${rule.score}+ баллов в ${rule.count} рейсах`;
    case "no_timeouts":
      return `Пройти ${rule.count} рейс(а) без пропущенных решений`;
  }
}
