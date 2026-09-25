/**
 * Движок симуляции: чистые функции без зависимостей от React/Express.
 * Состояние (SimState) — обычный объект, который мутируется в tick().
 * Так его легко тестировать из командной строки и при желании перенести на сервер
 * (например, для серверной валидации результатов «Проверочного рейса»).
 */
import {
  type ScenarioData,
  type Car,
  type Actor,
  type Target,
  type GameEvent,
  type DialogueNode,
  type DialogueOption,
  type EventCategory,
  type Condition,
  type Range,
  type FlagValue,
  type RoleStep,
  type CarType,
  ROLE_STEPS,
  ROLE_STEP_LABEL,
  cellAt,
  seatCell,
  isWalkable,
} from "./scenario";
import {
  ACTOR_SPEED,
  BUBBLE_SEC,
  TIMEOUT_PENALTY,
  METER_MIN,
  METER_MAX,
  SCORE_WEIGHTS,
  FAST_REACTION_SHARE,
  DEFAULT_REACTION_LIMIT_SEC,
  RECOMMENDATION_THRESHOLDS,
  ROLE_MODEL,
  PATIENCE_BY_CLASS,
} from "./rules";

export interface Waypoint {
  carId: string;
  x: number;
  y: number;
}

export interface RuntimeActor {
  id: string;
  carId: string;
  x: number; // дробная позиция для плавной анимации
  y: number;
  path: Waypoint[];
  stepIndex: number;
  waitUntil: number;
  seated: boolean;
  wrongSeat: boolean;
  mood: number;
  bubble: { text: string; until: number } | null;
  done: boolean;
}

export interface LogEntry {
  t: number;
  eventId: string;
  category: EventCategory;
  nodeId: string;
  optionId: string | null; // null = таймаут
  reactionMs: number;
  correct: boolean;
  effects: { loyalty: number; safety: number }; // фактически применённые (с учётом штрафов/бонусов)
  limitSec?: number; // сколько секунд было на решение (с учётом класса вагона)
  step?: RoleStep; // шаг ролевой модели выбранной реплики
  violation?: RoleViolation; // нарушение ролевой модели, если было
}

export type RoleViolation = "skipped_acknowledge" | "order";

export interface ActiveDialogue {
  eventId: string;
  nodeId: string;
  openedAt: number; // sim-время открытия узла
  wallOpenedAt: number; // Date.now() для измерения реакции
  limitSec?: number; // таймер узла × терпение класса вагона; undefined = без таймера
}

export interface SimState {
  t: number;
  loyalty: number;
  safety: number;
  actors: RuntimeActor[];
  fired: string[]; // события, которые уже запускались
  queue: string[]; // события, ожидающие показа
  active: ActiveDialogue | null;
  log: LogEntry[];
  flags: Record<string, FlagValue>; // выставляются вариантами ответа (option.set)
  feed: { t: number; text: string; kind: "info" | "warn" | "good" | "bad" }[];
  finished: boolean;
}

const clamp = (v: number, lo = METER_MIN, hi = METER_MAX) => Math.max(lo, Math.min(hi, v));

export function createSim(data: ScenarioData): SimState {
  return {
    t: 0,
    loyalty: data.initial.loyalty,
    safety: data.initial.safety,
    actors: data.actors.map((a) => ({
      id: a.id,
      carId: a.spawn.carId,
      x: a.spawn.x,
      y: a.spawn.y,
      path: [],
      stepIndex: 0,
      waitUntil: 0,
      seated: false,
      wrongSeat: false,
      mood: a.mood,
      bubble: null,
      done: a.steps.length === 0,
    })),
    fired: [],
    queue: [],
    active: null,
    log: [],
    flags: {},
    feed: [{ t: 0, text: "Рейс начался. Пассажиры занимают места.", kind: "info" }],
    finished: false,
  };
}

// ───────────────────────────── Поиск пути ─────────────────────────────

