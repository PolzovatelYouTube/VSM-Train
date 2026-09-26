/**
 * Доменная модель сценария тренажёра ВСМ.
 * Используется и на клиенте (редактор, симуляция), и на сервере (валидация, хранение).
 *
 * Иерархия:  Scenario → Train → Car[] → Cell[]
 *                     → Actor[]  (пассажиры/персонал с моделью поведения = список шагов)
 *                     → GameEvent[] (нештатные ситуации = граф диалога с вариантами ответов)
 */
import { z } from "zod";

// ───────────────────────────── Вагон и клетки ─────────────────────────────

// Классы обслуживания и компоновки — по схемам вагонов из материалов заказчика
export const CAR_TYPES = ["first", "business", "comfort", "standard", "bistro"] as const;
export type CarType = (typeof CAR_TYPES)[number];
export type SeatCarType = Exclude<CarType, "bistro">;

export const CAR_TYPE_LABEL: Record<CarType, string> = {
  first: "Первый класс (2+1)",
  business: "Бизнес (2+2)",
  comfort: "Комфорт (2+2)",
  standard: "Стандарт (3+2)",
  bistro: "Вагон-бистро",
};

export const CAR_TYPE_SHORT: Record<CarType, string> = {
  first: "1 кл",
  business: "бизнес",
  comfort: "комфорт",
  standard: "стандарт",
  bistro: "бистро",
};

/** Буквы мест поперёк вагона; "" — проход */
export const SEAT_LETTERS: Record<SeatCarType, string[]> = {
  first: ["A", "", "B", "C"],
  business: ["A", "B", "", "C", "D"],
  comfort: ["A", "B", "", "C", "D"],
  standard: ["A", "B", "C", "", "D", "E"],
};

/** Рядов по умолчанию при добавлении вагона в редакторе (в первом классе шаг кресел больше) */
export const DEFAULT_ROWS: Record<CarType, number> = { first: 8, business: 10, comfort: 12, standard: 14, bistro: 8 };

/** Номер ряда клеток (y), по которому идёт проход */
export const aisleRow = (type: CarType) => (type === "bistro" ? 2 : SEAT_LETTERS[type].indexOf(""));

export const CELL_KINDS = [
  "seat", // кресло (есть номер места)
  "aisle", // проход
  "vestibule", // тамбур
  "door", // межвагонная дверь
  "toilet", // санузел (непроходим)
  "luggage", // багажная полка / стойка (непроходима)
  "table", // столик в бистро (непроходим)
  "bar", // барная стойка (непроходима)
  "wall",
] as const;
export type CellKind = (typeof CELL_KINDS)[number];

/** Клетки, по которым может идти актор */
export const WALKABLE: ReadonlySet<CellKind> = new Set<CellKind>([
  "seat",
  "aisle",
  "vestibule",
  "door",
]);

export const cellSchema = z.object({
  x: z.number().int(), // вдоль вагона (колонка)
  y: z.number().int(), // поперёк вагона (ряд)
  kind: z.enum(CELL_KINDS),
  seat: z.string().optional(), // "12A"
});
export type Cell = z.infer<typeof cellSchema>;

export const carSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  // миграция: старый тип "second" (2+2) читается как "comfort"
  type: z.preprocess((v) => (v === "second" ? "comfort" : v), z.enum(CAR_TYPES)),
  length: z.number().int(), // клеток по x
  width: z.number().int(), // клеток по y
  cells: z.array(cellSchema),
  /** Ресурсы конкретного вагона, заданные автором сценария. */
  availableSeats: z.number().int().min(0).optional(),
  capabilities: z
    .object({
      accessibleToilet: z.boolean().optional(),
      wheelchairStorage: z.boolean().optional(),
      writtenCommunication: z.boolean().optional(),
      visualInformation: z.boolean().optional(),
      quietArea: z.boolean().optional(),
      babyCareSpace: z.boolean().optional(),
    })
    .optional(),
});
export type Car = z.infer<typeof carSchema>;

