/**
 * Все числовые правила тренажёра в одном месте: штрафы, веса, пороги, начисление баллов.
 * Живое изменение правила на защите = правка одной константы здесь.
 * Файл без зависимостей — импортируется и движком (shared/engine.ts), и сервером (server/storage.ts).
 */

// ───────────────────────────── Шкалы ─────────────────────────────

/** Границы шкал «лояльность» и «безопасность» */
export const METER_MIN = 0;
export const METER_MAX = 100;

// ───────────────────────────── Симуляция ─────────────────────────────

/** Скорость ходьбы актора, клеток в секунду */
export const ACTOR_SPEED = 2.4;

/** Сколько секунд висит «пузырь» с репликой актора */
export const BUBBLE_SEC = 4;

/** Штраф, если время на решение истекло, а у узла не задана своя ветка onTimeout */
export const TIMEOUT_PENALTY = { loyalty: -15, safety: -15 };

// ───────────────────────────── Итоговый балл ─────────────────────────────

/** score = loyalty·w.loyalty + safety·w.safety + accuracy·100·w.accuracy − timeouts·timeoutPenalty */
export const SCORE_WEIGHTS = {
  loyalty: 0.35,
  safety: 0.45,
  accuracy: 0.2,
  timeoutPenalty: 5,
};

/** Решение «быстрое», если принято за эту долю отведённого времени */
export const FAST_REACTION_SHARE = 0.5;

/** Лимит для метрики скорости, если у узла нет таймера, сек */
export const DEFAULT_REACTION_LIMIT_SEC = 30;

/** Ниже этих значений компетенции в разборе появляется рекомендация */
export const RECOMMENDATION_THRESHOLDS = {
  communication: 70,
  safety: 70,
  speed: 60,
};

// ───────────────────────────── Баллы ─────────────────────────────

/** Тренировка: max(min, score · share) баллов обучения */
export const TRAINING_POINTS = { min: 10, share: 0.5 };

/** Проверочный рейс: score · share баллов практики */
export const PRACTICE_POINTS = { share: 1 };

// ───────────────────────────── Достижения ─────────────────────────────

export const ACHIEVEMENT_THRESHOLDS = {
  safetyFirst: 90, // безопасность по итогам рейса
  diplomat: 90, // лояльность по итогам рейса
  lightningMs: 5000, // средняя реакция быстрее
  flawlessAccuracy: 0.999, // все решения верные
  veteranRuns: 10, // пройденных рейсов
};
