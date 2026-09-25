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
  effects: { loyalty: number; safety: number };
}

export interface ActiveDialogue {
  eventId: string;
  nodeId: string;
  openedAt: number; // sim-время открытия узла
  wallOpenedAt: number; // Date.now() для измерения реакции
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
    const node = findNode(data, state.active.eventId, state.active.nodeId);
    if (!opts.pauseWhileDialogue && node?.timerSec) {
      if (state.t + dt - state.active.openedAt >= node.timerSec) {
        state.t += dt;
        timeoutDialogue(state, data);
        return;
      }
    }
    if (opts.pauseWhileDialogue) return;
  }

  state.t += dt;

  // Триггеры по времени
  for (const ev of data.events) {
    if (ev.trigger.type === "time" && state.t >= ev.trigger.atSec) triggerEvent(state, data, ev.id);
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
  state.active = { eventId, nodeId: ev.startNode, openedAt: state.t, wallOpenedAt: Date.now() };
}

export function findEvent(data: ScenarioData, id: string): GameEvent | undefined {
  return data.events.find((e) => e.id === id);
}
export function findNode(data: ScenarioData, eventId: string, nodeId: string): DialogueNode | undefined {
  return findEvent(data, eventId)?.nodes.find((n) => n.id === nodeId);
}

export function chooseOption(state: SimState, data: ScenarioData, option: DialogueOption) {
  if (!state.active) return;
  const ev = findEvent(data, state.active.eventId)!;
  state.log.push({
    t: state.t,
    eventId: ev.id,
    category: ev.category,
    nodeId: state.active.nodeId,
    optionId: option.id,
    reactionMs: Date.now() - state.active.wallOpenedAt,
    correct: !!option.correct,
    effects: option.effects,
  });
  state.loyalty = clamp(state.loyalty + option.effects.loyalty);
  state.safety = clamp(state.safety + option.effects.safety);
  state.feed.push({
    t: state.t,
    text: `${ev.title}: ${option.correct ? "верное решение" : "спорное решение"} (лояльность ${fmt(option.effects.loyalty)}, безопасность ${fmt(option.effects.safety)})`,
    kind: option.correct ? "good" : "bad",
  });
  if (option.next) {
    state.active = { eventId: ev.id, nodeId: option.next, openedAt: state.t, wallOpenedAt: Date.now() };
  } else {
    state.active = null;
  }
}

function timeoutDialogue(state: SimState, data: ScenarioData) {
  if (!state.active) return;
  const ev = findEvent(data, state.active.eventId)!;
  state.log.push({
    t: state.t,
    eventId: ev.id,
    category: ev.category,
    nodeId: state.active.nodeId,
    optionId: null,
    reactionMs: Date.now() - state.active.wallOpenedAt,
    correct: false,
    effects: TIMEOUT_PENALTY,
  });
  state.loyalty = clamp(state.loyalty + TIMEOUT_PENALTY.loyalty);
  state.safety = clamp(state.safety + TIMEOUT_PENALTY.safety);
  state.feed.push({ t: state.t, text: `${ev.title}: время на решение истекло`, kind: "bad" });
  state.active = null;
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
  competencies: { communication: number; safety: number; speed: number; protocol: number };
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
    const limit = (node?.timerSec ?? DEFAULT_REACTION_LIMIT_SEC) * 1000;
    return l.optionId !== null && l.reactionMs <= limit * FAST_REACTION_SHARE;
  }).length;
  const speed = log.length ? Math.round((fast / n) * 100) : 100;

  const competencies = {
    communication: byCat(["conflict", "request"]),
    safety: byCat(["medical", "technical"]),
    speed,
    protocol: Math.round(accuracy * 100),
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