export const ACCESSIBILITY_NEEDS = ["hearing", "vision", "wheelchair", "mobility"] as const;
export type AccessibilityNeed = (typeof ACCESSIBILITY_NEEDS)[number];

export const SERVICE_ENTITLEMENTS = [
  "mealDelivery",
  "mobilityAssistance",
  "writtenCommunication",
  "verbalOrientation",
  "quietArea",
  "babyCareAlternative",
] as const;
export type ServiceEntitlement = (typeof SERVICE_ENTITLEMENTS)[number];

export const carCapabilitySchema = carSchema.shape.capabilities.unwrap();
export type CarCapability = keyof z.infer<typeof carCapabilitySchema>;

// ───────────────────────────── Акторы и поведение ─────────────────────────────

export const ACTOR_ROLES = [
  "passenger",
  "vip",
  "elderly",
  "child",
  "troublemaker",
  "conductor",
] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export const ACTOR_ROLE_LABEL: Record<ActorRole, string> = {
  passenger: "Пассажир",
  vip: "VIP-пассажир",
  elderly: "Пожилой пассажир",
  child: "Ребёнок",
  troublemaker: "Конфликтный пассажир",
  conductor: "Проводник",
};

export const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ownSeat") }),
  z.object({ kind: z.literal("seat"), carId: z.string(), seat: z.string() }),
  z.object({ kind: z.literal("cell"), carId: z.string(), x: z.number().int(), y: z.number().int() }),
  z.object({
    kind: z.literal("zone"),
    carId: z.string(),
    zone: z.enum(["toilet", "bar", "vestibule"]),
  }),
]);
export type Target = z.infer<typeof targetSchema>;

export const behaviorStepSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("goto"), target: targetSchema }),
  z.object({ type: z.literal("sit") }),
  z.object({ type: z.literal("wait"), seconds: z.number().min(0) }),
  z.object({ type: z.literal("emit"), eventId: z.string() }),
  z.object({ type: z.literal("say"), text: z.string() }),
  z.object({ type: z.literal("mood"), delta: z.number() }),
]);
export type BehaviorStep = z.infer<typeof behaviorStepSchema>;

export const STEP_LABEL: Record<BehaviorStep["type"], string> = {
  goto: "Идти к…",
  sit: "Сесть",
  wait: "Ждать",
  emit: "Запустить событие",
  say: "Сказать",
  mood: "Изменить настроение",
};

// ───────────────────────────── Визуальная сцена (необязательно) ─────────────────────────────
// Только авторские настройки, которые нельзя вывести из данных. Все поля optional:
// старые сценарии без блока visual работают без миграции (см. shared/visual.ts — значения по умолчанию).

export const LANDSCAPES = ["day", "sunset", "night"] as const;
export type Landscape = (typeof LANDSCAPES)[number];

export const LANDSCAPE_LABEL: Record<Landscape, string> = { day: "День", sunset: "Закат", night: "Ночь" };

export const scenarioVisualSchema = z.object({
  landscape: z.enum(LANDSCAPES).optional(),
  interior: z.string().optional(), // ключ интерьера из реестра ассетов; нет — по классу вагона
});
export type ScenarioVisual = z.infer<typeof scenarioVisualSchema>;

export const actorVisualSchema = z.object({
  preset: z.string().optional(), // ключ пресета спрайта; нет — по роли
  accent: z.string().optional(), // цвет одежды, #rrggbb
});
export type ActorVisual = z.infer<typeof actorVisualSchema>;

export const actorSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(ACTOR_ROLES),
  ticket: z.object({ carId: z.string(), seat: z.string() }).nullable(),
  spawn: z.object({ carId: z.string(), x: z.number().int(), y: z.number().int() }),
  mood: z.number().min(0).max(100),
  steps: z.array(behaviorStepSchema),
  /** Наблюдаемая потребность в доступности; роль и возраст её не заменяют. */
  accessibilityNeeds: z.array(z.enum(ACCESSIBILITY_NEEDS)).optional(),
  visual: actorVisualSchema.optional(),
});
export type Actor = z.infer<typeof actorSchema>;

