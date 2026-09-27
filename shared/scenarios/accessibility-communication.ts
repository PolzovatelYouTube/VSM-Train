import { buildCar, type Actor, type ScenarioData } from "../scenario";

export const ACCESSIBILITY_COMMUNICATION_SCENARIO_NAME = "Доступная коммуникация";

/** Синтетический кейс о выборе канала коммуникации, без новых нормативных утверждений. */
export function accessibilityCommunicationScenario(): ScenarioData {
  const car = buildCar(1, "comfort", 7);
  car.capabilities = { writtenCommunication: true, visualInformation: true };
  const hearing: Actor = { id: "hearing", name: "Пассажирка Власова", role: "passenger", accessibilityNeeds: ["hearing"], ticket: { carId: car.id, seat: "2A" }, spawn: { carId: car.id, x: 2, y: 0 }, mood: 75, steps: [] };
  const vision: Actor = { id: "vision", name: "Пассажир Миронов", role: "passenger", accessibilityNeeds: ["vision"], ticket: { carId: car.id, seat: "3C" }, spawn: { carId: car.id, x: 3, y: 3 }, mood: 75, steps: [] };
  const companion: Actor = {
    id: "vision_companion",
    name: "Спутница Миронова",
    role: "passenger",
    ticket: { carId: car.id, seat: "3D" },
    spawn: { carId: car.id, x: 3, y: 4 },
    mood: 75,
    steps: [],
  };
  const unconfirmedRequester: Actor = {
    id: "unconfirmed_support_requester",
    name: "Пассажир Кузнецов",
    role: "passenger",
    ticket: { carId: car.id, seat: "4A" },
    spawn: { carId: car.id, x: 4, y: 0 },
    mood: 70,
    steps: [],
  };
  return {
    version: 1,
    train: { name: "Учебный рейс: коммуникация", cars: [car] },
    actors: [{ id: "conductor", name: "Проводник", role: "conductor", ticket: null, spawn: { carId: car.id, x: 1, y: 2 }, mood: 100, steps: [] }, hearing, vision, companion, unconfirmedRequester],
    durationSec: 100,
    initial: { loyalty: 70, safety: 70 },
    serviceEntitlements: { writtenCommunication: true, verbalOrientation: true },
    gameplay: "concurrent",
    events: [
      {
        id: "boarding_manifest_check",
        title: "Сверка с посадочной ведомостью",
        category: "request",
        actorId: hearing.id,
        trigger: { type: "time", atSec: 2 },
        stage: "boarding",
        startNode: "b1",
        nodes: [
          {
            id: "b1",
            speaker: "Посадочная ведомость",
            text: "В ведомости отмечена заранее заявленная потребность пассажирки Власовой в доступном канале коммуникации.",
            timerSec: 12,
            options: [
              { id: "b1a", text: "Инициативно обратиться к пассажирке и спросить, как ей удобнее получать информацию", next: "b2", effects: { loyalty: 2, safety: 1 }, correct: true, set: { proactive_needs_confirmed: true }, feedback: "Потребность учтена до отправления, а предпочтительный формат уточнён у самой пассажирки." },
              { id: "b1b", text: "Не уточнять предпочтения и ждать отдельного обращения в пути", next: null, effects: { loyalty: -3, safety: 0 }, feedback: "Заранее известная потребность требует подготовленного, но ненавязчивого контакта до отправления." },
            ],
          },
          {
            id: "b2",
            speaker: "Пассажирка Власова",
            text: "Спасибо. Сейчас помощь не нужна; если потребуется, напишу через кнопку вызова.",
            options: [
              { id: "b2a", text: "Подтвердить отказ от сопровождения на сейчас и напомнить доступный способ связи", next: null, effects: { loyalty: 2, safety: 1 }, correct: true, set: { boarding_support_declined: true }, feedback: "Отказ от конкретной услуги принят уважительно; пассажирке оставлен понятный способ обратиться позднее." },
              { id: "b2b", text: "Потребовать подтверждающий документ, иначе не оказывать никакой помощи", next: null, effects: { loyalty: -8, safety: -3 }, feedback: "В этом учебном кейсе нельзя подменять уточнение потребности ультиматумом. Порядок проверки документов задаётся перевозчиком и требует отдельной подтверждённой процедуры." },
            ],
          },
        ],
      },
      { id: "hearing_message", title: "Сообщение для пассажирки с нарушением слуха", category: "request", actorId: hearing.id, trigger: { type: "time", atSec: 5 }, stage: "onboard", startNode: "h1", nodes: [
        { id: "h1", speaker: "Пассажирка Власова", text: "Я не расслышала изменение времени остановки.", timerSec: 15, options: [
          { id: "h1a", text: "Спросить, подходит ли письменное или визуальное сообщение", next: "h2", effects: { loyalty: 1, safety: 0 }, correct: true, set: { written_channel_requested: true }, timeCostSec: 3, feedback: "Канал выбран вместе с пассажиркой, а не заменён более громкой речью." },
          { id: "h1b", text: "Повторить объявление громче", next: null, effects: { loyalty: -5, safety: 0 }, feedback: "Усиление того же канала не гарантирует доступность информации." },
        ] },
        { id: "h2", speaker: "Пассажирка Власова", text: "Напишите, пожалуйста, время — так я смогу проверить его позже.", options: [
          { id: "h2a", text: "Написать время и показать его на экране", next: "h3", if: { all: [{ flag: "written_channel_requested" }, { resource: { type: "capability", carId: car.id, capability: "writtenCommunication" } }, { resource: { type: "serviceEntitlement", entitlement: "writtenCommunication" } }] }, effects: { loyalty: 5, safety: 0 }, correct: true, feedback: "Использован доступный письменный канал." },
        ] },
        { id: "h3", speaker: "Пассажирка Власова", text: "(Кивает, прочитав сообщение.)", options: [
          { id: "h3a", text: "Уточнить, всё ли понятно, прежде чем вернуться к обязанностям", next: null, effects: { loyalty: 2, safety: 0 }, correct: true, set: { written_message_understood: true }, feedback: "Информация не считается переданной, пока проводник не убедился, что пассажирка её поняла." },
        ] },
      ] },
      {
        id: "unconfirmed_support_request",
        title: "Запрос на сопровождение без подтверждения",
        category: "request",
        actorId: unconfirmedRequester.id,
        trigger: { type: "time", atSec: 25 },
        stage: "boarding",
        startNode: "u1",
        nodes: [
          {
            id: "u1",
            speaker: "Пассажир Кузнецов",
            text: "Мне нужно специальное сопровождение. В ведомости заявки нет, очевидных оснований для услуги не видно, а подтверждение статуса я предоставлять отказываюсь.",
            timerSec: 12,
            options: [
              { id: "u1a", text: "Вежливо объяснить порядок подтверждения, зафиксировать отказ и предложить обычную помощь в пределах полномочий", next: null, effects: { loyalty: 0, safety: 2 }, correct: true, set: { status_confirmation_declined: true, formal_support_not_confirmed: true }, feedback: "В пограничном кейсе проводник действует по установленному перевозчиком порядку: не оформляет неподтверждённую специальную услугу, но не оставляет пассажира без доступной общей помощи." },
              { id: "u1b", text: "Отказать резко и прекратить разговор", next: null, effects: { loyalty: -7, safety: -1 }, feedback: "Даже когда специальная услуга не может быть оформлена, отказ должен быть объяснён спокойно и с предложением допустимой альтернативы." },
              { id: "u1c", text: "Пообещать специальное сопровождение без проверки порядка и ресурсов", next: null, effects: { loyalty: -2, safety: -4 }, feedback: "Нельзя обещать услугу, если её основания и доступность не подтверждены по установленной процедуре." },
            ],
          },
        ],
      },
      { id: "vision_orientation", title: "Ориентация для пассажира с нарушением зрения", category: "request", actorId: vision.id, trigger: { type: "time", atSec: 35 }, stage: "onboard", startNode: "v1", nodes: [
        { id: "v1", speaker: "Пассажир Миронов", text: "Подскажите, где выход в тамбур?", timerSec: 15, options: [
          { id: "v1a", text: "Уточнить, нужны ли словесные ориентиры или сопровождение", next: "v2", effects: { loyalty: 1, safety: 0 }, correct: true, set: { verbal_orientation_requested: true }, timeCostSec: 3, feedback: "Выбран формат ориентации, а не сделано предположение о нужной помощи." },
          { id: "v1b", text: "Указать рукой на дверь", next: null, effects: { loyalty: -6, safety: -2 }, feedback: "Жест не передаёт маршрут пассажиру, который не видит его." },
          { id: "v1c", text: "Спросить у спутницы, как нужно помочь Миронову", next: null, effects: { loyalty: -5, safety: 0 }, feedback: "Предпочтения уточняют у самого пассажира; спутник не заменяет его в разговоре." },
        ] },
        { id: "v2", speaker: "Пассажир Миронов", text: "Опишите маршрут по рядам, пожалуйста.", options: [
          { id: "v2a", text: "Описать маршрут по рядам и разово проводить до двери тамбура", next: "v3", if: { all: [{ flag: "verbal_orientation_requested" }, { resource: { type: "serviceEntitlement", entitlement: "verbalOrientation" } }] }, effects: { loyalty: 5, safety: 2 }, correct: true, set: { one_time_escort_started: true }, feedback: "Устное описание и разовое сопровождение отвечают другой потребности, чем письменное сообщение." },
        ] },
        { id: "v3", speaker: "Пассажир Миронов", text: "Мы у двери тамбура. Дальше я продолжу сам.", options: [
          { id: "v3a", text: "Убедиться, что маршрут понятен, напомнить кнопку вызова и вернуться к обязанностям", next: null, effects: { loyalty: 2, safety: 1 }, correct: true, set: { one_time_escort_completed: true, verbal_orientation_understood: true }, feedback: "Сопровождение завершено у согласованной точки: проводник не остаётся рядом постоянно, но сохраняет доступный способ связи." },
        ] },
      ] },
      {
        id: "stop_announcement",
        title: "Подготовка к короткой остановке",
        category: "request",
        actorId: null,
        trigger: { type: "time", atSec: 42 },
        stage: "onboard",
        urgency: "urgent",
        severity: 4,
        responseWindowSec: 8,
        startNode: "s1",
        nodes: [
          {
            id: "s1",
            speaker: "Служебное объявление",
            text: "До короткой остановки две минуты. Необходимо проверить готовность зоны тамбура и пассажиров к высадке.",
            timerSec: 8,
            options: [
              { id: "s1a", text: "Доложить о завершении сопровождения, подготовить тамбур и согласовать дальнейшую помощь на остановке", next: null, effects: { loyalty: 1, safety: 4 }, correct: true, set: { short_stop_prepared: true }, feedback: "Срочная подготовка к остановке требует приоритета; незавершённую коммуникацию нужно корректно закрыть и передать дальше." },
              { id: "s1b", text: "Продолжить обычный разговор, не учитывая объявление", next: null, effects: { loyalty: -2, safety: -6 }, feedback: "На короткой стоянке промедление с подготовкой зоны высадки создаёт риск для всех пассажиров." },
            ],
          },
        ],
      },
    ],
  };
}
