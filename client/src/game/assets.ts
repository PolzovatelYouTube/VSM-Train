/**
 * Реестр игровых ассетов: компоненты обращаются к ключам, а не к путям.
 * Все файлы лежат локально в client/public/game-assets (происхождение — в README там же).
 * Если файл не загрузился, под ним всегда есть CSS-градиент/цвет — сцена не ломается.
 */
import type { CarType, Landscape } from "@shared/scenario";
import type { CharacterState, SpritePreset } from "@shared/visual";
import type { Facing } from "@shared/engine";

const BASE = `${import.meta.env.BASE_URL}game-assets/`;

/** Растровые спрайты состава для компактного навигатора; CSS-карточки остаются fallback. */
export const TRAIN_ASSETS = {
  tail: `${BASE}train/train-tail.png`,
  car: `${BASE}train/train-car.png`,
  head: `${BASE}train/train-head.png`,
} as const;

/** Состав для декоративной шапки главной страницы. */
export const HOME_HERO_TRAIN_ASSET = `${BASE}train/home-hero-transparent.png`;

export const CAR_SCENE_SIZE = { width: 1448, height: 1086 } as const;

/** Изометрические подложки классов. Бистро использует ту же геометрию, что и standard. */
export const CAR_SCENE_ASSETS: Record<CarType, string> = {
  first: `${BASE}interiors/first-cutout.png`,
  business: `${BASE}interiors/business-cutout.png`,
  comfort: `${BASE}interiors/comfort-cutout.png`,
  standard: `${BASE}interiors/standard-cutout.png`,
  bistro: `${BASE}interiors/standard-cutout.png`,
};

export interface CharacterImageFrame {
  src: string;
  anchorX: number;
  anchorY: number;
  /** Высота относительно высоты подложки вагона. */
  heightRatio: number;
  nativeFacing: Facing;
}

const characterFrame = (file: string, anchorY: number, heightRatio: number, nativeFacing: Facing = "right",): CharacterImageFrame => ({
  src: `${BASE}characters/${file}`,
  anchorX: 0.5,
  anchorY,
  heightRatio,
  nativeFacing,
});

const CHARACTER_IMAGE_FRAMES = {
  child: {
    stand: characterFrame("child_boy_stand.png", 0.5, 0.2),
    sit: characterFrame("child_boy_sit.png", 0.5, 0.15),
  },
  elderly: {
    stand: characterFrame("elderly_woman_stand.png", 0.5, 0.2),
    sit: characterFrame("elderly_woman_sit.png", 0.5, 0.15),
  },
  passenger: {
    stand: characterFrame("passenger_male_stand.png", 0.5, 0.2),
    sit: characterFrame("passenger_male_sit.png", 0.5, 0.15),
  },
  vip: {
    stand: characterFrame("vip_businessman_walk.png", 0.5, 0.2),
    sit: characterFrame("vip_businessman_sit.png", 0.5, 0.15),
  },
  bartender: {
    stand: characterFrame("bartender.png", 0.5, 0.2),
    sit: characterFrame("bartender.png", 0.5, 0.2),
  },
  wheelchair: {
    stand: characterFrame("prm_passenger_wheelchair.png", 0.5, 0.2),
    sit: characterFrame("prm_passenger_sit.png", 0.5, 0.15),
  },
} as const;

/** PNG-поза, если для персонажа она есть; undefined означает SVG-fallback. */
export function characterImageFrame(
  preset: SpritePreset,
  state: CharacterState,
  seated: boolean,
  usesWheelchair: boolean,
): CharacterImageFrame | undefined {
  const pose = seated || state === "sit" ? "sit" : "stand";
  if (usesWheelchair) return CHARACTER_IMAGE_FRAMES.wheelchair[pose];
  if (preset === "child") return CHARACTER_IMAGE_FRAMES.child[pose];
  if (preset === "elderly-f" || preset === "elderly-m") return CHARACTER_IMAGE_FRAMES.elderly[pose];
  if (preset === "vip") return CHARACTER_IMAGE_FRAMES.vip[pose];
  if (preset === "bartender") return CHARACTER_IMAGE_FRAMES.bartender[pose];
  if (preset === "passenger-f" || preset === "passenger-m") {
    return pose === "sit"
      ? CHARACTER_IMAGE_FRAMES.passenger.sit
      : CHARACTER_IMAGE_FRAMES.passenger.stand ?? CHARACTER_IMAGE_FRAMES.passenger.sit;
  }
  return undefined;
}

