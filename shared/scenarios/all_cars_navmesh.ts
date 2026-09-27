import type { CarType } from "../scenario";
import type { Facing } from "../engine";

/**
 * Единый реестр изометрических навигационных карт (NavMesh) для вагонов ВСМ.
 * Включает точную обработку и координатную адаптацию масок SAM для:
 * 1. Бизнес-класс (annotated-biznes.jpg / biznes.jpg)
 * 2. Первый класс (annotated-pervyiklass.jpg)
 * 3. Комфорт-класс с игровой комнатой (annotated-komfort.jpg)
 * 4. Вагон-бистро / Стандарт с барной стойкой (annotated-standart.jpg)
 *
 * Все координаты нормализованы в процентах [0..100%].
 */

export interface Vector2D {
  x: number; // % слева
  y: number; // % сверху
}

export interface SeatMeta {
  id: string;            // Обозначение места ("1A", "2B", "3C")
  seatPos: Vector2D;     // Точка сидения (положение спрайта 'sitting')
  approachPos: Vector2D; // Точка выхода в проход (положение спрайта 'standing'/'walking')
  depth: number;         // z-index для корректного перекрытия спрайтов в изометрии
  facing?: Facing;       // Направление спрайта
}

export interface CarNavMesh {
  id: string;
  name: string;
  doorWest: Vector2D;         // Вход из тамбура слева
  doorEast: Vector2D;         // Переход в следующий вагон справа
  aisleSpine: Vector2D[];     // Главный проход вагона (узлы BFS-маршрутизации)
  seatFacing: Facing;
  seats: Record<string, SeatMeta>;
  specialZones?: Record<string, { name: string; pos: Vector2D; approachPos: Vector2D }>;
}

// ───────────────────────────── 1. БИЗНЕС-КЛАСС (annotated-biznes.jpg) ─────────────────────────────
// Точная разметка по центроидам масок SAM:
// Левый ряд (1 кресло у двери + 4 парных блока у левого окна)
// Правый ряд (5 парных блоков вдоль правого борта)
export const NAVMESH_BUSINESS: CarNavMesh = {
  id: "business",
  name: "Бизнес-класс ВСМ (2+2)",
  seatFacing: "left",
  doorWest: { x: 21.5, y: 71.3 }, // Вход из тамбура
  doorEast: { x: 88.2, y: 13.9 }, // Переход в следующий вагон
  aisleSpine: [
    { x: 21.5, y: 71.3 },
    { x: 28.5, y: 64.0 },
    { x: 37.5, y: 56.5 },
    { x: 46.5, y: 48.0 },
    { x: 55.5, y: 40.0 },
    { x: 64.5, y: 31.5 },
    { x: 73.5, y: 23.5 },
    { x: 81.0, y: 17.5 },
    { x: 88.2, y: 13.9 },
  ],
  seats: {
    // ── Левая сторона (у дверей и левых окон) ──
    // Ряд 1: одиночное кресло у тамбура
    "1A": { id: "1A", seatPos: { x: 20.1, y: 55.6 }, approachPos: { x: 27.5, y: 61.5 }, depth: 30},

    // Ряд 2: пара кресел
    "2A": { id: "2A", seatPos: { x: 30.5, y: 44.5 }, approachPos: { x: 36.5, y: 52.5 }, depth: 38 },
    "2B": { id: "2B", seatPos: { x: 34.0, y: 47.5 }, approachPos: { x: 38.0, y: 54.0 }, depth: 40 },

    // Ряд 3: пара кресел
    "3A": { id: "3A", seatPos: { x: 40.5, y: 36.0 }, approachPos: { x: 45.5, y: 44.5 }, depth: 48 },
    "3B": { id: "3B", seatPos: { x: 44.0, y: 39.0 }, approachPos: { x: 47.0, y: 46.0 }, depth: 50 },

    // Ряд 4: пара кресел
    "4A": { id: "4A", seatPos: { x: 51.0, y: 28.0 }, approachPos: { x: 54.5, y: 36.5 }, depth: 58 },
    "4B": { id: "4B", seatPos: { x: 54.5, y: 31.0 }, approachPos: { x: 56.0, y: 38.0 }, depth: 60 },

    // Ряд 5: пара кресел у дальней перегородки
    "5A": { id: "5A", seatPos: { x: 61.0, y: 19.5 }, approachPos: { x: 63.5, y: 28.5 }, depth: 68 },
    "5B": { id: "5B", seatPos: { x: 64.5, y: 22.5 }, approachPos: { x: 65.0, y: 30.0 }, depth: 70 },

    // ── Правая сторона (вдоль правого борта) ──
    // Ряд 1
    "1C": { id: "1C", seatPos: { x: 24.5, y: 64.5 }, approachPos: { x: 27.5, y: 61.5 }, depth: 32 },
    "1D": { id: "1D", seatPos: { x: 28.5, y: 67.5 }, approachPos: { x: 29.5, y: 63.0 }, depth: 34 },

    // Ряд 2
    "2C": { id: "2C", seatPos: { x: 35.0, y: 56.0 }, approachPos: { x: 37.5, y: 53.0 }, depth: 42 },
    "2D": { id: "2D", seatPos: { x: 39.0, y: 59.0 }, approachPos: { x: 39.5, y: 54.5 }, depth: 44 },

    // Ряд 3
    "3C": { id: "3C", seatPos: { x: 45.0, y: 47.5 }, approachPos: { x: 46.5, y: 44.5 }, depth: 52 },
    "3D": { id: "3D", seatPos: { x: 49.0, y: 50.5 }, approachPos: { x: 48.5, y: 46.0 }, depth: 54 },

    // Ряд 4
    "4C": { id: "4C", seatPos: { x: 55.5, y: 39.0 }, approachPos: { x: 55.5, y: 36.0 }, depth: 62 },
    "4D": { id: "4D", seatPos: { x: 59.5, y: 42.0 }, approachPos: { x: 57.5, y: 37.5 }, depth: 64 },

    // Ряд 5
    "5C": { id: "5C", seatPos: { x: 65.5, y: 30.5 }, approachPos: { x: 64.5, y: 27.5 }, depth: 72 },
    "5D": { id: "5D", seatPos: { x: 69.5, y: 33.5 }, approachPos: { x: 66.5, y: 29.0 }, depth: 74 },
  },
};

