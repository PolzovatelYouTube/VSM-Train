import { useMemo } from "react";
import type { ScenarioData } from "@shared/scenario";
import { createSim } from "@shared/engine";
import { projectGameScene } from "@shared/visual";
import { GameStage } from "./GameStage";

/**
 * Статичный предпросмотр сцены для редактора: вагон проводника в момент t=0.
 * Грузится лениво (React.lazy), чтобы код сцены не попадал в основной чанк редактора.
 */
export default function ScenePreview({ data, carId }: { data: ScenarioData; carId?: string }) {
  const model = useMemo(() => projectGameScene(data, createSim(data), { viewCarId: carId, follow: false }), [data, carId]);
  const car = data.train.cars.find((c) => c.id === model.carId) ?? data.train.cars[0];
  if (!car) return null;
  return <GameStage model={model} car={car} className="h-48 w-full" static />;
}
