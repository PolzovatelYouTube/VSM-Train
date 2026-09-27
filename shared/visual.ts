/**
 * Модель визуальной сцены: чистый проектор «сценарий + состояние симуляции → что показать».
 * Не зависит от React/DOM/Canvas. Ничего не считает в очках и не меняет SimState —
 * только читает ScenarioData, SimState и (необязательно) последнюю запись журнала для показа последствия.
 */
import {
  type ScenarioData,
  type Actor,
  type ActorRole,
  type Car,
  type CarType,
  type Landscape,
  LANDSCAPES,
  cellAt,
} from "./scenario";
import { type SimState, type LogEntry, type RuntimeActor, type Facing, findEvent, findNode } from "./engine";
import { TRAIN_NAVMESH_REGISTRY, type Vector2D } from "./scenarios/all_cars_navmesh";

// ───────────────────────────── Пресеты персонажей ─────────────────────────────

export const SPRITE_PRESETS = [
  "conductor",
  "passenger-f",
  "passenger-m",
  "elderly-f",
  "elderly-m",
  "child",
  "vip",
  "troublemaker",
] as const;
export type SpritePreset = (typeof SPRITE_PRESETS)[number];

export const SPRITE_PRESET_LABEL: Record<SpritePreset, string> = {
  conductor: "Проводник (форма)",
  "passenger-f": "Пассажирка",
  "passenger-m": "Пассажир",
  "elderly-f": "Пожилая пассажирка",
  "elderly-m": "Пожилой пассажир",
  child: "Ребёнок",
  vip: "Деловой костюм",
  troublemaker: "Куртка, кепка",
};

const LEGACY_PRESET_MAP: Record<string, SpritePreset> = {
  passenger: "passenger-m",
  passenger_f: "passenger-f",
  passenger_m: "passenger-m",
  woman: "passenger-f",
  man: "passenger-m",

  elderly: "elderly-m",
  elderly_f: "elderly-f",
  elderly_m: "elderly-m",
  granny: "elderly-f",
  grandpa: "elderly-m",

  business: "vip",
  businessman: "vip",
  vip_passenger: "vip",

  kid: "child",
  child_passenger: "child",

  hooligan: "troublemaker",
  badguy: "troublemaker",

  staff: "conductor",
  provodnik: "conductor",
};

/** Стабильный хеш строки — чтобы пассажир без пресета всегда выглядел одинаково */
const hash = (s: string) => s.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function defaultPreset(role: ActorRole, actorId: string): SpritePreset {
  switch (role) {
    case "conductor":
      return "conductor";
    case "vip":
      return "vip";
    case "child":
      return "child";
    case "troublemaker":
      return "troublemaker";
    case "elderly":
      return hash(actorId) % 2 ? "elderly-m" : "elderly-f";
    default:
      return hash(actorId) % 2 ? "passenger-m" : "passenger-f";
  }
}

export const isSpritePreset = (v: unknown): v is SpritePreset =>
  typeof v === "string" && (SPRITE_PRESETS as readonly string[]).includes(v);

function normalizePreset(value: unknown): SpritePreset | null {
  if (typeof value !== "string") return null;
  if (isSpritePreset(value)) return value;

  const normalized = value.trim().toLowerCase();
  return LEGACY_PRESET_MAP[normalized] ?? null;
}

/** Пресет актора: авторский, если он известен, иначе — по роли */
export function resolvePreset(actor: Pick<Actor, "id" | "role" | "visual">): SpritePreset {
  const preset = normalizePreset(actor.visual?.preset);
  return preset ?? defaultPreset(actor.role, actor.id);
}

export const resolveLandscape = (data: ScenarioData): Landscape => {
  const l = data.visual?.landscape;
  return l && (LANDSCAPES as readonly string[]).includes(l) ? l : "day";
};

/** Интерьер: авторский ключ или ключ по классу вагона (сам ключ проверяет реестр ассетов на клиенте) */
export const resolveInterior = (data: ScenarioData, carType: CarType): string =>
  data.visual?.interior || `class-${carType}`;

// ───────────────────────────── Модель сцены ─────────────────────────────

export type ScenePhase = "observe" | "event" | "dialogue" | "consequence" | "finished";
export type CharacterState = "idle" | "walk" | "sit" | "talk" | "listen" | "positive" | "negative";
export type Emotion = "neutral" | "happy" | "worried" | "angry";
export type ConsequenceKind = "positive" | "negative" | "timeout";

export interface ScenePlacement {
  /** Координаты в процентах внутри изометрического изображения 1448×1086. */
  x: number;
  y: number;
  zIndex: number;
}

