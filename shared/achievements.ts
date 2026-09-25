/**
 * Справочник достижений. Новая ачивка = одна запись в ACHIEVEMENTS:
 * правило описывается декларативно, проверку делает evaluateAchievements().
 */
import { ACHIEVEMENT_THRESHOLDS as T } from "./rules";
import type { SimResult } from "./engine";

type CompetencyKey = keyof SimResult["competencies"];

export type AchievementRule =
  | { type: "attempts"; count: number } // пройдено N рейсов (любых)
  | { type: "meter"; meter: "safety" | "loyalty"; gte: number } // шкала по итогам рейса
  | { type: "reaction_below"; ms: number } // средняя реакция быстрее
  | { type: "accuracy"; gte: number; mode?: "training" | "check" } // доля верных решений
  | { type: "competency"; key: CompetencyKey; gte: number } // компетенция в рейсе
  | { type: "challenges"; count: number }; // выполнено N челленджей

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rule: AchievementRule;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_run", title: "Первый рейс", description: "Пройти любой сценарий", rule: { type: "attempts", count: 1 } },
  {
    id: "safety_first",
    title: "Безопасность превыше всего",
    description: `Завершить рейс с рейтингом безопасности ${T.safetyFirst}+`,
    rule: { type: "meter", meter: "safety", gte: T.safetyFirst },
  },
  {
    id: "diplomat",
    title: "Дипломат",
    description: `Лояльность пассажиров ${T.diplomat}+ по итогам рейса`,
    rule: { type: "meter", meter: "loyalty", gte: T.diplomat },
  },
  {
    id: "lightning",
    title: "Молния",
    description: `Средняя реакция быстрее ${T.lightningMs / 1000} секунд`,
    rule: { type: "reaction_below", ms: T.lightningMs },
  },
  {
    id: "flawless",
    title: "Без ошибок",
    description: "Все решения верные в проверочном рейсе",
    rule: { type: "accuracy", gte: T.flawlessAccuracy, mode: "check" },
  },
  {
    id: "role_model",
    title: "По методичке",
    description: `Ролевая модель общения ${T.roleModel}+ в рейсе: признать → правило → решение → заверить`,
    rule: { type: "competency", key: "roleModel", gte: T.roleModel },
  },
  {
    id: "challenger",
    title: "Челленджер",
    description: "Выполнить челлендж",
    rule: { type: "challenges", count: T.challenges },
  },
  {
    id: "veteran",
    title: "Ветеран ВСМ",
    description: `${T.veteranRuns} пройденных рейсов`,
    rule: { type: "attempts", count: T.veteranRuns },
  },
];

/** Поля попытки, по которым проверяются правила (competencies уже распарсены) */
export interface AchievementRow {
  mode: string;
  safety: number;
  loyalty: number;
  accuracy: number;
  avgReactionMs: number;
  competencies: Partial<Record<CompetencyKey, number>>;
}

export interface AchievementContext {
  attempts: AchievementRow[];
  challengesCompleted: number;
}

export function ruleMet(rule: AchievementRule, ctx: AchievementContext): boolean {
  const rows = ctx.attempts;
  switch (rule.type) {
    case "attempts":
      return rows.length >= rule.count;
    case "meter":
      return rows.some((r) => r[rule.meter] >= rule.gte);
    case "reaction_below":
      return rows.some((r) => r.avgReactionMs > 0 && r.avgReactionMs < rule.ms);
    case "accuracy":
      return rows.some((r) => (!rule.mode || r.mode === rule.mode) && r.accuracy >= rule.gte);
    case "competency":
      return rows.some((r) => (r.competencies[rule.key] ?? 0) >= rule.gte);
    case "challenges":
      return ctx.challengesCompleted >= rule.count;
  }
}

export const evaluateAchievements = (ctx: AchievementContext, defs: AchievementDef[] = ACHIEVEMENTS) =>
  defs.map(({ id, title, description, rule }) => ({ id, title, description, unlocked: ruleMet(rule, ctx) }));
