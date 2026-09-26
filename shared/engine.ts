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
  type CarCapability,
  type ServiceEntitlement,
  type IncidentStatus,
  type WorkloadEntry,
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
  context?: { known: string[]; missing: string[] };
  feedback?: string;
  flagsSet?: Record<string, FlagValue>;
  causes?: number[]; // индексы решений, установивших флаги триггера события
  timeCostSec?: number;
  cause?: "response_expired" | "escalation" | "ride_ended";
}

export type RoleViolation = "skipped_acknowledge" | "order";

export interface ActiveDialogue {
  eventId: string;
  nodeId: string;
  openedAt: number; // sim-время открытия узла
  wallOpenedAt: number; // Date.now() для измерения реакции
  limitSec?: number; // таймер узла × терпение класса вагона; undefined = без таймера
}

export interface RuntimeIncident {
  eventId: string;
  status: IncidentStatus;
  triggeredAt?: number;
  respondedAt?: number;
  escalated: boolean;
  responseExpired: boolean;
  dialogue: ActiveDialogue | null;
  context: Record<string, FlagValue>;
  riskEpisodes: RiskEpisode[];
}

export interface RiskEpisode {
  key: string;
  startedAt: number;
  severity: number;
  urgency: "routine" | "urgent" | "critical";
  responseWindowSec: number;
  text: string;
  noticedAt?: number;
  responseAt?: number;
  endedAt?: number;
  failed?: boolean;
  responseExpired?: boolean;
}

export const concurrentGameplay = (data: ScenarioData) => data.gameplay !== "sequential";

export interface SimState {
  t: number;
  loyalty: number;
  safety: number;
  actors: RuntimeActor[];
  fired: string[]; // события, которые уже запускались
  queue: string[]; // события, ожидающие показа
  active: ActiveDialogue | null;
  incidents: Record<string, RuntimeIncident>;
  log: LogEntry[];
  workload: WorkloadEntry[];
  flags: Record<string, FlagValue>; // выставляются вариантами ответа (option.set)
  feed: { t: number; text: string; kind: "info" | "warn" | "good" | "bad" }[];
  finished: boolean;
  eventCauses?: Record<string, number[]>;
  resources: {
    availableSeats: Record<string, number>;
    carTypes: Record<string, CarType>;
    capabilities: Record<string, Partial<Record<CarCapability, boolean>>>;
    serviceEntitlements: Partial<Record<ServiceEntitlement, boolean>>;
  };
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
    incidents: Object.fromEntries(data.events.map((ev) => [ev.id, {
      eventId: ev.id, status: "pending", escalated: false, responseExpired: false, dialogue: null, context: {}, riskEpisodes: [],
    }])),
    log: [],
    workload: [],
    flags: {},
    eventCauses: {},
    resources: {
      availableSeats: Object.fromEntries(data.train.cars.map((car) => [car.id, car.availableSeats ?? 0])),
      carTypes: Object.fromEntries(data.train.cars.map((car) => [car.id, car.type])),
      capabilities: Object.fromEntries(data.train.cars.map((car) => [car.id, car.capabilities ?? {}])),
      serviceEntitlements: data.serviceEntitlements ?? {},
    },
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
  const concurrent = concurrentGameplay(data);

