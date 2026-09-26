import { buildCar, type Actor, type ScenarioData } from "../scenario";

export const ACCESSIBILITY_COMMUNICATION_SCENARIO_NAME = "Доступная коммуникация";

/** Синтетический кейс о выборе канала коммуникации, без новых нормативных утверждений. */
export function accessibilityCommunicationScenario(): ScenarioData {
  const car = buildCar(1, "comfort", 7);
  car.capabilities = { writtenCommunication: true, visualInformation: true };
  const hearing: Actor = { id: "hearing", name: "Пассажирка Власова", role: "passenger", accessibilityNeeds: ["hearing"], ticket: { carId: car.id, seat: "2A" }, spawn: { carId: car.id, x: 2, y: 0 }, mood: 75, steps: [] };
  const vision: Actor = { id: "vision", name: "Пассажир Миронов", role: "passenger", accessibilityNeeds: ["vision"], ticket: { carId: car.id, seat: "3C" }, spawn: { carId: car.id, x: 3, y: 3 }, mood: 75, steps: [] };
  return {
    version: 1,
    train: { name: "Учебный рейс: коммуникация", cars: [car] },
    actors: [{ id: "conductor", name: "Проводник", role: "conductor", ticket: null, spawn: { carId: car.id, x: 1, y: 2 }, mood: 100, steps: [] }, hearing, vision],
    durationSec: 100,
    initial: { loyalty: 70, safety: 70 },
    serviceEntitlements: { writtenCommunication: true, verbalOrientation: true },
    events: [
      { id: "hearing_message", title: "Сообщение для пассажирки с нарушением слуха", category: "request", actorId: hearing.id, trigger: { type: "time", atSec: 5 }, stage: "onboard", startNode: "h1", nodes: [
        { id: "h1", speaker: "Пассажирка Власова", text: "Я не расслышала изменение времени остановки.", timerSec: 15, options: [
          { id: "h1a", text: "Спросить, подходит ли письменное или визуальное сообщение", next: "h2", effects: { loyalty: 1, safety: 0 }, correct: true, set: { written_channel_requested: true }, timeCostSec: 3, feedback: "Канал выбран вместе с пассажиркой, а не заменён более громкой речью." },
          { id: "h1b", text: "Повторить объявление громче", next: null, effects: { loyalty: -5, safety: 0 }, feedback: "Усиление того же канала не гарантирует доступность информации." },
        ] },
        { id: "h2", speaker: "Пассажирка Власова", text: "Напишите, пожалуйста, время — так я смогу проверить его позже.", options: [
          { id: "h2a", text: "Написать время и показать его на экране", next: null, if: { all: [{ flag: "written_channel_requested" }, { resource: { type: "capability", carId: car.id, capability: "writtenCommunication" } }, { resource: { type: "serviceEntitlement", entitlement: "writtenCommunication" } }] }, effects: { loyalty: 5, safety: 0 }, correct: true, feedback: "Использован доступный письменный канал." },
        ] },
      ] },
      { id: "vision_orientation", title: "Ориентация для пассажира с нарушением зрения", category: "request", actorId: vision.id, trigger: { type: "time", atSec: 35 }, stage: "onboard", startNode: "v1", nodes: [
        { id: "v1", speaker: "Пассажир Миронов", text: "Подскажите, где выход в тамбур?", timerSec: 15, options: [
          { id: "v1a", text: "Уточнить, нужны ли словесные ориентиры или сопровождение", next: "v2", effects: { loyalty: 1, safety: 0 }, correct: true, set: { verbal_orientation_requested: true }, timeCostSec: 3, feedback: "Выбран формат ориентации, а не сделано предположение о нужной помощи." },
          { id: "v1b", text: "Указать рукой на дверь", next: null, effects: { loyalty: -6, safety: -2 }, feedback: "Жест не передаёт маршрут пассажиру, который не видит его." },
        ] },
        { id: "v2", speaker: "Пассажир Миронов", text: "Опишите маршрут по рядам, пожалуйста.", options: [
          { id: "v2a", text: "Описать маршрут по рядам и предложить проводить до двери", next: null, if: { all: [{ flag: "verbal_orientation_requested" }, { resource: { type: "serviceEntitlement", entitlement: "verbalOrientation" } }] }, effects: { loyalty: 5, safety: 2 }, correct: true, feedback: "Устное описание и предложение сопровождения отвечают другой потребности, чем письменное сообщение." },
        ] },
      ] },
    ],
  };
}