// ───────────────────────────── 2. ПЕРВЫЙ КЛАСС (annotated-pervyiklass.jpg) ─────────────────────────────
export const NAVMESH_FIRST_CLASS: CarNavMesh = {
  id: "first",
  name: "Первый класс (компоновка 1+2)",
  seatFacing: "left",
  doorWest: { x: 21.5, y: 71.3 },
  doorEast: { x: 88.2, y: 13.9 },
  aisleSpine: [
    { x: 21.5, y: 71.3 },
    { x: 34.5, y: 64.0 },
    { x: 44.0, y: 55.0 },
    { x: 54.0, y: 46.0 },
    { x: 63.5, y: 37.0 },
    { x: 73.0, y: 28.0 },
    { x: 81.5, y: 19.5 },
    { x: 88.2, y: 13.9 },
  ],
  seats: {
    "1A": { id: "1A", seatPos: { x: 21.2, y: 58.5 }, approachPos: { x: 28.5, y: 62.0 }, depth: 30 },
    "1B": { id: "1B", seatPos: { x: 35.8, y: 69.5 }, approachPos: { x: 34.5, y: 64.0 }, depth: 32 },
    "2A": { id: "2A", seatPos: { x: 41.5, y: 47.0 }, approachPos: { x: 44.0, y: 55.0 }, depth: 40 },
    "2B": { id: "2B", seatPos: { x: 46.2, y: 51.5 }, approachPos: { x: 45.0, y: 56.5 }, depth: 42 },
    "2C": { id: "2C", seatPos: { x: 50.8, y: 61.5 }, approachPos: { x: 47.5, y: 57.5 }, depth: 44 },
    "3A": { id: "3A", seatPos: { x: 53.8, y: 36.5 }, approachPos: { x: 54.0, y: 46.0 }, depth: 50 },
    "3B": { id: "3B", seatPos: { x: 58.2, y: 41.2 }, approachPos: { x: 55.0, y: 47.0 }, depth: 52 },
    "3C": { id: "3C", seatPos: { x: 69.8, y: 49.5 }, approachPos: { x: 61.5, y: 45.0 }, depth: 54 },
    "4A": { id: "4A", seatPos: { x: 67.5, y: 26.5 }, approachPos: { x: 63.5, y: 37.0 }, depth: 60 },
    "4B": { id: "4B", seatPos: { x: 77.2, y: 39.5 }, approachPos: { x: 72.0, y: 36.5 }, depth: 62 },
    "5A": { id: "5A", seatPos: { x: 77.0, y: 16.5 }, approachPos: { x: 75.0, y: 24.0 }, depth: 70 },
    "5B": { id: "5B", seatPos: { x: 84.5, y: 23.5 }, approachPos: { x: 81.5, y: 19.5 }, depth: 72 },
  },
  specialZones: {
    steamer: { name: "Отпариватель одежды", pos: { x: 87.0, y: 25.0 }, approachPos: { x: 84.0, y: 20.0 } },
  },
};

