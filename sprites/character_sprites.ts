/**
 * Реестр спрайтов персонажей для изометрического тренажера.
 * Сопоставляет роль из scenario.ts (ActorRole) и текущее состояние (stand, walk, sit, wheelchair)
 * с конкретным PNG-файлом.
 */

import { ActorRole } from "./scenario";

export type CharacterAction = "stand" | "walk" | "sit" | "wheelchair" | "talk";

export interface SpriteFrame {
  src: string;          // Путь к прозрачному PNG в папке public/sprites/
  width: number;        // Базовая ширина спрайта (px)
  height: number;       // Базовая высота спрайта (px)
  // Точка привязки (Anchor point):
  // Для стоящего человека это ступни (50% по x, 95% по y)
  // Для сидящего в кресле — таз (50% по x, 80% по y)
  anchorX: number;
  anchorY: number;
  scale: number;        // Масштаб для выравнивания пропорций в изометрии
}

export type RoleSprites = Partial<Record<CharacterAction, SpriteFrame>>;

export const CHARACTER_SPRITES: Record<ActorRole | "prm" | "troublemaker", RoleSprites> = {
  // 1. Проводник ВСМ
  conductor: {
    stand: { src: "/sprites/conductor_stand.png", width: 64, height: 120, anchorX: 0.5, anchorY: 0.95, scale: 1.0 },
    walk: { src: "/sprites/conductor_walk.png", width: 64, height: 120, anchorX: 0.5, anchorY: 0.95, scale: 1.0 },
    sit: { src: "/sprites/conductor_sit.png", width: 64, height: 100, anchorX: 0.5, anchorY: 0.82, scale: 0.95 },
    talk: { src: "/sprites/conductor_talk.png", width: 64, height: 120, anchorX: 0.5, anchorY: 0.95, scale: 1.0 },
  },

  // 2. Обычный пассажир
  passenger: {
    stand: { src: "/sprites/passenger_stand.png", width: 64, height: 120, anchorX: 0.5, anchorY: 0.95, scale: 1.0 },
    walk: { src: "/sprites/passenger_walk.png", width: 64, height: 120, anchorX: 0.5, anchorY: 0.95, scale: 1.0 },
    sit: { src: "/sprites/passenger_sit.png", width: 64, height: 98, anchorX: 0.5, anchorY: 0.80, scale: 0.92 },
  },

  // 3. Пожилой пассажир
  elderly: {
    stand: { src: "/sprites/elderly_stand.png", width: 60, height: 115, anchorX: 0.5, anchorY: 0.95, scale: 0.96 },
    walk: { src: "/sprites/elderly_walk.png", width: 60, height: 115, anchorX: 0.5, anchorY: 0.95, scale: 0.96 },
    sit: { src: "/sprites/elderly_sit.png", width: 60, height: 95, anchorX: 0.5, anchorY: 0.80, scale: 0.90 },
  },

  // 4. Ребенок (меньше по росту)
  child: {
    stand: { src: "/sprites/child_stand.png", width: 50, height: 85, anchorX: 0.5, anchorY: 0.95, scale: 0.75 },
    walk: { src: "/sprites/child_walk.png", width: 50, height: 85, anchorX: 0.5, anchorY: 0.95, scale: 0.75 },
    sit: { src: "/sprites/child_sit.png", width: 50, height: 75, anchorX: 0.5, anchorY: 0.78, scale: 0.72 },
  },

  // 5. VIP-пассажир
  vip: {
    stand: { src: "/sprites/vip_stand.png", width: 64, height: 122, anchorX: 0.5, anchorY: 0.95, scale: 1.0 },
    walk: { src: "/sprites/vip_walk.png", width: 64, height: 122, anchorX: 0.5, anchorY: 0.95, scale: 1.0 },
    sit: { src: "/sprites/vip_sit.png", width: 64, height: 100, anchorX: 0.5, anchorY: 0.82, scale: 0.95 },
  },

  // 6. Конфликтный пассажир
  troublemaker: {
    stand: { src: "/sprites/troublemaker_stand.png", width: 66, height: 122, anchorX: 0.5, anchorY: 0.95, scale: 1.02 },
    walk: { src: "/sprites/troublemaker_walk.png", width: 66, height: 122, anchorX: 0.5, anchorY: 0.95, scale: 1.02 },
    sit: { src: "/sprites/troublemaker_sit.png", width: 66, height: 100, anchorX: 0.5, anchorY: 0.80, scale: 0.94 },
  },

  // 7. Маломобильный пассажир (МГН / Инвалидная коляска)
  prm: {
    wheelchair: { src: "/sprites/prm_wheelchair.png", width: 75, height: 105, anchorX: 0.5, anchorY: 0.90, scale: 0.95 },
    sit: { src: "/sprites/prm_sit.png", width: 64, height: 98, anchorX: 0.5, anchorY: 0.80, scale: 0.92 },
    stand: { src: "/sprites/prm_wheelchair.png", width: 75, height: 105, anchorX: 0.5, anchorY: 0.90, scale: 0.95 },
  },
};
