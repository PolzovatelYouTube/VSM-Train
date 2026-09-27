import { buildCar, type ScenarioData } from "../scenario";

export const BOARDING_PRESSURE_SCENARIO_NAME = "Посадка под давлением";

/**
 * Синтетический учебный сценарий о посадке под нагрузкой.
 * Сначала у входной двери последовательно проверяются билеты и документы,
 * затем действие переходит в салон: к проходу с багажом и спору за место.
 */
export function boardingUnderPressureScenario(): ScenarioData {
  const car = buildCar(1, "comfort", 8);
  car.availableSeats = 1;

  const conductor = { id: "conductor", name: "Проводник", role: "conductor" as const, ticket: null, spawn: { carId: car.id, x: 1, y: 2 }, mood: 100, steps: [] };
  const ticketPassenger = { id: "ticket_passenger", name: "Пассажир Власов", role: "passenger" as const, ticket: { carId: car.id, seat: "2A" }, spawn: { carId: car.id, x: 2, y: 0 }, mood: 60, steps: [] };
  const phonePassenger = { id: "phone_passenger", name: "Пассажирка Ким", role: "passenger" as const, ticket: { carId: car.id, seat: "3A" }, spawn: { carId: car.id, x: 3, y: 0 }, mood: 65, steps: [] };
  const seatPassenger = { id: "seat_passenger", name: "Пассажир Морозов", role: "passenger" as const, ticket: { carId: car.id, seat: "4A" }, spawn: { carId: car.id, x: 4, y: 0 }, mood: 55, steps: [] };
  const noIdPassenger = { id: "no_id_passenger", name: "Пассажир Романов", role: "passenger" as const, ticket: { carId: car.id, seat: "6A" }, spawn: { carId: car.id, x: 6, y: 0 }, mood: 55, steps: [] };

  return {
    version: 1,
    train: { name: "Учебная посадка", cars: [car] },
    actors: [conductor, ticketPassenger, phonePassenger, seatPassenger, noIdPassenger],
    durationSec: 120,
    initial: { loyalty: 60, safety: 65 },
    events: [
      {
        id: "boarding_ticket", title: "Проблема с билетом", category: "request", actorId: ticketPassenger.id,
        trigger: { type: "time", atSec: 2 }, stage: "boarding", startNode: "ticket_start",
        context: [{ flag: "boarding.ticket_checked", label: "Данные билета проверены" }],
        nodes: [
          {
            id: "ticket_start", speaker: ticketPassenger.name,
            text: "В приложении у меня билет есть. Почему система его не принимает? За мной уже собирается очередь.", timerSec: 20,
            onTimeout: { next: null, effects: { loyalty: -4, safety: -2 }, set: { "boarding.queue_growing": true }, text: "Очередь на посадку увеличилась." },
            options: [
              { id: "ticket_check", text: "Проверить дату, рейс, номер заказа и источник приобретения билета", next: "ticket_checked", timeCostSec: 6, effects: { loyalty: 0, safety: -1 }, correct: true, step: "acknowledge", set: { "boarding.ticket_checked": true }, feedback: "Проверка занимает время, но решение принимается на основании данных." },
              { id: "ticket_reject_immediately", text: "Сразу отказать в посадке, не проверяя данные билета", next: null, effects: { loyalty: -7, safety: 1 }, feedback: "Формальное решение принято слишком рано: сначала необходимо разобраться в данных билета." },
              { id: "ticket_allow_temporarily", text: "Пропустить пассажира и разобраться с билетом уже после отправления", next: null, effects: { loyalty: 4, safety: -6 }, set: { "boarding.unverified_boarding": true }, feedback: "Очередь движется быстрее, но проблема проверки права на поездку перенесена внутрь поезда." },
            ],
          },
          {
            id: "ticket_checked", speaker: "Система проверки", text: "Данные не совпадают с текущим рейсом. Пассажир уверен, что купил правильный билет.", timerSec: 15,
            options: [
              { id: "ticket_explain", text: "Спокойно объяснить результат проверки и направить пассажира в кассу или контактный центр", next: null, effects: { loyalty: 1, safety: 2 }, correct: true, step: "solution", feedback: "Пассажиру объяснена причина и предложен дальнейший путь решения." },
              { id: "ticket_argue", text: "Сказать: «Система не принимает билет — это уже не моя проблема»", next: null, effects: { loyalty: -8, safety: 0 }, feedback: "Формально проблема обнаружена правильно, но сервисное взаимодействие провалено." },
              { id: "ticket_override", text: "Сделать исключение и разрешить посадку", next: null, effects: { loyalty: 4, safety: -7 }, set: { "boarding.unverified_boarding": true }, feedback: "Проводник самостоятельно отменяет результат проверки без подтверждённого основания." },
            ],
          },
        ],
      },
      {
        id: "boarding_phone", title: "Билет остался в разряженном телефоне", category: "request", actorId: phonePassenger.id,
        trigger: { type: "time", atSec: 10 }, stage: "boarding", startNode: "phone_start",
        nodes: [{
          id: "phone_start", speaker: phonePassenger.name, text: "Телефон только что выключился, билет открыть не могу. Паспорт у меня с собой. Поезд скоро отправляется.", timerSec: 18,
          options: [
            { id: "phone_identity", text: "Проверить данные поездки другим предусмотренным способом по документу пассажира", next: null, effects: { loyalty: 2, safety: 1 }, timeCostSec: 5, correct: true, step: "solution", set: { "boarding.phone_ticket_verified": true }, feedback: "Используется другой предусмотренный способ проверки, а не догадка." },
            { id: "phone_charge", text: "Пропустить пассажира в вагон для зарядки телефона и проверить билет позже", next: null, effects: { loyalty: 3, safety: -5 }, set: { "boarding.unverified_boarding": true }, feedback: "Пассажир фактически допущен в поезд до подтверждения права на поездку." },
            { id: "phone_refuse", text: "Отказать в посадке только потому, что телефон разрядился", next: null, effects: { loyalty: -6, safety: 1 }, feedback: "Не использована возможность проверить поездку другим способом." },
          ],
        }],
      },
      {
        id: "boarding_identity", title: "Нет документа для подтверждения личности", category: "request", actorId: noIdPassenger.id,
        trigger: { type: "time", atSec: 18 }, stage: "boarding", startNode: "identity_start",
        nodes: [
          {
            id: "identity_start", speaker: noIdPassenger.name, text: "Билет есть, но документ я оставил дома. Есть фотография паспорта в телефоне. До отправления совсем немного времени.", timerSec: 16,
            options: [
              { id: "identity_check", text: "Спокойно проверить, есть ли иной предусмотренный способ или допустимый документ для идентификации", next: "identity_none", effects: { loyalty: 0, safety: 0 }, timeCostSec: 5, correct: true, step: "acknowledge", set: { "boarding.identity_options_checked": true }, feedback: "Сначала проверены возможные способы идентификации, а не сделано предположение." },
              { id: "identity_photo", text: "Принять фотографию документа как достаточное подтверждение и разрешить посадку", next: null, effects: { loyalty: 4, safety: -15 }, set: { "boarding.unverified_boarding": true, "boarding.identity_photo_accepted": true, "boarding.np_called": true }, feedback: "Фотография документа не заменяет предусмотренную идентификацию. Допуск без неё создаёт существенный риск и требует немедленной эскалации начальнику поезда." },
              { id: "identity_refuse_immediate", text: "Сразу отказать, не выясняя наличие другого допустимого способа идентификации", next: null, effects: { loyalty: -5, safety: 1 }, feedback: "Результат может оказаться тем же, но обязательный этап проверки пропущен." },
            ],
          },
          {
            id: "identity_none", speaker: "Обстановка", text: "Другого предусмотренного способа подтвердить личность у пассажира не оказалось.", timerSec: 12,
            options: [
              { id: "identity_deny", text: "Объяснить невозможность посадки и подсказать дальнейший порядок действий", next: null, effects: { loyalty: 0, safety: 3 }, correct: true, step: "solution", feedback: "Ограничение объяснено после проверки возможных альтернатив." },
              { id: "identity_exception", text: "Сделать исключение, потому что пассажир выглядит убедительно и билет существует", next: null, effects: { loyalty: 4, safety: -8 }, set: { "boarding.unverified_boarding": true }, feedback: "Субъективное доверие пассажиру не заменяет подтверждение личности." },
            ],
          },
        ],
      },
      {
        id: "boarding_luggage", title: "Багаж перекрывает проход", category: "technical", actorId: null,
        trigger: { type: "time", atSec: 32 }, stage: "boarding", startNode: "luggage_start",
        nodes: [{
          id: "luggage_start", speaker: "Обстановка", text: "В проходе оставлены два крупных чемодана. Пассажиры вынуждены обходить их, посадочный поток замедляется.", timerSec: 14,
          onTimeout: { next: null, effects: { loyalty: -2, safety: -6 }, set: { "boarding.aisle_blocked": true }, text: "Проход остался частично заблокирован." },
          options: [
            { id: "luggage_owner", text: "Найти владельца и указать конкретное безопасное место для размещения багажа", next: null, timeCostSec: 5, effects: { loyalty: 2, safety: 5 }, correct: true, step: "solution", set: { "boarding.aisle_clear": true }, feedback: "Устранена конкретная причина риска: заблокированный проход." },
            { id: "luggage_move", text: "Самостоятельно переставить чужие чемоданы в сторону, чтобы быстрее освободить проход", next: null, effects: { loyalty: -2, safety: 2 }, feedback: "Проход освобождён быстро, но имущество перемещено без взаимодействия с владельцем." },
            { id: "luggage_wait", text: "Не вмешиваться: после окончания посадки проход всё равно освободится", next: null, effects: { loyalty: -2, safety: -7 }, set: { "boarding.aisle_blocked": true }, feedback: "Именно во время посадки свободный проход особенно важен для движения пассажиров." },
          ],
        }],
      },
      {
        id: "boarding_conflict", title: "Два пассажира у места 4A", category: "conflict", actorId: seatPassenger.id,
        trigger: { type: "time", atSec: 46 }, stage: "boarding", startNode: "seat_start",
        context: [
          { flag: "boarding.seat_documents_checked", label: "Документы обоих пассажиров проверены" },
          { flag: "boarding.spare_seat_used", label: "Резервное место уже занято" },
        ],
        nodes: [
          {
            id: "seat_start", speaker: "Два пассажира", text: "Оба показывают билет на 4A. Один уже сидит, второй требует освободить место. Спор начинает мешать проходу.", timerSec: 18,
            options: [
              { id: "seat_check", text: "Развести спор, освободить проход и сверить оба документа", next: "seat_checked", effects: { loyalty: 0, safety: 2 }, timeCostSec: 6, correct: true, step: "acknowledge", set: { "boarding.seat_documents_checked": true }, feedback: "Проверка требует времени, но решение не строится на том, кто сел первым или говорит громче." },
              { id: "seat_last", text: "Попросить пассажира, который подошёл последним, уступить место", next: null, effects: { loyalty: -7, safety: 1 }, set: { "boarding.seat_complaint": true }, feedback: "Порядок появления пассажиров не подтверждает право на место." },
              { id: "seat_stand", text: "Попросить обоих пока постоять в проходе и продолжить посадку остальных", next: null, effects: { loyalty: -4, safety: -5 }, set: { "boarding.aisle_blocked": true }, feedback: "Проблема отложена ценой нового риска: проход остаётся занят." },
            ],
          },
          {
            id: "seat_checked", speaker: "Проводник", text: "Расхождение подтверждено. В вагоне есть одно резервное место, но проводник не вправе самостоятельно назначать его пассажиру до решения начальника поезда.", timerSec: 14,
            options: [
              { id: "seat_wait_np", text: "Не обещать конкретное место: вызвать начальника поезда и попросить пассажиров освободить проход", next: "seat_np_guidance", effects: { loyalty: -1, safety: 3 }, correct: true, step: "solution", set: { "boarding.np_called": true }, feedback: "Расхождение передано уполномоченному сотруднику; проводник не назначает резервное место самостоятельно." },
              { id: "seat_promise", text: "Пообещать одному пассажиру лучшее место в другом вагоне, чтобы быстрее закончить спор", next: null, effects: { loyalty: 3, safety: 0 }, set: { "boarding.unverified_promise": true }, feedback: "Конфликт временно снят, но обещание дано без проверки ресурса." },
            ],
          },
          {
            id: "seat_np_guidance", speaker: "Начальник поезда", text: "Обращение принято. До окончательного решения можно использовать только согласованный временный вариант, не обещая смену класса или постоянное место.", timerSec: 12,
            options: [
              { id: "seat_spare", text: "По согласованию с ЛНП временно предложить проверенное свободное место", next: null, if: { all: [{ flag: "boarding.np_called" }, { flag: "boarding.spare_seat_used", eq: false }, { resource: { type: "availableSeats", carId: car.id, range: { gte: 1 } } }] }, effects: { loyalty: 1, safety: 2 }, correct: true, step: "solution", set: { "boarding.spare_seat_used": true }, feedback: "Временное размещение допустимо только после согласования с ЛНП и не отменяет разбор расхождения в системе." },
              { id: "seat_wait_resolution", text: "Дождаться решения ЛНП, сохраняя проход свободным", next: null, effects: { loyalty: -1, safety: 3 }, correct: true, step: "solution", feedback: "Это наиболее осторожный вариант: проводник не распоряжается резервным ресурсом самостоятельно." },
            ],
          },
        ],
      },
      {
        id: "boarding_followup", title: "Последствия поспешного решения", category: "conflict", actorId: null,
        trigger: { type: "condition", if: { any: [{ flag: "boarding.unverified_boarding" }, { flag: "boarding.unverified_promise" }] } }, stage: "boarding", startNode: "followup_start",
        nodes: [{
          id: "followup_start", speaker: "Начальник поезда", text: "Возникла проблема с одним из решений на посадке: данные или обещанный ресурс не были подтверждены. Как исправите ситуацию?", timerSec: 15,
          options: [
            { id: "followup_recheck", text: "Признать преждевременное решение, перепроверить данные и предложить только подтверждённый вариант", next: null, effects: { loyalty: -2, safety: 3 }, correct: true, feedback: "Ошибка исправляется, но последствия поспешного решения полностью не исчезают." },
            { id: "followup_defend", text: "Настаивать на первоначальном решении, чтобы не признавать ошибку перед пассажиром", next: null, effects: { loyalty: -6, safety: -4 }, feedback: "Сохранение лица становится важнее достоверности решения и усиливает проблему." },
          ],
        }],
      },
    ],
  };
}
