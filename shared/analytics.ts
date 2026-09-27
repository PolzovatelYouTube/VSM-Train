/**
 * Обратная связь и аналитика компетенций: чистые функции над сценарием и логом решений.
 * Используются в разборе рейса (клиент), профиле и на странице руководителя (сервер).
 */
import { type ScenarioData, type DialogueOption, type EventCategory, type RoleStep } from "./scenario";
import { findEvent, findNode, ROLE_VIOLATION_TEXT, type LogEntry } from "./engine";
import {
  TIMEOUT_PENALTY,
  SKILL_WINDOW,
  SKILL_THRESHOLDS,
  INSIGHT_MIN_DECISIONS,
  INSIGHT_STRONG,
  INSIGHT_WEAK,
  CRITICAL_SKILLS,
} from "./rules";

// ───────────────────────────── Разбор рейса ─────────────────────────────

export interface DebriefItem {
  eventTitle: string;
  category: EventCategory;
  speaker: string;
  situation: string; // реплика / описание узла
  choice: string | null; // текст выбранного варианта; null — время истекло
  step?: RoleStep;
  correct: boolean;
  effects: { loyalty: number; safety: number };
  why: string; // почему так изменились шкалы
  better: { text: string; hint?: string } | null; // как можно было лучше (эталонный вариант узла)
  violation: string | null; // нарушение ролевой модели
  context?: LogEntry["context"];
  consequences?: string[];
  changes?: string[];
  competence?: string;
  timeCostSec?: number;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function describeEffects(fx: { loyalty: number; safety: number }): string {
  const parts = [];
  if (fx.loyalty) parts.push(`лояльность ${signed(fx.loyalty)}`);
  if (fx.safety) parts.push(`безопасность ${signed(fx.safety)}`);
  return parts.length ? parts.join(", ") : "шкалы не изменились";
}

/** Эталонный вариант узла: верный и без условия показа (его видит любой игрок), иначе любой верный */
export function referenceOption(options: DialogueOption[]): DialogueOption | undefined {
  return options.find((o) => o.correct && !o.if) ?? options.find((o) => o.correct);
}

/** Разбор каждого решения: ситуация, выбор, изменение шкал и почему, как можно было лучше */
export function buildDebrief(data: ScenarioData, log: LogEntry[]): DebriefItem[] {
  return log.flatMap((l, index) => {
    if (l.cause) return [];
    const ev = findEvent(data, l.eventId);
    const node = findNode(data, l.eventId, l.nodeId);
    const option = node?.options.find((o) => o.id === l.optionId);
    // Не предлагать статический эталон там, где оценка зависит от контекста.
    const ref = node && !node.options.some((o) => o.outcomes) ? referenceOption(node.options) : undefined;
    const isTimeout = l.optionId === null;

    let why: string;
    if (isTimeout) {
      const consequence = l.feedback ?? node?.onTimeout?.text ?? `штраф за просрочку (${describeEffects(TIMEOUT_PENALTY)})`;
      why = l.cause ? consequence : `Решение не принято за ${l.limitSec ?? node?.timerSec ?? "?"} с: ${consequence}.`;
    } else {
      why = l.feedback ?? option?.feedback ?? (l.correct ? "Действие по стандарту обслуживания." : "Действие расходится со стандартом обслуживания.");
    }

    return {
      eventTitle: ev?.title ?? l.eventId,
      category: l.category,
      speaker: node?.speaker ?? "",
      situation: node?.text ?? "",
      choice: isTimeout ? null : (option?.text ?? l.optionId),
      step: l.step,
      correct: l.correct,
      effects: l.effects,
      context: l.context,
      timeCostSec: l.timeCostSec,
      competence: `${l.category === "medical" || l.category === "technical" || l.category === "security" ? "Безопасность" : "Коммуникация"}: ${l.correct ? "решение обосновано" : "требует внимания"}`,
      changes: Object.entries(l.flagsSet ?? {}).map(([flag, value]) =>
        `${ev?.context?.find((c) => c.flag === flag)?.label ?? flag}: ${value === true ? "да" : value === false ? "нет" : value}`),
      consequences: Array.from(new Set(log.filter((row) => row.causes?.includes(index))
        .map((row) => findEvent(data, row.eventId)?.title ?? row.eventId))),
      why,
      better: !l.cause && !l.correct && ref && ref.id !== l.optionId ? { text: ref.text, hint: ref.hint } : null,
      violation: l.violation ? `Ролевая модель: ${ROLE_VIOLATION_TEXT[l.violation]}` : null,
    };
  });
}

// ───────────────────────────── Навыки и выводы ─────────────────────────────

export type SkillKey = keyof typeof SKILL_THRESHOLDS;
export const SKILL_KEYS = Object.keys(SKILL_THRESHOLDS) as SkillKey[];

export const SKILL_LABEL: Record<SkillKey, string> = {
  communication: "Коммуникация",
  safety: "Безопасность",
  speed: "Скорость реакции",
  protocol: "Соблюдение алгоритмов",
  roleModel: "Ролевая модель общения",
  prioritization: "Приоритизация",
  situational_awareness: "Ситуационная осведомлённость",
};

/** Попытка для аналитики: компетенции и лог уже распарсены, сортировка — от новых к старым */
export interface AnalyticsRow {
  competencies: Partial<Record<SkillKey, number>>;
  log: LogEntry[];
}

export interface Skill {
  key: SkillKey;
  label: string;
  value: number | null; // среднее по окну; null — нет данных
  status: "mastered" | "weak" | "none";
  trend: number | null; // изменение относительно предыдущего окна
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Навыки по последним SKILL_WINDOW попыткам: среднее, статус по порогу, тренд к предыдущему окну */
export function skillProfile(rows: AnalyticsRow[], window = SKILL_WINDOW): Skill[] {
  const recent = rows.slice(0, window);
  const prev = rows.slice(window, window * 2);
  return SKILL_KEYS.map((key) => {
    const value = avg(recent.flatMap((r) => (r.competencies[key] === undefined ? [] : [r.competencies[key]!])));
    const before = avg(prev.flatMap((r) => (r.competencies[key] === undefined ? [] : [r.competencies[key]!])));
    return {
      key,
      label: SKILL_LABEL[key],
      value,
      status: value === null ? "none" : value >= SKILL_THRESHOLDS[key] ? "mastered" : "weak",
      trend: value !== null && before !== null ? value - before : null,
    };
  });
}

const CATEGORY_IN: Record<EventCategory, string> = {
  conflict: "в конфликтах",
  medical: "в медицинских ситуациях",
  technical: "в технических ситуациях",
  security: "в ситуациях транспортной безопасности",
  request: "при обращениях пассажиров",
};

const CATEGORY_WHAT: Record<EventCategory, string> = {
  conflict: "конфликты",
  medical: "медицинские ситуации",
  technical: "технические ситуации",
  security: "ситуации транспортной безопасности",
  request: "обращения пассажиров",
};

interface CategoryStat {
  category: EventCategory;
  decisions: number;
  accuracy: number; // % верных
  skippedAcknowledge: number;
  timeouts: number;
}

export function categoryStats(log: LogEntry[]): CategoryStat[] {
  log = log.filter((entry) => !entry.cause);
  const cats = Array.from(new Set(log.map((l) => l.category)));
  return cats.map((category) => {
    const rows = log.filter((l) => l.category === category);
    return {
      category,
      decisions: rows.length,
      accuracy: Math.round((rows.filter((l) => l.correct).length / rows.length) * 100),
      skippedAcknowledge: rows.filter((l) => l.violation === "skipped_acknowledge").length,
      timeouts: rows.filter((l) => l.optionId === null).length,
    };
  });
}

/**
 * 2–4 вывода по шаблонам (без LLM): сильная категория, слабая категория,
 * типичное нарушение ролевой модели, пропуски по таймеру, проседающие навыки.
 */
export function buildInsights(rows: AnalyticsRow[], window = SKILL_WINDOW): string[] {
  const recent = rows.slice(0, window);
  if (!recent.length) return ["Пока нет данных: пройдите рейс, и здесь появятся выводы о ваших сильных и слабых сторонах."];
  const log = recent.flatMap((r) => r.log).filter((entry) => !entry.cause);
  const stats = categoryStats(log).filter((c) => c.decisions >= INSIGHT_MIN_DECISIONS);
  const out: string[] = [];

  const best = [...stats].sort((a, b) => b.accuracy - a.accuracy)[0];
  const strong = best && best.accuracy >= INSIGHT_STRONG ? best : undefined;
  const skip = [...stats].sort((a, b) => b.skippedAcknowledge - a.skippedAcknowledge)[0];
  const weak = [...stats].sort((a, b) => a.accuracy - b.accuracy)[0];

  if (strong) {
    let s = `Вы уверенно действуете ${CATEGORY_IN[strong.category]} (${strong.accuracy}% верных решений)`;
    if (skip && skip.skippedAcknowledge > 0 && skip.category !== strong.category)
      s += `, но ${CATEGORY_IN[skip.category]} часто пропускаете шаг «Признать ситуацию»`;
    out.push(s + ".");
  } else if (skip && skip.skippedAcknowledge > 0) {
    out.push(`${capitalize(CATEGORY_IN[skip.category])} вы часто сразу переходите к правилу, не признав ситуацию, — это снижает лояльность.`);
  }
  if (weak && weak.accuracy < INSIGHT_WEAK && weak.category !== strong?.category)
    out.push(`Слабое место — ${CATEGORY_WHAT[weak.category]}: верных решений только ${weak.accuracy}%. Пройдите такие сценарии в режиме тренировки.`);

  const timeouts = log.filter((l) => l.optionId === null).length;
  if (timeouts >= 2) out.push(`За последние рейсы ${timeouts} решения пропущены по таймеру: в критической ситуации лучше действовать, чем ждать.`);

  const weakSkills = skillProfile(rows, window).filter((s) => s.status === "weak");
  if (weakSkills.length)
    out.push(`Проседает: ${weakSkills.map((s) => `${s.label.toLowerCase()} (${s.value})`).join(", ")}.`);
  else if (out.length < 2) out.push("Все навыки выше порога — попробуйте сценарий сложнее или проверочный рейс.");

  return out.slice(0, 4);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ───────────────────────────── Страница руководителя ─────────────────────────────

export interface MemberSkills {
  name: string;
  attempts: number;
  skills: Skill[];
  ready: boolean; // все критичные навыки освоены
}

/** Готов к самостоятельной работе: все CRITICAL_SKILLS не ниже порога */
export const isReady = (skills: Skill[]) =>
  CRITICAL_SKILLS.every((k) => skills.find((s) => s.key === k)?.status === "mastered");

export function teamMatrix(members: { name: string; rows: AnalyticsRow[] }[]): MemberSkills[] {
  return members.map((m) => {
    const skills = skillProfile(m.rows);
    return { name: m.name, attempts: m.rows.length, skills, ready: isReady(skills) };
  });
}

export interface TeamMistake {
  eventTitle: string;
  category: EventCategory;
  text: string; // неверный вариант или «не успели ответить: …»
  count: number;
  better: string | null; // эталонный вариант узла
}

/** Самые частые ошибки бригады: неверные решения и таймауты, сгруппированные по узлу и варианту */
export function topMistakes(entries: { scenarioId: number; data: ScenarioData; log: LogEntry[] }[], limit = 3): TeamMistake[] {
  const byKey = new Map<string, TeamMistake>();
  for (const { scenarioId, data, log } of entries) {
    for (const l of log) {
      if (l.correct || l.cause) continue;
      const key = `${scenarioId}/${l.eventId}/${l.nodeId}/${l.optionId ?? "timeout"}`;
      const found = byKey.get(key);
      if (found) {
        found.count++;
        continue;
      }
      const node = findNode(data, l.eventId, l.nodeId);
      const option = node?.options.find((o) => o.id === l.optionId);
      byKey.set(key, {
        eventTitle: findEvent(data, l.eventId)?.title ?? l.eventId,
        category: l.category,
        text: l.optionId === null ? `Не успели ответить: «${node?.text ?? l.nodeId}»` : (option?.text ?? l.optionId),
        count: 1,
        better: (node && referenceOption(node.options)?.text) ?? null,
      });
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