// ───────────────────────────── События (диалоговый граф) ─────────────────────────────

export const EVENT_CATEGORIES = ["conflict", "medical", "technical", "request"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  conflict: "Конфликт",
  medical: "Медицинский",
  technical: "Технический",
  request: "Обращение",
};

// ── Флаги и условия ──
// Флаги — память сценария между узлами и событиями («предложил переноску», «позвал НП»).
// Условие — маленький декларативный язык без eval: флаг, диапазон шкалы, И / ИЛИ.

export const flagValueSchema = z.union([z.boolean(), z.number()]);
export type FlagValue = z.infer<typeof flagValueSchema>;

export const rangeSchema = z.object({ lt: z.number().optional(), gte: z.number().optional() });
export type Range = z.infer<typeof rangeSchema>;

export type Condition =
  | { flag: string; eq?: FlagValue }
  | { loyalty: Range }
  | { safety: Range }
  | { resource: ResourceCondition }
  | { all: Condition[] }
  | { any: Condition[] };

export type ResourceCondition =
  | { type: "availableSeats"; carId: string; range: Range }
  | { type: "carType"; carId: string; eq: CarType }
  | { type: "capability"; carId: string; capability: CarCapability; eq?: boolean }
  | { type: "serviceEntitlement"; entitlement: ServiceEntitlement; eq?: boolean };

const resourceConditionSchema: z.ZodType<ResourceCondition> = z.union([
  z.object({ type: z.literal("availableSeats"), carId: z.string(), range: rangeSchema }),
  z.object({ type: z.literal("carType"), carId: z.string(), eq: z.enum(CAR_TYPES) }),
  z.object({ type: z.literal("capability"), carId: z.string(), capability: z.enum(Object.keys(carCapabilitySchema.shape) as [CarCapability, ...CarCapability[]]), eq: z.boolean().optional() }),
  z.object({ type: z.literal("serviceEntitlement"), entitlement: z.enum(SERVICE_ENTITLEMENTS), eq: z.boolean().optional() }),
]);

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ flag: z.string(), eq: flagValueSchema.optional() }),
    z.object({ loyalty: rangeSchema }),
    z.object({ safety: rangeSchema }),
    z.object({ resource: resourceConditionSchema }),
    z.object({ all: z.array(conditionSchema) }),
    z.object({ any: z.array(conditionSchema) }),
  ]),
);

// ── Ролевая модель общения (методичка «Ситуации на борту») ──
export const ROLE_STEPS = ["acknowledge", "rule", "solution", "assure"] as const;
export type RoleStep = (typeof ROLE_STEPS)[number];

export const ROLE_STEP_LABEL: Record<RoleStep, string> = {
  acknowledge: "Признать ситуацию",
  rule: "Обозначить правило",
  solution: "Предложить решение",
  assure: "Заверить",
};

export const dialogueOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  next: z.string().nullable(), // id следующего узла или null = конец события
  effects: z.object({ loyalty: z.number(), safety: z.number() }),
  correct: z.boolean().optional(), // эталонный вариант (для подсказок и оценки)
  // Первый подходящий результат оценивается ДО эффектов и установки флагов.
  outcomes: z.array(z.object({
    if: conditionSchema,
    correct: z.boolean(),
    effects: z.object({ loyalty: z.number(), safety: z.number() }),
    feedback: z.string(),
  })).optional(),
  timeCostSec: z.number().finite().positive().optional(), // расход оставшегося бюджета решения
  hint: z.string().optional(),
  feedback: z.string().optional(), // разбор после рейса: почему выбор так повлиял на шкалы
  step: z.enum(ROLE_STEPS).optional(), // какой шаг ролевой модели реализует реплика
  set: z.record(z.string(), flagValueSchema).optional(), // какие флаги выставляет выбор
  if: conditionSchema.optional(), // вариант виден, только если условие истинно
  // условные переходы: первый сработавший побеждает, иначе используется next
  nextIf: z.array(z.object({ if: conditionSchema, next: z.string().nullable() })).optional(),
});
export type DialogueOption = z.infer<typeof dialogueOptionSchema>;
export type NodeKind = "decision" | "information";
export type IncidentStatus = "pending" | "active" | "waiting" | "resolved" | "expired";