// ───────────────────────────── 3. КОМФОРТ-КЛАСС С ДЕТСКОЙ ЗОНОЙ (annotated-komfort.jpg) ─────────────────────────────
export const NAVMESH_COMFORT: CarNavMesh = {
  id: "comfort",
  name: "Комфорт-класс (с детской игровой комнатой)",
  seatFacing: "left",
  doorWest: { x: 21.5, y: 71.3 },
  doorEast: { x: 88.2, y: 13.9 },
  aisleSpine: [
    { x: 21.5, y: 71.3 },
    { x: 30.5, y: 64.0 },
    { x: 39.5, y: 57.0 },
    { x: 48.0, y: 48.5 },
    { x: 57.0, y: 40.0 },
    { x: 66.0, y: 31.5 },
    { x: 75.0, y: 23.0 },
    { x: 83.5, y: 16.5 },
    { x: 88.2, y: 13.9 },
  ],
  seats: {
    "1A": { id: "1A", seatPos: { x: 36.9, y: 67.9 }, approachPos: { x: 34.0, y: 61.5 }, depth: 35 },
    "1B": { id: "1B", seatPos: { x: 40.5, y: 68.5 }, approachPos: { x: 35.5, y: 62.5 }, depth: 37 },
    "2A": { id: "2A", seatPos: { x: 35.2, y: 50.8 }, approachPos: { x: 43.2, y: 57.5 }, depth: 42 },
    "2B": { id: "2B", seatPos: { x: 38.1, y: 53.7 }, approachPos: { x: 43.2, y: 57.8 }, depth: 44 },
    "2C": { id: "2C", seatPos: { x: 50.3, y: 58.1 }, approachPos: { x: 47.5, y: 55.0 }, depth: 46 },
    "2D": { id: "2D", seatPos: { x: 53.9, y: 60.3 }, approachPos: { x: 49.0, y: 56.5 }, depth: 48 },
    "3A": { id: "3A", seatPos: { x: 43.5, y: 44.6 }, approachPos: { x: 50.4, y: 52.6 }, depth: 52 },
    "3B": { id: "3B", seatPos: { x: 45.4, y: 48.0 }, approachPos: { x: 50.1, y: 52.3 }, depth: 54 },
    "3C": { id: "3C", seatPos: { x: 58.7, y: 50.4 }, approachPos: { x: 56.0, y: 47.0 }, depth: 56 },
    "3D": { id: "3D", seatPos: { x: 61.3, y: 53.6 }, approachPos: { x: 58.0, y: 48.5 }, depth: 58 },
    "4A": { id: "4A", seatPos: { x: 57.3, y: 34.8 }, approachPos: { x: 63.2, y: 42.2 }, depth: 62 },
    "4B": { id: "4B", seatPos: { x: 60.0, y: 38.2 }, approachPos: { x: 63.9, y: 41.9 }, depth: 64 },
    "4C": { id: "4C", seatPos: { x: 67.5, y: 44.2 }, approachPos: { x: 63.5, y: 42.2 }, depth: 66 },
    "4D": { id: "4D", seatPos: { x: 69.7, y: 47.7 }, approachPos: { x: 62.7, y: 42.6 }, depth: 68 },
    "5A": { id: "5A", seatPos: { x: 63.9, y: 30.2 }, approachPos: { x: 70.8, y: 36.5 }, depth: 72 },
    "5B": { id: "5B", seatPos: { x: 66.0, y: 33.5 }, approachPos: { x: 70.7, y: 36.7 }, depth: 74 },
    "5C": { id: "5C", seatPos: { x: 74.5, y: 38.3 }, approachPos: { x: 71.5, y: 36.6 }, depth: 76 },
    "5D": { id: "5D", seatPos: { x: 77.7, y: 41.3 }, approachPos: { x: 71.0, y: 36.9 }, depth: 78 },
    "6A": { id: "6A", seatPos: { x: 70.6, y: 25.9 }, approachPos: { x: 77.1, y: 32.3 }, depth: 80 },
    "6B": { id: "6A", seatPos: { x: 72.7, y: 28.2 }, approachPos: { x: 77.1, y: 32.3 }, depth: 82 },
    "6C": { id: "6A", seatPos: { x: 82.2, y: 32.1 }, approachPos: { x: 79.5, y: 29.8 }, depth: 84 },
    "6D": { id: "6A", seatPos: { x: 84.4, y: 35.3 }, approachPos: { x: 79.5, y: 29.8 }, depth: 86 },
    "7A": { id: "7A", seatPos: { x: 77.5, y: 20.3 }, approachPos: { x: 84.4, y: 26.1 }, depth: 88 },
    "7B": { id: "7A", seatPos: { x: 77.5, y: 20.3 }, approachPos: { x: 84.4, y: 26.1 }, depth: 90 },
    "7C": { id: "5C", seatPos: { x: 74.5, y: 38.3 }, approachPos: { x: 71.5, y: 36.6 }, depth: 76 },
  },
  specialZones: {
    kidsPlayroom: {
      name: "Детская игровая комната",
      pos: { x: 21.0, y: 64.0 },
      approachPos: { x: 26.5, y: 68.5 },
    },
  },
};