export interface SceneCharacter {
  id: string;
  name: string;
  role: ActorRole;
  preset: SpritePreset;
  accent?: string;
  /** 0..1 вдоль вагона (слева — хвост, справа — голова) */
  x: number;
  /** 0 — у дальнего окна, 1 — у ближнего края кадра */
  depth: number;
  seated: boolean;
  state: CharacterState;
  emotion: Emotion;
  facing: Facing;
  dimmed: boolean;
  bubble: string | null;
  placement: ScenePlacement;
  usesWheelchair: boolean;
}

export interface SceneConsequence {
  kind: ConsequenceKind;
  loyalty: number;
  safety: number;
  eventId: string;
}

export interface GameSceneModel {
  carId: string;
  carType: CarType;
  carNumber: number;
  phase: ScenePhase;
  landscape: Landscape;
  interior: string;
  focusedActorId?: string;
  /** Говорящий в сцене; undefined — реплика «за кадром» (например, начальник поезда по рации) */
  speakerId?: string;
  speakerName?: string;
  characters: SceneCharacter[];
  consequence?: SceneConsequence;
}

export interface ProjectOptions {
  /** Вагон, выбранный игроком; при событии камера переходит к вагону его актора (если follow) */
  viewCarId?: string;
  follow?: boolean;
  /** Запись журнала, реакцию на которую сейчас показывает UI (визуальная пауза) */
  consequence?: LogEntry | null;
}

export const consequenceKind = (e: LogEntry): ConsequenceKind =>
  e.optionId === null ? "timeout" : e.correct ? "positive" : "negative";

/** Какие записи журнала появились с прошлого кадра — UI показывает последнюю как «последствие» */
export const newLogEntries = (prevLength: number, state: Pick<SimState, "log">) => state.log.slice(prevLength);

function emotionFromMood(mood: number, role: ActorRole): Emotion {
  if (mood < 30) return role === "troublemaker" ? "angry" : "worried";
  if (mood < 50) return role === "troublemaker" ? "angry" : "neutral";
  if (mood >= 85) return "happy";
  return "neutral";
}

/** Сопоставить подпись говорящего с актором: «Пассажир Громов» → актор «Громов» */
export function matchSpeaker(data: ScenarioData, speaker: string, preferId?: string | null): Actor | undefined {
  const s = speaker.toLowerCase();
  const pref = data.actors.find((a) => a.id === preferId);
  const byName = (a: Actor) => {
    const name = a.name.replace(/\(.*?\)/g, "").trim().toLowerCase();
    return name.length > 1 && s.includes(name);
  };
  if (pref && byName(pref)) return pref;
  const found = data.actors.find(byName);
  if (found) return found;
  if (/проводник/.test(s)) return data.actors.find((a) => a.role === "conductor");
  return undefined;
}

