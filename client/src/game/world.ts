/** Координаты «мира» сцены: вид сбоку поперёк вагона. Единицы — условные пиксели до масштабирования камерой. */
export const COL = 130; // ширина одной колонки клеток вдоль вагона
export const WORLD_H = 400; // высота сцены
export const FLOOR_FAR = 300; // линия пола у дальнего борта
export const WIN_TOP = 78;
export const WIN_BOTTOM = 205;
export const SPRITE_H = 250; // высота спрайта при масштабе 1

export const worldWidth = (carLength: number) => carLength * COL;
/** Позиция персонажа в мире по данным проектора (x 0..1 вдоль вагона, depth 0..1 поперёк) */
export function actorWorldPos(x: number, depth: number, carLength: number) {
  const wx = x * (carLength - 1) * COL + COL / 2;
  const baseline = FLOOR_FAR + 8 + depth * 84;
  const scale = 0.78 + depth * 0.3;
  return { wx, baseline, scale };
}