  // Таймер открытого диалога
  if (state.active && !concurrent) {
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

  state.t = concurrent ? Math.min(data.durationSec, state.t + dt) : state.t + dt;
  if (concurrent && state.t + 1e-7 >= data.durationSec) state.t = data.durationSec;

  // Триггеры по времени и по условию (например, «лояльность упала ниже 30»)
  for (const ev of data.events) {
    if (ev.trigger.type === "time" && state.t + 1e-7 >= ev.trigger.atSec) triggerEvent(state, data, ev.id);
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
  if (concurrent) updateIncidents(state, data);
  else if (!state.active && state.queue.length) openEvent(state, data, state.queue.shift()!);

  if (concurrent && state.t >= data.durationSec) {
    for (const incident of Object.values(state.incidents)) {
      if (incident.status === "active" || incident.status === "waiting") {
        const node = incident.dialogue && findNode(data, incident.eventId, incident.dialogue.nodeId);
        if (node && effectiveNodeKind(node, state) === "decision")
          incidentPenalty(state, data, incident, "ride_ended", "Ситуация осталась без решения к концу рейса");
        incident.status = "expired";
        incident.dialogue = null;
      }
    }
    state.active = null;
    state.queue = [];
  }

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
  if (ev.trigger.type === "condition") {
    const flags = conditionFlags(ev.trigger.if, state);
    const causes = flags.flatMap((flag) => {
      const index = state.log.findLastIndex((l) => l.flagsSet?.[flag] !== undefined);
      return index >= 0 ? [index] : [];
    });
    (state.eventCauses ??= {})[ev.id] = Array.from(new Set(causes));
  }
  state.fired.push(eventId);
  const incident = state.incidents[eventId];
  incident.triggeredAt = state.t;
  incident.status = "waiting";
  if (concurrentGameplay(data)) {
    const focused = state.active;
    const focusedStatus = focused ? state.incidents[focused.eventId].status : undefined;
    openNode(state, data, eventId, ev.startNode);
    incident.status = "waiting";
    state.active = focused;
    if (focused && focusedStatus) state.incidents[focused.eventId].status = focusedStatus;
  } else state.queue.push(eventId);
  syncIncidentRisk(state, data, incident, false);
  recordWorkload(state, data, incident, "appeared", ev.title);
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
  const node = findNode(data, eventId, nodeId);
  if (!node) throw new Error(`Неизвестный узел ${eventId}/${nodeId}`);
  if (!state.fired.includes(eventId)) state.fired.push(eventId);
  if (state.active && state.active.eventId !== eventId && state.incidents[state.active.eventId].status === "active")
    state.incidents[state.active.eventId].status = "waiting";
  const timer = effectiveNodeKind(node, state) === "decision" ? node.timerSec : undefined;
  const limitSec = timer ? Math.round(timer * patience(state, data, eventId).timer * 10) / 10 : undefined;
  state.active = { eventId, nodeId, openedAt: state.t, wallOpenedAt: Date.now(), limitSec };
  const incident = state.incidents[eventId];
  if (incident) {
    incident.triggeredAt ??= state.t;
    incident.dialogue = state.active;
    const terminalInformation = effectiveNodeKind(node, state) === "information" &&
      (node.kind === "information" ? !node.next : visibleOptions(node, state).every((o) => !resolveNext(o, state)));
    incident.status = terminalInformation ? "resolved" : "active";
    if (terminalInformation) {
      const risk = incident.riskEpisodes.at(-1);
      if (risk) risk.endedAt = state.t;
      recordWorkload(state, data, incident, "resolved", "Ситуация решена; доступна итоговая информация");
    }
  }
}

/** Переключение внимания не перезапускает ни одного срока. */
export function selectIncident(state: SimState, data: ScenarioData, eventId: string): boolean {
  const incident = state.incidents[eventId];
  if (!concurrentGameplay(data) || state.finished || !incident?.dialogue ||
      (incident.status !== "waiting" && incident.status !== "active")) return false;
  if (state.active?.eventId === eventId) return true;
  const fromEventId = state.active?.eventId;
  if (state.active && state.incidents[state.active.eventId].status === "active") state.incidents[state.active.eventId].status = "waiting";
  state.active = incident.dialogue;
  incident.status = "active";
  syncIncidentRisk(state, data, incident);
  const risk = incident.riskEpisodes.at(-1);
  if (risk) risk.noticedAt ??= state.t;
  recordWorkload(state, data, incident, "selected", fromEventId ? "Переключились на ситуацию" : "Выбрали ситуацию", { fromEventId });
  return true;
}

export function leaveIncident(state: SimState) {
  if (state.active) {
    const incident = state.incidents[state.active.eventId];
    const risk = incident.riskEpisodes.at(-1);
    if (risk) state.workload.push({ t: state.t, kind: "left", eventId: incident.eventId, nodeId: state.active.nodeId,
      text: "Оставили ситуацию ждать", severity: risk.severity, urgency: risk.urgency,
      responseWindowSec: risk.responseWindowSec, waitingSec: state.t - (incident.triggeredAt ?? state.t),
      priority: priorityForRisk(risk, state.t), context: { ...incident.context } });
  }
  if (state.active && state.incidents[state.active.eventId].status === "active") state.incidents[state.active.eventId].status = "waiting";
  state.active = null;
}

function finishIncident(state: SimState, status: "resolved" | "expired", data: ScenarioData) {
  if (!state.active) return;
  const incident = state.incidents[state.active.eventId];
  if (incident) {
    if (incident.status !== status) recordWorkload(state, data, incident, status, status === "resolved" ? "Ситуация решена" : "Срок решения истёк");
    incident.status = status;
    incident.dialogue = null;
    const risk = incident.riskEpisodes.at(-1);
    if (risk) risk.endedAt = state.t;
  }
  state.active = null;
}

/** Одинаковые по механике действия не создают содержательный выбор. */
export function effectiveNodeKind(node: DialogueNode, state: ConditionState): "decision" | "information" {
  if (node.kind === "information") return "information";
  const actions = visibleOptions(node, state);
  const signatures = new Set(actions.map((o) => JSON.stringify({
    effects: o.effects, next: o.next, nextIf: o.nextIf, set: o.set, timeCostSec: o.timeCostSec, outcomes: o.outcomes,
  })));
  return actions.length >= 2 && signatures.size >= 2 ? "decision" : "information";
}

/** Информация/единственный доступный путь: переход и флаги, но ни баллов, ни log-ответа. */
export function continueInformation(state: SimState, data: ScenarioData): boolean {
  if (!state.active || state.finished) return false;
  const { eventId, nodeId } = state.active;
  const node = findNode(data, eventId, nodeId)!;
  if (effectiveNodeKind(node, state) !== "information") return false;
  const options = visibleOptions(node, state);
  const option = node.kind !== "information" ? options[0] : undefined;
  const flags = node.set ?? option?.set;
  if (flags) Object.assign(state.flags, flags);
  if (flags) Object.assign(state.incidents[eventId].context, flags);
  const next = node.kind === "information" ? node.next : option ? resolveNext(option, state) : node.next;
  if (next) openNode(state, data, eventId, next);
  else finishIncident(state, "resolved", data);
  return true;
}

function incidentPenalty(state: SimState, data: ScenarioData, incident: RuntimeIncident,
  cause: NonNullable<LogEntry["cause"]>, text: string, fx?: { loyalty: number; safety: number }, set?: Record<string, FlagValue>) {
  const ev = findEvent(data, incident.eventId)!;
  // Автор задаёт реальные последствия; fallback различает тяжесть пропущенной ситуации.
  syncIncidentRisk(state, data, incident);
  const risk = incident.riskEpisodes.at(-1);
  const urgency = risk?.urgency ?? ev.urgency;
  const fallback = urgency === "critical" ? { loyalty: -4, safety: -18 }
    : urgency === "urgent" ? { loyalty: -6, safety: -7 } : { loyalty: -3, safety: 0 };
  const effects = applyEffects(state, data, ev.id, fx ?? fallback);
  if (set) Object.assign(state.flags, set);
  if (set) Object.assign(incident.context, set);
  if (risk) risk.failed = true;
  recordWorkload(state, data, incident, cause === "escalation" ? "escalated" : "expired", text, { effects });
  state.log.push({ t: state.t, eventId: ev.id, category: ev.category,
    nodeId: incident.dialogue?.nodeId ?? ev.startNode, optionId: null,
    reactionMs: Math.round(Math.max(0, state.t - (incident.triggeredAt ?? state.t)) * 1000),
    correct: false, effects, cause, feedback: text, flagsSet: set ? { ...set } : undefined,
    causes: state.eventCauses?.[ev.id], limitSec: ev.responseWindowSec });
  state.feed.push({ t: state.t, text: `${ev.title}: ${text}`, kind: "bad" });
}

function updateIncidents(state: SimState, data: ScenarioData) {
  for (const ev of data.events) {
    const incident = state.incidents[ev.id];
    if (incident.status !== "waiting" && incident.status !== "active") continue;
    syncIncidentRisk(state, data, incident);
    const elapsed = state.t - (incident.triggeredAt ?? state.t);
    const risk = incident.riskEpisodes.at(-1)!;
    const hasResponseWindow = ev.responseWindowSec !== undefined || risk.key !== "base";
    if (hasResponseWindow && !risk.responseExpired && risk.responseAt === undefined && state.t - risk.startedAt + 1e-7 >= risk.responseWindowSec) {
      risk.responseExpired = true;
      incident.responseExpired = true;
      // При наличии эскалации штраф применяется ею, а ситуация остаётся доступна.
      if (!ev.escalation) incidentPenalty(state, data, incident, "response_expired", "Пассажир ждёт ответа; обращение остаётся открытым");
    }
    if (!incident.escalated && ev.escalation && elapsed + 1e-7 >= ev.escalation.afterSec) {
      incident.escalated = true;
      const escalation = ev.escalation;
      incidentPenalty(state, data, incident, "escalation", escalation.text ?? "Ситуация ухудшилась", escalation.effects, escalation.set);
      if (escalation.nextEvent) {
        risk.endedAt = state.t;
        incident.status = "expired";
        incident.dialogue = null;
        if (state.active?.eventId === ev.id) state.active = null;
        triggerEvent(state, data, escalation.nextEvent);
        continue;
      }
      if (escalation.nextNode) {
        // A background escalation must not steal the dialogue currently in focus.
        const focused = state.active;
        const focusedStatus = focused && state.incidents[focused.eventId].status;
        openNode(state, data, ev.id, escalation.nextNode);
        if (focused && focused.eventId !== ev.id) {
          incident.status = "waiting";
          state.active = focused;
          if (focusedStatus) state.incidents[focused.eventId].status = focusedStatus;
        }
      }
    }
    const dialogue = incident.dialogue;
    const node = dialogue && findNode(data, ev.id, dialogue.nodeId);
    if (dialogue?.limitSec && node && effectiveNodeKind(node, state) === "decision" && state.t - dialogue.openedAt + 1e-7 >= dialogue.limitSec) {
      const focusedId = state.active?.eventId;
      state.active = dialogue;
      timeoutDialogue(state, data);
      if (focusedId !== ev.id) {
        if (incident.status === "active") incident.status = "waiting";
        state.active = focusedId ? state.incidents[focusedId].dialogue : null;
      }
    }
  }
}

const urgencyWeight = (urgency: RiskEpisode["urgency"]) => urgency === "critical" ? 4 : urgency === "urgent" ? 2 : 1;

function priorityForRisk(risk: RiskEpisode, now: number) {
  const pressure = 1 + Math.min(2, Math.max(0, now - risk.startedAt) / risk.responseWindowSec);
  return risk.severity * urgencyWeight(risk.urgency) * pressure;
}

/** Приоритет зависит от стадии/контекста и ожидания. Category не участвует. */
export function incidentPriority(state: SimState, eventId: string): number {
  const risk = state.incidents[eventId]?.riskEpisodes.at(-1);
  return risk ? priorityForRisk(risk, state.t) : 0;
}

export function incidentObservation(state: SimState, data: ScenarioData, eventId: string): string {
  const incident = state.incidents[eventId];
  const ev = findEvent(data, eventId);
  const risk = incident?.riskEpisodes.at(-1);
  if (risk && risk.key !== "base") return risk.text;
  if (incident?.escalated && ev?.escalation?.text) return ev.escalation.text;
  return (incident?.dialogue && findNode(data, eventId, incident.dialogue.nodeId)?.text) || ev?.title || eventId;
}

function syncIncidentRisk(state: SimState, data: ScenarioData, incident: RuntimeIncident, announce = true) {
  const ev = findEvent(data, incident.eventId)!;
  const elapsed = state.t - (incident.triggeredAt ?? state.t);
  const index = ev.priorityRules?.findIndex((rule) =>
    (rule.afterSec === undefined || elapsed + 1e-7 >= rule.afterSec) && (!rule.if || evalCondition(rule.if, state))) ?? -1;
  const rule = index >= 0 ? ev.priorityRules![index] : undefined;
  const key = rule ? `rule:${index}` : "base";
  const previous = incident.riskEpisodes.at(-1);
  if (previous?.key === key) return;
  if (previous) previous.endedAt = state.t;
  const risk: RiskEpisode = { key, startedAt: state.t,
    severity: rule?.severity ?? ev.severity ?? 1, urgency: rule?.urgency ?? ev.urgency ?? "routine",
    responseWindowSec: rule?.responseWindowSec ?? ev.responseWindowSec ?? 30,
    text: rule?.text ?? findNode(data, ev.id, incident.dialogue?.nodeId ?? ev.startNode)?.text ?? ev.title,
    noticedAt: incident.status === "active" && state.active?.eventId === ev.id ? state.t : undefined };
  incident.riskEpisodes.push(risk);
  if (rule?.set) {
    Object.assign(state.flags, rule.set);
    Object.assign(incident.context, rule.set);
  }
  if (previous && announce) {
    recordWorkload(state, data, incident, "risk_changed", risk.text);
    state.feed.push({ t: state.t, text: `${ev.title}: ${risk.text}`, kind: "warn" });
  }
}

function recordWorkload(state: SimState, data: ScenarioData, incident: RuntimeIncident,
  kind: WorkloadEntry["kind"], text: string, extra: Partial<WorkloadEntry> = {}): WorkloadEntry | undefined {
  if (!concurrentGameplay(data)) return;
  const risk = incident.riskEpisodes.at(-1);
  if (!risk) return;
  const priority = priorityForRisk(risk, state.t);
  const entry: WorkloadEntry = { t: state.t, kind, eventId: incident.eventId, nodeId: incident.dialogue?.nodeId,
    text, severity: risk.severity, urgency: risk.urgency, responseWindowSec: risk.responseWindowSec,
    waitingSec: Math.max(0, state.t - (incident.triggeredAt ?? state.t)), priority,
    context: { ...incident.context }, competingEventIds: Object.values(state.incidents)
      .filter((other) => other.eventId !== incident.eventId && (other.status === "active" || other.status === "waiting") &&
        incidentPriority(state, other.eventId) > priority * 1.5).map((other) => other.eventId), ...extra };
  state.workload.push(entry);
  return entry;
}

/** Применить эффекты к шкалам. Потеря лояльности усиливается по классу вагона. Возвращает фактические эффекты. */
function applyEffects(state: SimState, data: ScenarioData, eventId: string, fx: { loyalty: number; safety: number }) {
  const loyalty = fx.loyalty < 0 ? Math.round(fx.loyalty * patience(state, data, eventId).loyaltyLoss) : fx.loyalty;
  const applied = { loyalty, safety: fx.safety };
  const before = { loyalty: state.loyalty, safety: state.safety };
  state.loyalty = clamp(state.loyalty + applied.loyalty);
  state.safety = clamp(state.safety + applied.safety);
  return { loyalty: state.loyalty - before.loyalty, safety: state.safety - before.safety };
}

export function findEvent(data: ScenarioData, id: string): GameEvent | undefined {
  return data.events.find((e) => e.id === id);
}
export function findNode(data: ScenarioData, eventId: string, nodeId: string): DialogueNode | undefined {
  return findEvent(data, eventId)?.nodes.find((n) => n.id === nodeId);
}

// ───────────────────────────── Условия ─────────────────────────────

type ConditionState = Pick<SimState, "flags" | "loyalty" | "safety"> & Partial<Pick<SimState, "resources">>;

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
  if ("resource" in cond) {
    const resource = cond.resource;
    if (resource.type === "availableSeats") return inRange(state.resources?.availableSeats[resource.carId] ?? 0, resource.range);
    if (resource.type === "carType") return state.resources?.carTypes[resource.carId] === resource.eq;
    if (resource.type === "capability") {
      const value = state.resources?.capabilities[resource.carId]?.[resource.capability] ?? false;
      return resource.eq === undefined ? value : value === resource.eq;
    }
    const value = state.resources?.serviceEntitlements[resource.entitlement] ?? false;
    return resource.eq === undefined ? value : value === resource.eq;
  }
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

function conditionFlags(condition: Condition, state: ConditionState): string[] {
  if (!evalCondition(condition, state)) return [];
  if ("flag" in condition) return [condition.flag];
  if ("all" in condition) return condition.all.flatMap((c) => conditionFlags(c, state));
  if ("any" in condition) return condition.any.flatMap((c) => conditionFlags(c, state));
  return [];
}

export function resolveOutcome(option: DialogueOption, state: ConditionState) {
  return option.outcomes?.find((o) => evalCondition(o.if, state)) ?? {
    correct: !!option.correct, effects: option.effects, feedback: option.feedback,
  };
}

function decisionContext(ev: GameEvent, state: SimState) {
  if (!ev.context) return undefined;
  return {
    known: ev.context.filter((c) => Object.hasOwn(state.flags, c.flag)).map((c) =>
      `${c.label}: ${state.flags[c.flag] === true ? "да" : state.flags[c.flag] === false ? "нет" : state.flags[c.flag]}`),
    missing: ev.context.filter((c) => !Object.hasOwn(state.flags, c.flag)).map((c) => c.label),
  };
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
  if (!state.active || state.finished) return;
  const currentNode = findNode(data, state.active.eventId, state.active.nodeId)!;
  if (effectiveNodeKind(currentNode, state) !== "decision") return;
  const ev = findEvent(data, state.active.eventId)!;
  const incident = state.incidents[ev.id];
  syncIncidentRisk(state, data, incident);
  const risk = incident.riskEpisodes.at(-1)!;
  risk.noticedAt ??= state.t;
  risk.responseAt ??= state.t;
  const workloadAction = recordWorkload(state, data, incident, "action", option.text, { optionId: option.id });
  incident.respondedAt ??= state.t;
  const context = decisionContext(ev, state);
  const outcome = resolveOutcome(option, state);
  let remaining: number | undefined;
  if (option.timeCostSec && concurrentGameplay(data)) {
    const dialogue = state.active;
    if (dialogue.limitSec) remaining = dialogue.limitSec - (state.t - dialogue.openedAt) - option.timeCostSec;
    const target = Math.min(data.durationSec, state.t + option.timeCostSec);
    while (!state.finished && state.active === dialogue && state.t + 0.000001 < target) {
      tick(state, Math.min(0.05, target - state.t), data, { pauseWhileDialogue: false });
    }
    if (state.active !== dialogue) return; // действие прервано просрочкой/эскалацией
  } else if (option.timeCostSec) {
    const limit = state.active.limitSec ?? DEFAULT_REACTION_LIMIT_SEC;
    remaining = limit - (state.t - state.active.openedAt) - option.timeCostSec;
    state.active.limitSec = limit;
    state.active.openedAt -= option.timeCostSec;
    if (remaining <= 0) {
      timeoutDialogue(state, data);
      state.log[state.log.length - 1].timeCostSec = option.timeCostSec;
      return;
    }
  }

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
    loyalty: outcome.effects.loyalty + (extra?.loyalty ?? 0),
    safety: outcome.effects.safety + (extra?.safety ?? 0),
  });