const carOf = (data: ScenarioData, id?: string): Car | undefined => data.train.cars.find((c) => c.id === id);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function pointOnSpine(spine: Vector2D[], progress: number): Vector2D {
  if (spine.length < 2) return spine[0] ?? { x: 50, y: 50 };
  const scaled = Math.min(1, Math.max(0, progress)) * (spine.length - 1);
  const index = Math.min(spine.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return { x: lerp(spine[index].x, spine[index + 1].x, local), y: lerp(spine[index].y, spine[index + 1].y, local) };
}

/** Чистая проекция фактической позиции движка на изометрическую подложку вагона. */
export function resolveNavmeshPlacement(car: Car, actor: RuntimeActor): ScenePlacement {
  const mesh = TRAIN_NAVMESH_REGISTRY[car.type];
  const cell = cellAt(car, Math.round(actor.x), Math.round(actor.y));
  const seat = cell?.seat ? mesh.seats[cell.seat] : undefined;

  if (seat) {
    const pos = actor.seated && actor.path.length === 0 ? seat.seatPos : seat.approachPos;
    return { x: pos.x, y: pos.y, zIndex: actor.seated && actor.path.length === 0 ? seat.depth + 1 : Math.round(pos.y) };
  }

  const pos = pointOnSpine(mesh.aisleSpine, actor.x / Math.max(1, car.length - 1));
  return { x: pos.x, y: pos.y, zIndex: Math.round(pos.y) };
}

function resolveSeatFacing(
    car: Car,
    actor: RuntimeActor,
  ): Facing | undefined {
    const mesh = TRAIN_NAVMESH_REGISTRY[car.type];
    const cell = cellAt(car, Math.round(actor.x), Math.round(actor.y));
    const seat = cell?.seat ? mesh.seats[cell.seat] : undefined;

    return seat?.facing ?? (seat ? mesh.seatFacing : undefined);
}

export function projectGameScene(data: ScenarioData, sim: SimState, opts: ProjectOptions = {}): GameSceneModel {
  const follow = opts.follow ?? true;
  const conductor = data.actors.find((a) => a.role === "conductor");
  const conductorRt = sim.actors.find((a) => a.id === conductor?.id);

  const consequenceEntry = opts.consequence ?? null;
  const eventId = consequenceEntry?.eventId ?? sim.active?.eventId ?? null;
  const ev = eventId ? findEvent(data, eventId) : undefined;
  const focusedActorId = ev?.actorId ?? undefined;
  const focusedRt = sim.actors.find((a) => a.id === focusedActorId);

  const car =
    (follow && ev && carOf(data, ev.location?.carId ?? focusedRt?.carId)) ||
    carOf(data, opts.viewCarId) ||
    carOf(data, conductorRt?.carId) ||
    data.train.cars[0];

  let phase: ScenePhase = "observe";
  if (sim.finished) phase = "finished";
  else if (consequenceEntry) phase = "consequence";
  else if (sim.active) phase = "dialogue";
  else if (sim.queue.length) phase = "event";

  let speaker: Actor | undefined;
  let speakerName: string | undefined;
  if (phase === "dialogue" && sim.active) {
    const node = findNode(data, sim.active.eventId, sim.active.nodeId);
    if (node) {
      speakerName = node.speaker;
      speaker = matchSpeaker(data, node.speaker, focusedActorId);
    }
  }

  const kind = consequenceEntry ? consequenceKind(consequenceEntry) : null;
  const len = Math.max(1, car.length - 1);
  const inDialogue = phase === "dialogue" || phase === "consequence";

  const characters: SceneCharacter[] = sim.actors
    .filter((ra) => ra.carId === car.id)
    .map((ra) => {
      const def = data.actors.find((a) => a.id === ra.id)!;
      const walking = ra.path.length > 0;
      const next = ra.path[0];
      const isFocused = ra.id === focusedActorId;
      const isConductor = def.role === "conductor";

      let state: CharacterState = walking ? "walk" : ra.seated ? "sit" : "idle";
      let emotion = emotionFromMood(ra.mood, def.role);
      if (phase === "dialogue") {
        if (speaker && ra.id === speaker.id) state = "talk";
        else if (isFocused || isConductor) state = "listen";
      } else if (phase === "consequence" && kind) {
        if (isFocused) {
          state = kind === "positive" ? "positive" : "negative";
          emotion = kind === "positive" ? "happy" : def.role === "troublemaker" ? "angry" : "worried";
        } else if (isConductor) state = "talk";
      }

      // Направление взгляда: по ходу движения; в диалоге — на собеседника
      let facing: Facing = ra.facing ?? (ra.x > len / 2 ? "left" : "right");
      if (ra.seated && !walking) {
        facing = resolveSeatFacing(car, ra) ?? facing;
      } else if (inDialogue && focusedRt && focusedRt.carId === car.id) {
        const other = isFocused ? conductorRt : focusedRt;

        if (other && other.carId === car.id && other.id !== ra.id) {
          facing = other.x >= ra.x ? "right" : "left";
        }
      }

      // Глубина: 0 — у окна дальнего борта, 1 — ближний край; проход — посередине
      const depth = car.width > 1 ? Math.min(1, Math.max(0, ra.y / (car.width - 1))) : 0.5;

      return {
        id: ra.id,
        name: def.name,
        role: def.role,
        preset: resolvePreset(def),
        accent: def.visual?.accent,
        x: Math.min(1, Math.max(0, ra.x / len)),
        // стоящие и идущие всегда в проходе, даже если клетка — кресло (иначе накладываются на сидящих)
        depth: ra.seated && !walking ? depth : 0.5,
        seated: ra.seated && !walking,
        state,
        emotion,
        facing,
        dimmed: inDialogue && !isFocused && !isConductor && !(speaker && speaker.id === ra.id),
        // Во время визуальной паузы показывается только реакция на выбор. Таймер bubble
        // не тикает вместе с симуляцией, поэтому старая реплика не должна оставаться в кадре.
        bubble: phase === "consequence" ? null : ra.bubble?.text ?? null,
        placement: resolveNavmeshPlacement(car, ra),
        usesWheelchair: def.accessibilityNeeds?.includes("wheelchair") ?? false,
      };
    });

  return {
    carId: car.id,
    carType: car.type,
    carNumber: car.number,
    phase,
    landscape: resolveLandscape(data),
    interior: resolveInterior(data, car.type),
    focusedActorId,
    speakerId: speaker?.id,
    speakerName,
    characters,
    consequence:
      consequenceEntry && kind
        ? { kind, loyalty: consequenceEntry.effects.loyalty, safety: consequenceEntry.effects.safety, eventId: consequenceEntry.eventId }
        : undefined,
  };
}