export const workloadEntrySchema = z.object({
  t: z.number(),
  kind: z.enum(["appeared", "selected", "left", "action", "risk_changed", "escalated", "expired", "resolved"]),
  eventId: z.string(),
  nodeId: z.string().optional(),
  fromEventId: z.string().optional(),
  optionId: z.string().optional(),
  text: z.string(),
  severity: z.number(),
  urgency: z.enum(["routine", "urgent", "critical"]),
  responseWindowSec: z.number(),
  waitingSec: z.number(),
  priority: z.number(),
  competingEventIds: z.array(z.string()).optional(),
  context: z.record(z.string(), flagValueSchema).optional(),
  correct: z.boolean().optional(),
  completedAt: z.number().optional(),
  effects: z.object({ loyalty: z.number(), safety: z.number() }).optional(),
});
export type WorkloadEntry = z.infer<typeof workloadEntrySchema>;

export const dialogueNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["decision", "information"]).optional(),
  speaker: z.string(),
  text: z.string(),
  timerSec: z.number().min(0).optional(), // 0/undefined = без таймера
  options: z.array(dialogueOptionSchema),
  next: z.string().nullable().optional(),
  set: z.record(z.string(), flagValueSchema).optional(),
  // Что происходит, если проводник не успел: своя ветка вместо фиксированного штрафа
  onTimeout: z
    .object({
      next: z.string().nullable(), // узел-последствие («пассажир ушёл жаловаться») или конец события
      effects: z.object({ loyalty: z.number(), safety: z.number() }),
      set: z.record(z.string(), flagValueSchema).optional(),
      text: z.string().optional(), // запись в журнал рейса
    })
    .optional(),
});
export type DialogueNode = z.infer<typeof dialogueNodeSchema>;

export const triggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("manual") }), // запуск кнопкой в песочнице
  z.object({ type: z.literal("time"), atSec: z.number().min(0) }), // по таймеру рейса
  z.object({ type: z.literal("actor") }), // из шага поведения актора (emit)
  z.object({ type: z.literal("condition"), if: conditionSchema }), // когда условие стало истинным
]);
export type Trigger = z.infer<typeof triggerSchema>;

export const gameEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(EVENT_CATEGORIES),
  actorId: z.string().nullable(), // с кем связано (камера переедет к нему)
  trigger: triggerSchema,
  startNode: z.string(),
  nodes: z.array(dialogueNodeSchema),
  urgency: z.enum(["routine", "urgent", "critical"]).optional(),
  severity: z.number().finite().min(0).max(5).optional(),
  priorityRules: z.array(z.object({
    if: conditionSchema.optional(),
    afterSec: z.number().finite().min(0).optional(),
    severity: z.number().finite().min(0).max(5),
    urgency: z.enum(["routine", "urgent", "critical"]),
    responseWindowSec: z.number().finite().positive(),
    text: z.string(), // наблюдаемые признаки, без готового приоритета
    set: z.record(z.string(), flagValueSchema).optional(), // контекст стадии для результатов действий
  })).optional(), // первый подходящий rule; наиболее специфичные размещаются первыми
  responseWindowSec: z.number().finite().positive().optional(),
  location: z.object({ carId: z.string(), x: z.number().finite().optional(), y: z.number().finite().optional() }).optional(),
  escalation: z.object({
    afterSec: z.number().finite().positive(),
    nextEvent: z.string().optional(),
    nextNode: z.string().optional(),
    effects: z.object({ loyalty: z.number(), safety: z.number() }).optional(),
    set: z.record(z.string(), flagValueSchema).optional(),
    text: z.string().optional(),
  }).optional(),
  context: z.array(z.object({ flag: z.string(), label: z.string() })).optional(),
  contentTodo: z.string().optional(), // неподтверждённый учебный материал, не нормативное правило
  stage: z.enum(["boarding", "onboard", "alighting", "complaint"]).optional(),
});
export type GameEvent = z.infer<typeof gameEventSchema>;