export interface LandscapeAsset {
  far: string;
  near: string;
  /** Небо — CSS, отдельного файла нет */
  sky: string;
  /** Fallback-цвета слоёв, если SVG не загрузился */
  farColor: string;
  nearColor: string;
  /** Тон освещения салона поверх интерьера */
  tint: string;
}

export const LANDSCAPE_ASSETS: Record<Landscape, LandscapeAsset> = {
  day: {
    far: `${BASE}landscape/day-far.svg`,
    near: `${BASE}landscape/day-near.svg`,
    sky: "linear-gradient(#8ecdf2, #dff1fb 70%)",
    farColor: "#8fbb99",
    nearColor: "#3b6f4c",
    tint: "transparent",
  },
  sunset: {
    far: `${BASE}landscape/sunset-far.svg`,
    near: `${BASE}landscape/sunset-near.svg`,
    sky: "linear-gradient(#5c4a78, #e9806a 55%, #f9c27b)",
    farColor: "#a8727f",
    nearColor: "#3e2a3f",
    tint: "rgba(255, 150, 90, 0.10)",
  },
  night: {
    far: `${BASE}landscape/night-far.svg`,
    near: `${BASE}landscape/night-near.svg`,
    sky: "radial-gradient(1px 1px at 20% 30%, #fff8, transparent), radial-gradient(1px 1px at 70% 20%, #fff8, transparent), linear-gradient(#050b1f, #1a2850)",
    farColor: "#1b2a4b",
    nearColor: "#0a1226",
    tint: "rgba(20, 30, 70, 0.22)",
  },
};

/** Палитра интерьера. Векторный интерьер рисуется компонентом TrainInterior из этих цветов. */
export interface InteriorPreset {
  label: string;
  ceiling: string;
  wall: string;
  panel: string;
  seat: string;
  seatShade: string;
  floor: string;
  carpet: string;
  accent: string;
  /** Необязательный растровый фон салона (локальный путь). Нет — только вектор. */
  image?: string;
}

export const INTERIOR_PRESETS: Record<string, InteriorPreset> = {
  "class-first": { label: "Первый класс", ceiling: "#f4efe7", wall: "#ece4d6", panel: "#d9cbb4", seat: "#cdb89a", seatShade: "#a8906f", floor: "#6b5a4a", carpet: "#7d6955", accent: "#b08d57" },
  "class-business": { label: "Бизнес", ceiling: "#f3f1ec", wall: "#e7e3da", panel: "#cfc7b8", seat: "#bfae95", seatShade: "#998871", floor: "#5f5a55", carpet: "#6f6860", accent: "#b08d57" },
  "class-comfort": { label: "Комфорт", ceiling: "#f5f6f8", wall: "#e8ebef", panel: "#cfd5dd", seat: "#d9cfc0", seatShade: "#b3a692", floor: "#5a6068", carpet: "#6a7079", accent: "#e21a1a" },
  "class-standard": { label: "Стандарт", ceiling: "#f5f6f8", wall: "#e6e9ee", panel: "#cdd3db", seat: "#b8584a", seatShade: "#8f4237", floor: "#545a62", carpet: "#646a73", accent: "#e21a1a" },
  "class-bistro": { label: "Бистро", ceiling: "#f1ede8", wall: "#e3ddd5", panel: "#c9bba8", seat: "#8a6f58", seatShade: "#6b5443", floor: "#4d4540", carpet: "#5c534d", accent: "#e21a1a" },
};

export const DEFAULT_INTERIOR = "class-comfort";

export function interiorPreset(key: string | undefined): InteriorPreset {
  return (key && INTERIOR_PRESETS[key]) || INTERIOR_PRESETS[DEFAULT_INTERIOR];
}

export interface SeatOcclusionPreset {
  halfWidthPct: number;
  topOffsetPct: number;
  heightPct: number;
}

