/**
 * Геймификация: чистые функции над историей попыток (без БД и Express).
 * Все числа — из ./rules, чтобы правило менялось в одном месте.
 */
import { XP_RULES, LEVELS } from "./rules";

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