  state.log.push({
    t: state.t,
    eventId: ev.id,
    category: ev.category,
    nodeId: state.active.nodeId,
    optionId: option.id,
    reactionMs: concurrentGameplay(data) ? Math.round(Math.max(0, state.t - state.active.openedAt) * 1000) : Date.now() - state.active.wallOpenedAt,
    correct: outcome.correct && (!option.outcomes || !violation),
    context,
    feedback: outcome.feedback,
    flagsSet: option.set ? { ...option.set } : undefined,
    causes: state.eventCauses?.[ev.id],
    timeCostSec: option.timeCostSec,
    effects,
    limitSec: state.active.limitSec,
    ...(option.step && { step: option.step }),
    ...(violation && { violation }),
  });
  if (option.set) Object.assign(state.flags, option.set);
  if (option.set) Object.assign(incident.context, option.set);
  if (workloadAction) {
    workloadAction.completedAt = state.t;
    workloadAction.correct = state.log.at(-1)!.correct;
    workloadAction.effects = effects;
    workloadAction.context = { ...incident.context };
  }
  syncIncidentRisk(state, data, incident);
  state.feed.push({
    t: state.t,
    text: `${ev.title}: ${state.log[state.log.length - 1].correct ? "обоснованное решение" : "спорное решение"} (лояльность ${fmt(effects.loyalty)}, безопасность ${fmt(effects.safety)})`,
    kind: state.log[state.log.length - 1].correct ? "good" : "bad",
  });
  if (violation)
    state.feed.push({ t: state.t, text: `Ролевая модель: ${ROLE_VIOLATION_TEXT[violation]}`, kind: "bad" });
  if (fullChain) state.feed.push({ t: state.t, text: "Ролевая модель: полная цепочка без нарушений", kind: "good" });
  // переход считается ПОСЛЕ эффектов и флагов: так «лояльность < 30» учитывает только что сделанный выбор
  const next = resolveNext(option, state);
  if (next) {
    openNode(state, data, ev.id, next);
    if (remaining !== undefined && state.active) {
      state.active.limitSec = Math.min(state.active.limitSec ?? remaining, remaining);
    }
  } else {
    finishIncident(state, "resolved", data);
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
  if (node && effectiveNodeKind(node, state) === "information") return;
  const branch = node?.onTimeout;
  const incident = state.incidents[ev.id];
  syncIncidentRisk(state, data, incident);
  const risk = incident.riskEpisodes.at(-1);
  if (risk) risk.failed = true;
  const effects = applyEffects(state, data, ev.id, branch?.effects ?? TIMEOUT_PENALTY);
  state.log.push({
    t: state.t,
    eventId: ev.id,
    category: ev.category,
    nodeId: state.active.nodeId,
    optionId: null,
    reactionMs: concurrentGameplay(data) ? Math.round(Math.max(0, state.t - state.active.openedAt) * 1000) : Date.now() - state.active.wallOpenedAt,
    correct: false,
    context: decisionContext(ev, state),
    flagsSet: branch?.set ? { ...branch.set } : undefined,
    causes: state.eventCauses?.[ev.id],
    effects,
    limitSec: state.active.limitSec,
    feedback: branch?.text,
  });
  if (branch?.set) Object.assign(state.flags, branch.set);
  if (branch?.set) Object.assign(incident.context, branch.set);
  recordWorkload(state, data, incident, "expired", branch?.text ?? "Время на решение истекло", { effects });
  state.feed.push({ t: state.t, text: `${ev.title}: ${branch?.text ?? "время на решение истекло"}`, kind: "bad" });
  if (branch?.next) openNode(state, data, ev.id, branch.next);
  else {
    incident.status = "expired"; // Запись с эффектами уже добавлена выше.
    finishIncident(state, "expired", data);
  }
}

/**
 * Перезапустить отсчёт реакции открытого узла (Date.now()).
 * Нужен визуальному слою: пока показывается реакция на выбор, симуляция стоит,
 * и эта пауза не должна засчитываться игроку в время реакции следующего решения.
 */
export function resetReactionClock(state: SimState, wallNow = Date.now()) {
  if (state.active) state.active.wallOpenedAt = wallNow;
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
  competencies: { communication: number; safety: number; speed: number; protocol: number; roleModel: number; prioritization: number; situational_awareness: number };
  recommendations: string[];
}

export function prioritizationScore(state: SimState, data: ScenarioData): number {
  return workloadScores(state, data).prioritization;
}

/** Разумные порядки дают одинаковый результат: оцениваем реальные задержки и ухудшения, не ранг клика. */
export function workloadScores(state: SimState, data: ScenarioData) {
  let responseWeight = 0, responseCredit = 0, noticeWeight = 0, noticeCredit = 0;
  for (const ev of data.events) {
    const incident = state.incidents[ev.id];
    if (!concurrentGameplay(data) || incident?.triggeredAt === undefined ||
      (ev.severity === undefined && !ev.responseWindowSec && !ev.priorityRules)) continue;
    for (const risk of incident.riskEpisodes) {
      const weight = risk.severity * urgencyWeight(risk.urgency);
      if (!weight) continue;
      const end = risk.endedAt ?? state.t;
      const noticeWindow = Math.min(risk.responseWindowSec, Math.max(5, risk.responseWindowSec / 2));
      const credit = (time: number | undefined, window: number) => time === undefined ? 0
        : Math.max(0, 1 - Math.max(0, time - risk.startedAt - window) / window);
      if (risk.noticedAt !== undefined || end + 1e-7 >= risk.startedAt + noticeWindow) {
        noticeWeight += weight;
        noticeCredit += weight * credit(risk.noticedAt, noticeWindow);
      }
      if (risk.responseAt !== undefined || risk.failed || end + 1e-7 >= risk.startedAt + risk.responseWindowSec) {
        responseWeight += weight;
        responseCredit += weight * (risk.failed ? 0 : credit(risk.responseAt, risk.responseWindowSec));
      }
    }
  }
  return { prioritization: responseWeight ? Math.round(responseCredit / responseWeight * 100) : 100,
    situational_awareness: noticeWeight ? Math.round(noticeCredit / noticeWeight * 100) : 100 };
}

export function computeResult(state: SimState, data: ScenarioData): SimResult {
  const log = state.log.filter((entry) => !entry.cause);
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
    prioritization: prioritizationScore(state, data),
    situational_awareness: workloadScores(state, data).situational_awareness,
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
  if (competencies.prioritization < 70) recommendations.push("Отработайте выбор очередности помощи: учитывайте признаки ухудшения и время ожидания каждой ситуации.");
  if (competencies.situational_awareness < 70) recommendations.push("Проверяйте новые обращения и изменения признаков: наблюдение за одной ситуацией не заменяет обзор остальных.");
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