// ───────────────────────────── Сценарий целиком ─────────────────────────────

export const scenarioDataSchema = z.object({
  version: z.literal(1),
  gameplay: z.enum(["concurrent", "sequential"]).optional(),
  train: z.object({ name: z.string(), cars: z.array(carSchema) }),
  actors: z.array(actorSchema),
  events: z.array(gameEventSchema),
  durationSec: z.number().min(10),
  initial: z.object({ loyalty: z.number(), safety: z.number() }),
  visual: scenarioVisualSchema.optional(),
  /** Доступные на рейсе сервисы, а не заявление о юридических правах пассажира. */
  serviceEntitlements: z.partialRecord(z.enum(SERVICE_ENTITLEMENTS), z.boolean()).optional(),
});
export type ScenarioData = z.infer<typeof scenarioDataSchema>;

// ───────────────────────────── Утилиты ─────────────────────────────

export const uid = (p = "") =>
  p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

/** Генерирует планировку вагона по типу. Координаты: x вдоль вагона, y поперёк. */
export function buildCar(number: number, type: CarType, rows = 12): Car {
  const cells: Cell[] = [];
  const id = uid("car_");

  if (type === "bistro") {
    const width = 5;
    const length = rows + 4;
    for (let x = 0; x < length; x++) {
      for (let y = 0; y < width; y++) {
        let kind: CellKind = "aisle";
        if (x === 0 || x === length - 1) kind = y === 2 ? "door" : "vestibule";
        else if (x === 1 || x === length - 2) kind = y === 2 ? "aisle" : "luggage";
        else if (x >= 2 && x <= 5) kind = y === 0 ? "bar" : "aisle"; // барная стойка
        else if (x % 2 === 0 && (y === 0 || y === 4)) kind = "table"; // столики у окон
        cells.push({ x, y, kind });
      }
    }
    return { id, number, type, length, width, cells };
  }

  const letters = SEAT_LETTERS[type];
  const width = letters.length;
  const aisleY = aisleRow(type);
  const length = rows + 4;

  for (let x = 0; x < length; x++) {
    for (let y = 0; y < width; y++) {
      let kind: CellKind = "aisle";
      let seat: string | undefined;
      if (x === 0 || x === length - 1) {
        kind = y === aisleY ? "door" : "vestibule";
      } else if (x === 1) {
        kind = y === aisleY ? "aisle" : y < aisleY ? "toilet" : "luggage";
      } else if (x === length - 2) {
        kind = y === aisleY ? "aisle" : "luggage";
      } else if (y !== aisleY) {
        kind = "seat";
        seat = `${x - 1}${letters[y]}`;
      }
      cells.push({ x, y, kind, seat });
    }
  }
  return { id, number, type, length, width, cells };
}

export const cellAt = (car: Car, x: number, y: number) =>
  car.cells.find((c) => c.x === x && c.y === y);

export const seatCell = (car: Car, seat: string) => car.cells.find((c) => c.seat === seat);

export const isWalkable = (car: Car, x: number, y: number) => {
  const c = cellAt(car, x, y);
  return !!c && WALKABLE.has(c.kind);
};

// ───────────────────────────── Демо-сценарий ─────────────────────────────