export const SEAT_OCCLUSION: Record<CarType, SeatOcclusionPreset> = {
  first:    { halfWidthPct: 3.0, topOffsetPct: 3.0, heightPct: 4 },
  business: { halfWidthPct: 3.0, topOffsetPct: 3.0, heightPct: 4 },
  comfort:  { halfWidthPct: 3.4, topOffsetPct: 3.0, heightPct: 4 },
  standard: { halfWidthPct: 3.4, topOffsetPct: 3.0, heightPct: 4 },
  bistro:   { halfWidthPct: 3.4, topOffsetPct: 3.0, heightPct: 4 },
};

/** Внешность пресетов спрайтов. Неизвестный пресет → FALLBACK_SPRITE (нейтральный силуэт). */
export interface SpriteStyle {
  skin: string;
  hair: string;
  hairStyle: "short" | "long" | "bun" | "cap" | "bald" | "kid";
  top: string;
  bottom: string;
  shoes: string;
  extra?: "conductor" | "tie" | "glasses" | "hood";
  scale?: number;
}

export const SPRITE_STYLES: Record<SpritePreset, SpriteStyle> = {
  conductor: { skin: "#f1c9a5", hair: "#3b2a20", hairStyle: "cap", top: "#1f3a68", bottom: "#1a2b4a", shoes: "#111827", extra: "conductor" },
  "passenger-f": { skin: "#f3cfb0", hair: "#6b3f24", hairStyle: "long", top: "#3aa3a0", bottom: "#374151", shoes: "#4b5563" },
  "passenger-m": { skin: "#e8b98f", hair: "#2d2118", hairStyle: "short", top: "#5b7bb5", bottom: "#3f3f46", shoes: "#27272a" },
  "elderly-f": { skin: "#f0cdb4", hair: "#d1d5db", hairStyle: "bun", top: "#9b6b8e", bottom: "#4b5563", shoes: "#57534e", extra: "glasses" },
  "elderly-m": { skin: "#e7bf9f", hair: "#e5e7eb", hairStyle: "bald", top: "#7c8b6e", bottom: "#44403c", shoes: "#3f3a36", extra: "glasses" },
  child: { skin: "#f6d3b5", hair: "#b7791f", hairStyle: "kid", top: "#f59e0b", bottom: "#2563eb", shoes: "#dc2626", scale: 0.66 },
  vip: { skin: "#eac29f", hair: "#1f1a17", hairStyle: "short", top: "#262a33", bottom: "#1f2229", shoes: "#0b0b0c", extra: "tie" },
  bartender: { skin: "#e8b98f", hair: "#2d2118", hairStyle: "short", top: "#1f3a68", bottom: "#1a2b4a", shoes: "#111827", extra: "tie" },
  troublemaker: { skin: "#e3b48c", hair: "#2a1f1a", hairStyle: "short", top: "#c2412d", bottom: "#2f3a4a", shoes: "#1f2937", extra: "hood" },
};

export const FALLBACK_SPRITE: SpriteStyle = { skin: "#cbd5e1", hair: "#94a3b8", hairStyle: "short", top: "#94a3b8", bottom: "#64748b", shoes: "#475569" };

export const spriteStyle = (preset: string): SpriteStyle => SPRITE_STYLES[preset as SpritePreset] ?? FALLBACK_SPRITE;

/** Все файлы, которые нужны сцене с данным пейзажем (≈20 КБ на тему) */
export const sceneAssetUrls = (landscape: Landscape): string[] => {
  const l = LANDSCAPE_ASSETS[landscape];
  return [l.far, l.near];
};

/**
 * Предзагрузка ассетов перед стартом смены. Ошибка загрузки не прерывает игру —
 * промис всегда резолвится, onProgress получает долю 0..1.
 */
export function preloadAssets(urls: string[], onProgress?: (share: number) => void): Promise<{ failed: string[] }> {
  if (!urls.length || typeof Image === "undefined") return Promise.resolve({ failed: [] });
  let done = 0;
  const failed: string[] = [];
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          const finish = (ok: boolean) => {
            if (!ok) failed.push(url);
            done++;
            onProgress?.(done / urls.length);
            resolve();
          };
          img.onload = () => finish(true);
          img.onerror = () => finish(false);
          img.src = url;
        }),
    ),
  ).then(() => ({ failed }));
}