/** BFS по проходимым клеткам внутри одного вагона */
export function bfs(car: Car, from: Waypoint, to: { x: number; y: number }): Waypoint[] {
  const key = (x: number, y: number) => `${x},${y}`;
  const start = key(Math.round(from.x), Math.round(from.y));
  const goal = key(to.x, to.y);
  if (start === goal) return [];
  const prev = new Map<string, string | null>([[start, null]]);
  const q: [number, number][] = [[Math.round(from.x), Math.round(from.y)]];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (q.length) {
    const [cx, cy] = q.shift()!;
    if (key(cx, cy) === goal) break;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx,
        ny = cy + dy;
      const k = key(nx, ny);
      if (prev.has(k) || !isWalkable(car, nx, ny)) continue;
      prev.set(k, key(cx, cy));
      q.push([nx, ny]);
    }
  }
  if (!prev.has(goal)) return [];
  const out: Waypoint[] = [];
  let cur: string | null = goal;
  while (cur && cur !== start) {
    const [x, y] = cur.split(",").map(Number);
    out.unshift({ carId: car.id, x, y });
    cur = prev.get(cur) ?? null;
  }
  return out;
}

const doorOf = (car: Car, side: "head" | "tail") =>
  car.cells.find((c) => c.kind === "door" && (side === "head" ? c.x === 0 : c.x === car.length - 1));

/** Маршрут между вагонами: цепочка BFS-сегментов через межвагонные двери */
export function route(data: ScenarioData, from: Waypoint, to: Waypoint): Waypoint[] {
  const cars = data.train.cars;
  const fromIdx = cars.findIndex((c) => c.id === from.carId);
  const toIdx = cars.findIndex((c) => c.id === to.carId);
  if (fromIdx < 0 || toIdx < 0) return [];
  if (fromIdx === toIdx) return bfs(cars[fromIdx], from, to);

  const dir = toIdx > fromIdx ? 1 : -1;
  let cur = { ...from };
  const path: Waypoint[] = [];
  for (let i = fromIdx; i !== toIdx; i += dir) {
    const car = cars[i];
    const exit = doorOf(car, dir > 0 ? "tail" : "head");
    const next = cars[i + dir];
    const entry = doorOf(next, dir > 0 ? "head" : "tail");
    if (!exit || !entry) return [];
    path.push(...bfs(car, cur, exit));
    path.push({ carId: next.id, x: entry.x, y: entry.y }); // «перешагивание» в следующий вагон
    cur = { carId: next.id, x: entry.x, y: entry.y };
  }
  path.push(...bfs(cars[toIdx], cur, to));
  return path;
}

/** Целевую точку шага goto превращаем в конкретную клетку */
export function resolveTarget(data: ScenarioData, actor: Actor, target: Target): Waypoint | null {
  const car = (id: string) => data.train.cars.find((c) => c.id === id);
  switch (target.kind) {
    case "ownSeat": {
      if (!actor.ticket) return null;
      const c = car(actor.ticket.carId);
      const s = c && seatCell(c, actor.ticket.seat);
      return s ? { carId: c.id, x: s.x, y: s.y } : null;
    }
    case "seat": {
      const c = car(target.carId);
      const s = c && seatCell(c, target.seat);
      return s ? { carId: c.id, x: s.x, y: s.y } : null;
    }
    case "cell":
      return { carId: target.carId, x: target.x, y: target.y };
    case "zone": {
      const c = car(target.carId);
      if (!c) return null;
      if (target.zone === "vestibule") {
        const v = c.cells.find((k) => k.kind === "vestibule");
        return v ? { carId: c.id, x: v.x, y: v.y } : null;
      }
      // для санузла/бара — ближайшая проходимая клетка рядом с зоной
      for (const z of c.cells.filter((k) => k.kind === target.zone)) {
        for (const [dx, dy] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]) {
          if (isWalkable(c, z.x + dx, z.y + dy)) return { carId: c.id, x: z.x + dx, y: z.y + dy };
        }
      }
      return null;
    }
  }
}

// ───────────────────────────── Такт симуляции ─────────────────────────────

export interface TickOptions {
  /** В режиме тренировки симуляция стоит, пока открыт диалог */
  pauseWhileDialogue: boolean;
}

