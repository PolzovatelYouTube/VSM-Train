/**
 * Обратная связь и аналитика компетенций: чистые функции над сценарием и логом решений.
 * Используются в разборе рейса (клиент), профиле и на странице руководителя (сервер).
 */
import { type ScenarioData, type DialogueOption, type EventCategory, type RoleStep } from "./scenario";
import { findEvent, findNode, ROLE_VIOLATION_TEXT, type LogEntry } from "./engine";
import { TIMEOUT_PENALTY } from "./rules";

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
  return log.map((l) => {
    const ev = findEvent(data, l.eventId);
    const node = findNode(data, l.eventId, l.nodeId);
    const option = node?.options.find((o) => o.id === l.optionId);
    const ref = node ? referenceOption(node.options) : undefined;
    const isTimeout = l.optionId === null;

    let why: string;
    if (isTimeout) {
      const consequence = node?.onTimeout?.text ?? `штраф за просрочку (${describeEffects(TIMEOUT_PENALTY)})`;
      why = `Решение не принято за ${l.limitSec ?? node?.timerSec ?? "?"} с: ${consequence}.`;
    } else {
      why = option?.feedback ?? (l.correct ? "Действие по стандарту обслуживания." : "Действие расходится со стандартом обслуживания.");
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
      why,
      better: !l.correct && ref && ref.id !== l.optionId ? { text: ref.text, hint: ref.hint } : null,
      violation: l.violation ? `Ролевая модель: ${ROLE_VIOLATION_TEXT[l.violation]}` : null,
    };
  });
}
