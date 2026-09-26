import { memo } from "react";
import type { Landscape } from "@shared/scenario";
import { LANDSCAPE_ASSETS } from "./assets";

/**
 * Пейзаж за окнами: небо + два зацикленных слоя с разной скоростью (параллакс).
 * Скорость — чистый CSS и не связана со скоростью симуляции. Компонент мемоизирован:
 * покадровый рендер сцены его не трогает. Если SVG не загрузился, виден fallback-цвет слоя.
 */
export const WindowLandscape = memo(function WindowLandscape({
  landscape,
  top,
  height,
}: {
  landscape: Landscape;
  top: number;
  height: number;
}) {
  const a = LANDSCAPE_ASSETS[landscape];
  return (
    <div className="absolute inset-0 overflow-clip" style={{ background: a.sky }} aria-hidden>
      <div className="g-landscape absolute inset-x-0" style={{ top, height }}>
        <div
          className="g-par g-par-far"
          style={{ backgroundImage: `url("${a.far}"), linear-gradient(transparent 55%, ${a.farColor} 55%)`, backgroundSize: "auto 100%, 100% 100%" }}
        />
        <div className="g-par g-par-near" style={{ backgroundImage: `url("${a.near}")` }} />
      </div>
    </div>
  );
});
