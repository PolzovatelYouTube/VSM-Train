/**
 * Геймификация: чистые функции над историей попыток (без БД и Express).
 * Все числа — из ./rules, чтобы правило менялось в одном месте.
 */
import { XP_RULES, LEVELS, POINTS_TTL_DAYS, EXPIRY_WARNING_DAYS } from "./rules";

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