export function tick(state: SimState, dt: number, data: ScenarioData, opts: TickOptions) {
  if (state.finished) return;

  // Таймер открытого диалога
  if (state.active) {
    const limit = state.active.limitSec;
    if (!opts.pauseWhileDialogue && limit) {
      if (state.t + dt - state.active.openedAt >= limit) {
        state.t += dt;
        timeoutDialogue(state, data);
        return;
      }
    }
    if (opts.pauseWhileDialogue) return;
  }

  state.t += dt;

  // Триггеры по времени и по условию (например, «лояльность упала ниже 30»)
  for (const ev of data.events) {
    if (ev.trigger.type === "time" && state.t >= ev.trigger.atSec) triggerEvent(state, data, ev.id);
    if (ev.trigger.type === "condition" && evalCondition(ev.trigger.if, state)) triggerEvent(state, data, ev.id);
  }

  // Акторы
  for (const ra of state.actors) {
    const def = data.actors.find((a) => a.id === ra.id);
    if (!def) continue;
    if (ra.bubble && state.t > ra.bubble.until) ra.bubble = null;

    if (ra.path.length) {
      moveAlongPath(ra, dt);
      continue;
    }
    if (ra.done || state.t < ra.waitUntil) continue;

    const step = def.steps[ra.stepIndex];
    if (!step) {
      ra.done = true;
      continue;
    }
    switch (step.type) {
      case "goto": {
        const to = resolveTarget(data, def, step.target);
        if (to) {
          ra.path = route(data, { carId: ra.carId, x: ra.x, y: ra.y }, to);
          ra.seated = false;
          ra.wrongSeat = false;
        }
        ra.stepIndex++;
        break;
      }
      case "sit": {
        const car = data.train.cars.find((c) => c.id === ra.carId);
        const cell = car && cellAt(car, Math.round(ra.x), Math.round(ra.y));
        if (cell?.kind === "seat") {
          ra.seated = true;
          ra.wrongSeat = !def.ticket || def.ticket.carId !== ra.carId || def.ticket.seat !== cell.seat;
          if (ra.wrongSeat)
            state.feed.push({
              t: state.t,
              text: `${def.name} занял чужое место ${cell.seat} (вагон ${car?.number ?? "?"})`,
              kind: "warn",
            });
        }
        ra.stepIndex++;
        break;
      }
      case "wait":
        ra.waitUntil = state.t + step.seconds;
        ra.stepIndex++;
        break;
      case "emit":
        triggerEvent(state, data, step.eventId);
        ra.stepIndex++;
        break;
      case "say":
        ra.bubble = { text: step.text, until: state.t + BUBBLE_SEC };
        ra.stepIndex++;
        break;
      case "mood":
        ra.mood = clamp(ra.mood + step.delta);
        ra.stepIndex++;
        break;
    }
  }

  // Открыть следующее событие из очереди
  if (!state.active && state.queue.length) openEvent(state, data, state.queue.shift()!);

  if (state.t >= data.durationSec && !state.active && !state.queue.length) {
    state.finished = true;
    state.feed.push({ t: state.t, text: "Рейс завершён.", kind: "info" });
  }
}

function moveAlongPath(ra: RuntimeActor, dt: number) {
  let budget = ACTOR_SPEED * dt;
  while (budget > 0 && ra.path.length) {
    const wp = ra.path[0];
    if (wp.carId !== ra.carId) {
      // переход в соседний вагон — мгновенно
      ra.carId = wp.carId;
      ra.x = wp.x;
      ra.y = wp.y;
      ra.path.shift();
      continue;
    }
    const dx = wp.x - ra.x,
      dy = wp.y - ra.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= budget) {
      ra.x = wp.x;
      ra.y = wp.y;
      budget -= dist;
      ra.path.shift();
    } else {
      ra.x += (dx / dist) * budget;
      ra.y += (dy / dist) * budget;
      budget = 0;
    }
  }
}

// ───────────────────────────── События и диалоги ─────────────────────────────

export function triggerEvent(state: SimState, data: ScenarioData, eventId: string) {
  if (state.fired.includes(eventId)) return;
  const ev = data.events.find((e) => e.id === eventId);
  if (!ev) return;
  state.fired.push(eventId);
  state.queue.push(eventId);
  state.feed.push({ t: state.t, text: `Событие: ${ev.title}`, kind: "warn" });
}