export function demoScenario(): ScenarioData {
  const car1 = buildCar(1, "first", 10);
  const car2 = buildCar(2, "comfort", 12);
  const car3 = buildCar(3, "bistro", 8);

  const evConflict: GameEvent = {
    id: "ev_conflict",
    title: "Спор за место 5C",
    category: "conflict",
    actorId: "a_trouble",
    trigger: { type: "actor" },
    stage: "boarding",
    startNode: "n1",
    nodes: [
      {
        id: "n1",
        speaker: "Пассажир Громов",
        text: "Я сел, где хотел. Моё место у прохода, а здесь окно — какая разница? Не буду пересаживаться.",
        timerSec: 20,
        options: [
          {
            id: "o1",
            text: "Спокойно объяснить, что место закреплено за другим пассажиром, и предложить помочь пересесть",
            next: "n2",
            effects: { loyalty: 5, safety: 0 },
            correct: true,
            hint: "Деэскалация: признать ситуацию, предложить решение, не спорить.",
          },
          {
            id: "o2",
            text: "Жёстко потребовать освободить место немедленно",
            next: "n3",
            effects: { loyalty: -15, safety: -5 },
          },
          {
            id: "o3",
            text: "Проигнорировать, пусть разбираются сами",
            next: null,
            effects: { loyalty: -20, safety: -10 },
          },
        ],
      },
      {
        id: "n2",
        speaker: "Пассажир Громов",
        text: "Ну… ладно. А если у окна свободно в другом ряду?",
        timerSec: 15,
        options: [
          {
            id: "o4",
            text: "Проверить свободные места по схеме и предложить вариант у окна",
            next: null,
            effects: { loyalty: 10, safety: 0 },
            correct: true,
          },
          {
            id: "o5",
            text: "Сказать, что пересадки запрещены правилами",
            next: null,
            effects: { loyalty: -5, safety: 0 },
          },
        ],
      },
      {
        id: "n3",
        speaker: "Пассажир Громов",
        text: "Вы мне ещё указывать будете?! Зовите начальника поезда!",
        timerSec: 15,
        options: [
          {
            id: "o6",
            text: "Извиниться за тон, вернуться к спокойному объяснению",
            next: "n2",
            effects: { loyalty: 5, safety: 0 },
            correct: true,
          },
          {
            id: "o7",
            text: "Пригрозить вызвать полицию на ближайшей станции",
            next: null,
            effects: { loyalty: -20, safety: -10 },
          },
        ],
      },
    ],
  };

  const evMedical: GameEvent = {
    id: "ev_medical",
    title: "Пассажиру плохо",
    category: "medical",
    actorId: "a_elderly",
    trigger: { type: "time", atSec: 45 },
    stage: "onboard",
    startNode: "m1",
    nodes: [
      {
        id: "m1",
        speaker: "Пассажирка Соколова",
        text: "Мне… тяжело дышать. Голова кружится, темнеет в глазах.",
        timerSec: 12,
        options: [
          {
            id: "m1a",
            text: "Оценить состояние, обеспечить доступ воздуха, сообщить начальнику поезда и объявить поиск врача",
            next: "m2",
            effects: { loyalty: 5, safety: 15 },
            correct: true,
            hint: "Алгоритм: оценка → безопасность → доклад → поиск медика.",
          },
          {
            id: "m1b",
            text: "Предложить воды и продолжить обход",
            next: null,
            effects: { loyalty: -10, safety: -25 },
          },
          {
            id: "m1c",
            text: "Дать таблетку из своей аптечки",
            next: null,
            effects: { loyalty: 0, safety: -30 },
          },
        ],
      },
      {
        id: "m2",
        speaker: "Начальник поезда",
        text: "Принято. Ближайшая остановка через 9 минут. Что предлагаете?",
        timerSec: 12,
        options: [
          {
            id: "m2a",
            text: "Запросить скорую на станцию, оставаться рядом с пассажиркой, контролировать дыхание",
            next: null,
            effects: { loyalty: 10, safety: 10 },
            correct: true,
          },
          {
            id: "m2b",
            text: "Дождаться конечной, чтобы не задерживать поезд",
            next: null,
            effects: { loyalty: -10, safety: -20 },
          },
        ],
      },
    ],
  };

  const evRequest: GameEvent = {
    id: "ev_request",
    title: "Просьба VIP-пассажира",
    category: "request",
    actorId: "a_vip",
    trigger: { type: "manual" },
    stage: "onboard",
    startNode: "r1",
    nodes: [
      {
        id: "r1",
        speaker: "Пассажир Ланской",
        text: "У меня важный звонок через пять минут. Можно сделать так, чтобы в вагоне было тише?",
        timerSec: 15,
        options: [
          {
            id: "r1a",
            text: "Предложить пройти в переговорную зону бистро и проводить туда",
            next: null,
            effects: { loyalty: 10, safety: 0 },
            correct: true,
          },
          {
            id: "r1b",
            text: "Попросить остальных пассажиров вагона не шуметь",
            next: null,
            effects: { loyalty: -5, safety: 0 },
          },
        ],
      },
    ],
  };

  const actors: Actor[] = [
    {
      id: "a_conductor",
      name: "Проводник (вы)",
      role: "conductor",
      ticket: null,
      spawn: { carId: car2.id, x: 1, y: 2 },
      mood: 100,
      steps: [],
    },
    {
      id: "a_trouble",
      name: "Громов",
      role: "troublemaker",
      ticket: { carId: car2.id, seat: "5A" },
      spawn: { carId: car2.id, x: car2.length - 1, y: 2 },
      mood: 40,
      steps: [
        { type: "wait", seconds: 3 },
        { type: "goto", target: { kind: "seat", carId: car2.id, seat: "5C" } },
        { type: "sit" },
        { type: "say", text: "Тут удобнее." },
        { type: "wait", seconds: 4 },
        { type: "emit", eventId: "ev_conflict" },
      ],
    },
    {
      id: "a_owner",
      name: "Петрова",
      role: "passenger",
      ticket: { carId: car2.id, seat: "5C" },
      spawn: { carId: car2.id, x: 0, y: 2 },
      mood: 80,
      steps: [
        { type: "wait", seconds: 8 },
        { type: "goto", target: { kind: "ownSeat" } },
        { type: "say", text: "Извините, это моё место…" },
      ],
    },
    {
      id: "a_elderly",
      name: "Соколова",
      role: "elderly",
      ticket: { carId: car2.id, seat: "9B" },
      spawn: { carId: car2.id, x: 10, y: 1 },
      mood: 70,
      steps: [{ type: "sit" }, { type: "wait", seconds: 44 }, { type: "mood", delta: -50 }],
    },
    {
      id: "a_vip",
      name: "Ланской",
      role: "vip",
      ticket: { carId: car1.id, seat: "3B" },
      spawn: { carId: car1.id, x: 4, y: 2 },
      mood: 75,
      steps: [
        { type: "sit" },
        { type: "wait", seconds: 20 },
        { type: "goto", target: { kind: "zone", carId: car3.id, zone: "bar" } },
        { type: "wait", seconds: 10 },
        { type: "goto", target: { kind: "ownSeat" } },
        { type: "sit" },
      ],
    },
    {
      id: "a_child",
      name: "Миша",
      role: "child",
      ticket: { carId: car2.id, seat: "2D" },
      spawn: { carId: car2.id, x: 3, y: 4 },
      mood: 90,
      steps: [
        { type: "sit" },
        { type: "wait", seconds: 6 },
        { type: "goto", target: { kind: "zone", carId: car2.id, zone: "toilet" } },
        { type: "wait", seconds: 5 },
        { type: "goto", target: { kind: "ownSeat" } },
        { type: "sit" },
      ],
    },
  ];

  return {
    version: 1,
    gameplay: "sequential",
    train: { name: "ВСМ «Сапсан-2» №701", cars: [car1, car2, car3] },
    actors,
    events: [evConflict, evMedical, evRequest],
    durationSec: 90,
    initial: { loyalty: 70, safety: 80 },
  };
}