// ───────────────────────────── 4. ВАГОН-БИСТРО / СТАНДАРТ (annotated-standart.jpg) ─────────────────────────────
export const NAVMESH_BISTRO_STANDART: CarNavMesh = {
  id: "bistro_standart",
  name: "Вагон-бистро со столиками и барной стойкой",
  seatFacing: "right",
  doorWest: { x: 21.5, y: 71.3 },
  doorEast: { x: 88.2, y: 13.9 },
  aisleSpine: [
    { x: 21.5, y: 71.3 },
    { x: 28.5, y: 64.5 },
    { x: 37.0, y: 56.5 },
    { x: 45.5, y: 48.0 },
    { x: 54.0, y: 39.5 },
    { x: 62.5, y: 31.0 },
    { x: 71.0, y: 23.0 },
    { x: 79.0, y: 18.0 },
    { x: 88.2, y: 13.9 },
  ],
  seats: {
    "1_MGN": { id: "1_MGN", seatPos: { x: 21.2, y: 62.0 }, approachPos: { x: 26.5, y: 65.5 }, depth: 30 },
    "2A": { id: "2A", seatPos: { x: 34.5, y: 68.5 }, approachPos: { x: 34.0, y: 62.0 }, depth: 35 },
    "2B": { id: "2B", seatPos: { x: 38.5, y: 71.5 }, approachPos: { x: 35.5, y: 63.5 }, depth: 37 },
    "3A": { id: "3A", seatPos: { x: 35.5, y: 47.5 }, approachPos: { x: 39.5, y: 53.5 }, depth: 42 },
    "3B": { id: "3B", seatPos: { x: 39.8, y: 51.0 }, approachPos: { x: 42.0, y: 55.0 }, depth: 44 },
    "3C": { id: "3C", seatPos: { x: 47.0, y: 63.5 }, approachPos: { x: 44.5, y: 57.5 }, depth: 46 },
    "3D": { id: "3D", seatPos: { x: 50.8, y: 66.5 }, approachPos: { x: 46.5, y: 59.0 }, depth: 48 },
    "4A": { id: "4A", seatPos: { x: 44.0, y: 39.0 }, approachPos: { x: 48.0, y: 45.0 }, depth: 52 },
    "4B": { id: "4B", seatPos: { x: 48.5, y: 42.5 }, approachPos: { x: 50.5, y: 46.5 }, depth: 54 },
    "4C": { id: "4C", seatPos: { x: 55.5, y: 55.0 }, approachPos: { x: 53.0, y: 49.0 }, depth: 56 },
    "4D": { id: "4D", seatPos: { x: 59.2, y: 58.0 }, approachPos: { x: 55.0, y: 50.5 }, depth: 58 },
    "5A": { id: "5A", seatPos: { x: 52.5, y: 30.5 }, approachPos: { x: 56.5, y: 36.5 }, depth: 62 },
    "5B": { id: "5B", seatPos: { x: 57.0, y: 34.0 }, approachPos: { x: 59.0, y: 38.0 }, depth: 64 },
    "5C": { id: "5C", seatPos: { x: 64.0, y: 46.5 }, approachPos: { x: 61.5, y: 40.5 }, depth: 66 },
    "5D": { id: "5D", seatPos: { x: 67.8, y: 49.5 }, approachPos: { x: 63.5, y: 42.0 }, depth: 68 },
    "6A": { id: "6A", seatPos: { x: 66.5, y: 25.5 }, approachPos: { x: 68.0, y: 31.0 }, depth: 72 },
    "6B": { id: "6B", seatPos: { x: 72.8, y: 30.5 }, approachPos: { x: 70.5, y: 33.5 }, depth: 74 },
    "6C": { id: "6C", seatPos: { x: 75.0, y: 41.5 }, approachPos: { x: 73.0, y: 36.0 }, depth: 76 },
    "6D": { id: "6D", seatPos: { x: 80.5, y: 44.5 }, approachPos: { x: 75.0, y: 37.5 }, depth: 78 },
  },
  specialZones: {
    barCounter: {
      name: "Стойка вагона-бистро (витрина, кофемашина)",
      pos: { x: 86.5, y: 24.5 },
      approachPos: { x: 80.5, y: 21.0 },
    },
  },
};

// Единый справочник по ключу CarType из scenario.ts
export const TRAIN_NAVMESH_REGISTRY: Record<CarType, CarNavMesh> = {
  business: NAVMESH_BUSINESS,
  first: NAVMESH_FIRST_CLASS,
  comfort: NAVMESH_COMFORT,
  bistro: NAVMESH_BISTRO_STANDART,
  standard: NAVMESH_BISTRO_STANDART,
};