function openEvent(state: SimState, data: ScenarioData, eventId: string) {
  const ev = data.events.find((e) => e.id === eventId);
  if (!ev) return;
  openNode(state, data, eventId, ev.startNode);
}

/** Класс вагона, где сейчас находится связанный с событием актор (от него зависит терпение) */
export function eventCarType(state: SimState, data: ScenarioData, eventId: string): CarType | null {
  const actorId = findEvent(data, eventId)?.actorId;
  const carId = state.actors.find((a) => a.id === actorId)?.carId;
  return data.train.cars.find((c) => c.id === carId)?.type ?? null;
}

const patience = (state: SimState, data: ScenarioData, eventId: string) =>
  PATIENCE_BY_CLASS[eventCarType(state, data, eventId) ?? "standard"];

/** Открыть узел диалога: таймер узла масштабируется терпением класса вагона */
export function openNode(state: SimState, data: ScenarioData, eventId: string, nodeId: string) {
  const timer = findNode(data, eventId, nodeId)?.timerSec;
  const limitSec = timer ? Math.round(timer * patience(state, data, eventId).timer * 10) / 10 : undefined;
  state.active = { eventId, nodeId, openedAt: state.t, wallOpenedAt: Date.now(), limitSec };
}

/** Применить эффекты к шкалам. Потеря лояльности усиливается по классу вагона. Возвращает фактические эффекты. */
function applyEffects(state: SimState, data: ScenarioData, eventId: string, fx: { loyalty: number; safety: number }) {
  const loyalty = fx.loyalty < 0 ? Math.round(fx.loyalty * patience(state, data, eventId).loyaltyLoss) : fx.loyalty;
  const applied = { loyalty, safety: fx.safety };
  state.loyalty = clamp(state.loyalty + applied.loyalty);
  state.safety = clamp(state.safety + applied.safety);
  return applied;
}

export function findEvent(data: ScenarioData, id: string): GameEvent | undefined {
  return data.events.find((e) => e.id === id);
}
export function findNode(data: ScenarioData, eventId: string, nodeId: string): DialogueNode | undefined {
  return findEvent(data, eventId)?.nodes.find((n) => n.id === nodeId);
}

// ───────────────────────────── Условия ─────────────────────────────

type ConditionState = Pick<SimState, "flags" | "loyalty" | "safety">;

const inRange = (v: number, r: Range) => (r.lt === undefined || v < r.lt) && (r.gte === undefined || v >= r.gte);

/**
 * Чистая проверка условия. Неизвестный флаг считается false (или 0, если сравниваем с числом).
 * { flag } без eq — «флаг выставлен и не равен false/0».
 */
export function evalCondition(cond: Condition, state: ConditionState): boolean {
  if ("flag" in cond) {
    const v = state.flags[cond.flag] ?? (typeof cond.eq === "number" ? 0 : false);
    return cond.eq === undefined ? Boolean(v) : v === cond.eq;
  }
  if ("loyalty" in cond) return inRange(state.loyalty, cond.loyalty);
  if ("safety" in cond) return inRange(state.safety, cond.safety);
  if ("all" in cond) return cond.all.every((c) => evalCondition(c, state));
  return cond.any.some((c) => evalCondition(c, state));
}

/** Варианты ответа, которые видит игрок в текущем состоянии */
export const visibleOptions = (node: DialogueNode, state: ConditionState) =>
  node.options.filter((o) => !o.if || evalCondition(o.if, state));

/** Куда ведёт вариант: первый сработавший nextIf, иначе next */
export function resolveNext(option: DialogueOption, state: ConditionState): string | null {
  const branch = option.nextIf?.find((b) => evalCondition(b.if, state));
  return branch ? branch.next : option.next;
}

// ───────────────────────────── Ролевая модель ─────────────────────────────

const stepOrder = (s: RoleStep) => ROLE_STEPS.indexOf(s);

