import { buildCar, type ScenarioData, type GameEvent } from "../scenario";

export const MULTI_INCIDENT_SCENARIO_NAME = "Кому помочь первым: три одновременные ситуации";

/** Синтетический тренажёр приоритетов, не медицинская или техническая инструкция. */
export function multiIncidentScenario(): ScenarioData {
  const cars = [1, 2, 3, 4].map((number) => buildCar(number, "standard", 8));
  const events: GameEvent[] = [
    {
      id: "socket", title: "Не работает розетка", category: "technical", actorId: "socket-passenger",
      trigger: { type: "time", atSec: 10 }, urgency: "routine", responseWindowSec: 30,
      location: { carId: cars[0].id, x: 4, y: 0 },
      escalation: { afterSec: 30, effects: { loyalty: -3, safety: 0 }, set: { "socket.waited": true },
        text: "Пассажир снова просит помочь с розеткой; телефон почти разрядился." },
      startNode: "socket-start", nodes: [
        { id: "socket-start", kind: "decision", speaker: "Пассажир", text: "Телефон разряжается, а розетка не работает. Можете разобраться?",
          options: [
            { id: "socket-inspect", text: "Проверить доступное питание и предложить подходящее место", timeCostSec: 20, next: "socket-result", effects: { loyalty: 5, safety: 0 }, correct: true,
              feedback: "Помощь оказана лично, но проверка заняла 20 секунд. Другие обращения развивались в это время." },
            { id: "socket-delegate", text: "Передать проверку коллеге и согласовать с пассажиром ожидание", timeCostSec: 3, next: "socket-result", effects: { loyalty: 1, safety: 0 }, correct: true,
              feedback: "Обращение передано коллеге. Проверка ещё не завершена, зато Вы можете заняться другими пассажирами." },
          ] },
        { id: "socket-result", kind: "information", speaker: "Обстановка", text: "Пассажир знает согласованный порядок помощи. Обращение передано в работу.", next: null, options: [] },
      ],
    },
    {
      id: "seat-dispute", title: "Спор за место", category: "conflict", actorId: "seat-passenger",
      trigger: { type: "time", atSec: 18 }, urgency: "urgent", responseWindowSec: 20,
      location: { carId: cars[3].id, x: 4, y: 0 },
      escalation: { afterSec: 22, effects: { loyalty: -6, safety: -3 }, set: { "seat_dispute.louder": true },
        text: "Спор стал громче, багаж мешает проходу." },
      startNode: "dispute-start", nodes: [
        { id: "dispute-start", kind: "decision", speaker: "Два пассажира", text: "Оба претендуют на одно место. Они спорят, но пока остаются у кресел.", options: [
          { id: "dispute-check", text: "Выслушать обоих и сверить билеты", timeCostSec: 8, next: null, effects: { loyalty: 4, safety: 2 }, correct: true,
            feedback: "Основания проверены лично. На разговор ушло восемь секунд." },
          { id: "dispute-colleague", text: "Попросить коллегу сверить билеты, самому освободить проход", timeCostSec: 3, next: null, effects: { loyalty: 1, safety: 4 }, correct: true,
            feedback: "Риск в проходе снижен быстрее, но пассажиры ждут результата проверки коллегой." },
        ] },
      ],
    },
    {
      id: "breathing", title: "Пассажиру трудно дышать", category: "medical", actorId: "medical-passenger",
      trigger: { type: "time", atSec: 23 }, urgency: "critical", responseWindowSec: 12,
      location: { carId: cars[1].id, x: 4, y: 0 },
      escalation: { afterSec: 12, nextEvent: "medical-worse", effects: { loyalty: -4, safety: -18 }, set: { "medical.worse": true },
        text: "Пассажир побледнел и осел в кресле. Нужна помощь начальника поезда и медработника." },
      startNode: "breathing-start", nodes: [
        { id: "breathing-start", kind: "decision", speaker: "Пассажир", text: "Мне трудно дышать. Не могу закончить фразу.", options: [
          { id: "medical-stay", text: "Остаться рядом и попросить коллегу вызвать начальника поезда и медработника", timeCostSec: 3, next: null, effects: { loyalty: 2, safety: 8 }, correct: true,
            feedback: "Помощь организована, пассажир остаётся под наблюдением. Конкретные медицинские действия определяет медработник." },
          { id: "medical-radio", text: "Немедленно передать вызов по рации на поясе, одновременно подходя к пассажиру", timeCostSec: 1, next: null, effects: { loyalty: 0, safety: 5 }, correct: true,
            feedback: "Сигнал передан по переносной рации без ухода от пассажира; проводник продолжает приближаться и наблюдать за его состоянием." },
        ] },
      ],
    },
    {
      id: "medical-worse", title: "Пассажир побледнел и осел в кресле", category: "medical", actorId: "medical-passenger",
      trigger: { type: "actor" }, urgency: "critical", responseWindowSec: 8,
      location: { carId: cars[1].id, x: 4, y: 0 }, startNode: "worse-start", nodes: [
        { id: "worse-start", kind: "decision", speaker: "Сосед пассажира", text: "Он почти не отвечает. Подойдите, пожалуйста!", options: [
          { id: "worse-stay", text: "Остаться с пассажиром и срочно передать наблюдаемые признаки начальнику поезда", timeCostSec: 2, next: null, effects: { loyalty: 0, safety: 4 }, correct: true },
          { id: "worse-coordinate", text: "Поручить коллеге остаться рядом, самому координировать подход медработника по рации", timeCostSec: 3, next: null, effects: { loyalty: -1, safety: 5 }, correct: true },
        ] },
      ],
    },
    {
      id: "unattended", title: "Бесхозная сумка у выхода", category: "security", actorId: null,
      trigger: { type: "time", atSec: 45 }, urgency: "critical", severity: 5, responseWindowSec: 10,
      location: { carId: cars[2].id, x: 2, y: 3 },
      escalation: { afterSec: 10, effects: { loyalty: -2, safety: -12 }, set: { "security.item_touched": true },
        text: "Пассажиры подошли к сумке и пытаются понять, кому она принадлежит." },
      startNode: "item-start", nodes: [
        { id: "item-start", kind: "decision", speaker: "Пассажир", text: "У выхода стоит сумка без владельца; рядом начинают останавливаться пассажиры.", options: [
          { id: "item-secure", text: "Ограничить подход к сумке и передать наблюдаемые данные начальнику поезда", timeCostSec: 2, next: null, effects: { loyalty: 0, safety: 8 }, correct: true,
            feedback: "Подход к предмету ограничен, информация передана без предположений о его содержимом." },
          { id: "item-coordinate", text: "Попросить коллегу не подпускать пассажиров, самому уточнить по рации порядок дальнейших действий", timeCostSec: 3, next: null, effects: { loyalty: -1, safety: 7 }, correct: true,
            feedback: "Наблюдение и связь организованы параллельно; пассажирам не предлагают осматривать предмет." },
        ] },
      ],
    },
  ];
  return {
    version: 1, gameplay: "concurrent", train: { name: "Учебный рейс: приоритеты помощи", cars }, events,
    actors: [
      { id: "conductor", name: "Проводник", role: "conductor", ticket: null, spawn: { carId: cars[0].id, x: 1, y: 3 }, mood: 100, steps: [] },
      ...["socket-passenger", "medical-passenger", "seat-passenger"].map((id, i) => ({
        id, name: ["Иванов", "Петрова", "Сидоров"][i], role: "passenger" as const,
        ticket: { carId: cars[i === 2 ? 3 : i].id, seat: "3A" },
        spawn: { carId: cars[i === 2 ? 3 : i].id, x: 4, y: 0 }, mood: 60, steps: [],
      })),
    ], durationSec: 100, initial: { loyalty: 65, safety: 70 },
  };
}
