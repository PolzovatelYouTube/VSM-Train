import { demoScenario } from "../shared/scenario";

/** Демо-сценарий, где все пассажирские вагоны — «стандарт» (множители терпения = 1), чтобы проверять чистые числа */
export function standardDemo() {
  const data = demoScenario();
  for (const c of data.train.cars) if (c.type !== "bistro") c.type = "standard";
  return data;
}