/**
 * Проверка шага ролевой модели относительно уже сделанных шагов в этом событии.
 * «Признать» можно всегда (в том числе вернуться к нему после эскалации).
 * «Правило» без предварительного «Признать» — skipped_acknowledge.
 * Шаг раньше уже пройденного (например, «Правило» после «Заверить») — order.
 */
export function roleStepViolation(prev: RoleStep[], step: RoleStep): RoleViolation | null {
  if (step === "acknowledge") return null;
  if (step === "rule" && !prev.includes("acknowledge")) return "skipped_acknowledge";
  const maxPrev = Math.max(-1, ...prev.map(stepOrder));
  return stepOrder(step) < maxPrev ? "order" : null;
}

export const ROLE_VIOLATION_TEXT: Record<RoleViolation, string> = {
  skipped_acknowledge: `сразу перешли к правилу, не признав ситуацию`,
  order: `нарушен порядок: ${ROLE_STEPS.map((s) => ROLE_STEP_LABEL[s]).join(" → ")}`,
};

/** Метрика 0..100: доля реплик с шагом модели, сделанных без нарушения. Нет размеченных реплик — 100. */
export function roleModelScore(log: LogEntry[]): number {
  const stepped = log.filter((l) => l.step);
  if (!stepped.length) return 100;
  return Math.round((stepped.filter((l) => !l.violation).length / stepped.length) * 100);
}

export function chooseOption(state: SimState, data: ScenarioData, option: DialogueOption) {
  if (!state.active) return;
  const ev = findEvent(data, state.active.eventId)!;

  // ролевая модель: штраф за нарушение, бонус за полную цепочку в событии
  const eventLog = state.log.filter((l) => l.eventId === ev.id);
  const prevSteps = eventLog.flatMap((l) => (l.step ? [l.step] : []));
  const violation = option.step ? roleStepViolation(prevSteps, option.step) : null;
  const fullChain =
    option.step === "assure" &&
    !violation &&
    !eventLog.some((l) => l.violation) &&
    ROLE_STEPS.every((s) => s === "assure" || prevSteps.includes(s));
  const extra = violation ? ROLE_MODEL.violationPenalty : fullChain ? ROLE_MODEL.fullChainBonus : null;
  const effects = applyEffects(state, data, ev.id, {
    loyalty: option.effects.loyalty + (extra?.loyalty ?? 0),
    safety: option.effects.safety + (extra?.safety ?? 0),
  });

  state.log.push({
    t: state.t,
    eventId: ev.id,
    category: ev.category,
    nodeId: state.active.nodeId,
    optionId: option.id,
    reactionMs: Date.now() - state.active.wallOpenedAt,
    correct: !!option.correct,
    effects,
    limitSec: state.active.limitSec,
    ...(option.step && { step: option.step }),
    ...(violation && { violation }),
  });
  if (option.set) Object.assign(state.flags, option.set);
  state.feed.push({
    t: state.t,
    text: `${ev.title}: ${option.correct ? "верное решение" : "спорное решение"} (лояльность ${fmt(effects.loyalty)}, безопасность ${fmt(effects.safety)})`,
    kind: option.correct ? "good" : "bad",
  });
  if (violation)
    state.feed.push({ t: state.t, text: `Ролевая модель: ${ROLE_VIOLATION_TEXT[violation]}`, kind: "bad" });
  if (fullChain) state.feed.push({ t: state.t, text: "Ролевая модель: полная цепочка без нарушений", kind: "good" });
  // переход считается ПОСЛЕ эффектов и флагов: так «лояльность < 30» учитывает только что сделанный выбор
  const next = resolveNext(option, state);
  if (next) {
    openNode(state, data, ev.id, next);
  } else {
    state.active = null;
  }
}

/**
 * Время на решение истекло. Если у узла есть onTimeout — применяем его эффекты и флаги
 * и переходим в узел-последствие; иначе старое поведение: TIMEOUT_PENALTY и конец события.
 */
export function timeoutDialogue(state: SimState, data: ScenarioData) {
  if (!state.active) return;
  const ev = findEvent(data, state.active.eventId)!;
  const node = findNode(data, ev.id, state.active.nodeId);
  const branch = node?.onTimeout;
  const effects = applyEffects(state, data, ev.id, branch?.effects ?? TIMEOUT_PENALTY);
  state.log.push({
    t: state.t,
    eventId: ev.id,
    category: ev.category,
    nodeId: state.active.nodeId,
    optionId: null,
    reactionMs: Date.now() - state.active.wallOpenedAt,
    correct: false,
    effects,
    limitSec: state.active.limitSec,
  });
  if (branch?.set) Object.assign(state.flags, branch.set);
  state.feed.push({ t: state.t, text: `${ev.title}: ${branch?.text ?? "время на решение истекло"}`, kind: "bad" });
  if (branch?.next) openNode(state, data, ev.id, branch.next);
  else state.active = null;
}

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// ───────────────────────────── Итоги ─────────────────────────────

export interface SimResult {
  score: number;
  loyalty: number;
  safety: number;
  accuracy: number; // доля верных решений 0..1
  avgReactionMs: number;
  timeouts: number;
  competencies: { communication: number; safety: number; speed: number; protocol: number; roleModel: number };
  recommendations: string[];
}

export function computeResult(state: SimState, data: ScenarioData): SimResult {
  const log = state.log;
  const n = log.length || 1;
  const correct = log.filter((l) => l.correct).length;
  const accuracy = log.length ? correct / n : 1;
  const avgReactionMs = log.length ? log.reduce((s, l) => s + l.reactionMs, 0) / n : 0;
  const timeouts = log.filter((l) => l.optionId === null).length;

  const byCat = (cats: EventCategory[]) => {
    const rows = log.filter((l) => cats.includes(l.category));
    return rows.length ? Math.round((rows.filter((l) => l.correct).length / rows.length) * 100) : 100;
  };
  // скорость: доля решений, принятых за первую половину отведённого времени
  const fast = log.filter((l) => {
    const node = findNode(data, l.eventId, l.nodeId);
    const limit = (l.limitSec ?? node?.timerSec ?? DEFAULT_REACTION_LIMIT_SEC) * 1000;
    return l.optionId !== null && l.reactionMs <= limit * FAST_REACTION_SHARE;
  }).length;
  const speed = log.length ? Math.round((fast / n) * 100) : 100;

  const competencies = {
    communication: byCat(["conflict", "request"]),
    safety: byCat(["medical", "technical"]),
    speed,
    protocol: Math.round(accuracy * 100),
    roleModel: roleModelScore(log),
  };

  const score = clamp(
    Math.round(
      state.loyalty * SCORE_WEIGHTS.loyalty +
        state.safety * SCORE_WEIGHTS.safety +
        accuracy * 100 * SCORE_WEIGHTS.accuracy -
        timeouts * SCORE_WEIGHTS.timeoutPenalty,
    ),
  );

  const recommendations: string[] = [];
  if (competencies.communication < RECOMMENDATION_THRESHOLDS.communication)
    recommendations.push("Повторить модуль «Деэскалация конфликтов и работа с возражениями».");
  if (competencies.safety < RECOMMENDATION_THRESHOLDS.safety)
    recommendations.push("Отработать алгоритм действий при медицинском инциденте (оценка → доклад → медик).");
  if (competencies.speed < RECOMMENDATION_THRESHOLDS.speed)
    recommendations.push("Тренировать скорость принятия решений: пройти сценарии в режиме с таймером.");
  if (competencies.roleModel < RECOMMENDATION_THRESHOLDS.roleModel)
    recommendations.push(
      `Соблюдайте ролевую модель общения: ${ROLE_STEPS.map((s) => ROLE_STEP_LABEL[s]).join(" → ")}. Не переходите к правилу, не признав ситуацию.`,
    );
  if (timeouts > 0) recommendations.push("Есть пропущенные решения — не оставляйте ситуацию без ответа.");
  if (!recommendations.length) recommendations.push("Отличный результат. Попробуйте более сложный сценарий.");

  return {
    score,
    loyalty: state.loyalty,
    safety: state.safety,
    accuracy,
    avgReactionMs,
    timeouts,
    competencies,
    recommendations,
  };
}
