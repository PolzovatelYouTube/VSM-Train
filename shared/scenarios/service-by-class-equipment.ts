import { buildCar, type ScenarioData } from "../scenario";

export const SERVICE_BY_CLASS_EQUIPMENT_SCENARIO_NAME = "Сервис по классу и оснащению";

/**
 * Синтетический учебный кейс о классе обслуживания и дефицитном ресурсе.
 * В учебном составе нет выделенной тихой зоны: Business не подменяет
 * переговорную, а рабочий звонок направляется в сервисный тамбур.
 */
export function serviceByClassEquipmentScenario(): ScenarioData {
  const business = buildCar(1, "business", 6);
  const standard = buildCar(2, "standard", 8);
  business.availableSeats = 1;
  standard.availableSeats = 0;
  business.capabilities = { writtenCommunication: true };

  const conductor = { id: "conductor", name: "Проводник", role: "conductor" as const, ticket: null, spawn: { carId: standard.id, x: 1, y: 3 }, mood: 100, steps: [] };
  const klimova = { id: "klimova", name: "Пассажирка Климова", role: "passenger" as const, ticket: { carId: standard.id, seat: "3A" }, spawn: { carId: standard.id, x: 3, y: 0 }, mood: 70, steps: [] };
  const businessPassenger = { id: "business_passenger", name: "Пассажир Волков", role: "passenger" as const, ticket: { carId: business.id, seat: "2A" }, spawn: { carId: business.id, x: 2, y: 0 }, mood: 65, steps: [] };
  const upgradePassenger = { id: "upgrade_passenger", name: "Пассажир Соколов", role: "passenger" as const, ticket: { carId: standard.id, seat: "5A" }, spawn: { carId: standard.id, x: 5, y: 0 }, mood: 65, steps: [] };

  return {
    version: 1,
    train: { name: "Учебный рейс: сервис и ресурсы", cars: [business, standard] },
    actors: [conductor, klimova, businessPassenger, upgradePassenger],
    durationSec: 150,
    initial: { loyalty: 65, safety: 70 },
    events: [
      {
        id: "quiet_request", title: "Нужно тихое место для звонка", category: "request", actorId: klimova.id,
        trigger: { type: "time", atSec: 8 }, stage: "onboard", startNode: "quiet_start",
        context: [{ flag: "service.quiet_need_clarified", label: "Потребность пассажирки уточнена" }],
        nodes: [
          {
            id: "quiet_start", speaker: klimova.name, text: "Через пять минут важный рабочий звонок. Можно меня пересадить туда, где тише?", timerSec: 18,
            options: [
              { id: "quiet_clarify", text: "Уточнить продолжительность звонка и действительно ли нужна пересадка", next: "quiet_context", effects: { loyalty: 1, safety: 0 }, correct: true, step: "acknowledge", timeCostSec: 4, set: { "service.quiet_need_clarified": true }, feedback: "Сначала уточнена реальная потребность, а не обещана постоянная пересадка." },
              { id: "quiet_promise_business", text: "Сразу пообещать свободное место в бизнес-классе", next: null, effects: { loyalty: 4, safety: 0 }, set: { "service.business_seat_promised": true }, feedback: "Свободное место сейчас существует, но право и дальнейшая доступность ресурса ещё не проверены." },
              { id: "quiet_refuse", text: "Ответить, что билет стандартного класса и помочь невозможно", next: null, effects: { loyalty: -5, safety: 0 }, feedback: "Отказ дан раньше поиска возможной альтернативы." },
            ],
          },
          {
            id: "quiet_context", speaker: klimova.name, text: "Мне нужно примерно двадцать минут. Постоянно пересаживаться я не хочу — главное, чтобы не мешать соседям.", timerSec: 14,
            options: [
              { id: "quiet_check_options", text: "Проверить доступные места и временные варианты, ничего пока не обещая", next: null, effects: { loyalty: 2, safety: 0 }, timeCostSec: 4, correct: true, set: { "service.quiet_option_checked": true }, feedback: "Информация о ресурсе получена, но он не резервируется автоматически." },
              { id: "quiet_ask_car", text: "Попросить весь стандартный вагон двадцать минут соблюдать тишину", next: null, effects: { loyalty: -4, safety: 0 }, feedback: "Индивидуальная потребность переложена на весь вагон." },
              { id: "quiet_corridor", text: "Предложить провести звонок в сервисном тамбуре, не перекрывая проход, и затем вернуться на место", next: null, effects: { loyalty: 2, safety: 1 }, correct: true, feedback: "Звонок вынесен из пассажирского салона без необеспеченного обещания пересадки или повышения класса." },
            ],
          },
        ],
      },
      {
        id: "business_equipment_failure", title: "Неисправность места в бизнес-классе", category: "technical", actorId: businessPassenger.id,
        trigger: { type: "time", atSec: 22 }, stage: "onboard", startNode: "equipment_start",
        nodes: [
          {
            id: "equipment_start", speaker: businessPassenger.name, text: "У меня не работает розетка и кнопка вызова. Мне нужно работать в дороге. Можно решить проблему?", timerSec: 18,
            options: [
              { id: "equipment_check", text: "Извиниться, проверить неисправность и оценить доступные альтернативы", next: "equipment_confirmed", effects: { loyalty: 2, safety: 1 }, correct: true, step: "acknowledge", timeCostSec: 5, set: { "service.equipment_failure_confirmed": true }, feedback: "Сначала подтверждены неисправность и доступные варианты решения." },
              { id: "equipment_ignore", text: "Предложить пользоваться зарядкой позже в другом вагоне", next: null, effects: { loyalty: -5, safety: 0 }, feedback: "Проблема оплаченного места не проверена и фактически переложена на пассажира." },
              { id: "equipment_promise_repair", text: "Пообещать, что оборудование точно починят через несколько минут", next: null, effects: { loyalty: 3, safety: -2 }, set: { "service.unverified_repair_promise": true }, feedback: "Срок ремонта определяет бортинженер после диагностики. Неподтверждённое обещание ухудшает оценку соблюдения алгоритмов в разборе." },
            ],
          },
          {
            id: "equipment_confirmed", speaker: "Обстановка", text: "Неисправность подтверждена. В бизнес-вагоне остаётся только одно свободное исправное место.", timerSec: 14,
            options: [
              { id: "equipment_move", text: "Пересадить пассажира Business на свободное исправное место и передать неисправность бортинженеру", next: null, if: { all: [{ resource: { type: "availableSeats", carId: business.id, range: { gte: 1 } } }, { flag: "service.business_seat_reserved", eq: false }] }, effects: { loyalty: 4, safety: 1 }, correct: true, step: "solution", set: { "service.business_seat_reserved": true }, feedback: "Дефицитный ресурс использован для восстановления уже оплаченной услуги." },
              { id: "equipment_keep_seat", text: "Оставить пассажира на месте, сообщить бортинженеру и предложить временную альтернативу для работы", next: null, effects: { loyalty: 1, safety: 1 }, correct: true, feedback: "Пассажир получает менее удобное решение, зато резервное место сохраняется." },
              { id: "equipment_use_for_standard", text: "Оставить свободное место пассажирке из Standard для её звонка", next: null, effects: { loyalty: -5, safety: 0 }, feedback: "Комфортный запрос получает приоритет над устранением неисправности услуги пассажира Business." },
            ],
          },
        ],
      },
      {
        id: "upgrade_request", title: "Пассажир хочет перейти в бизнес-класс", category: "request", actorId: upgradePassenger.id,
        trigger: { type: "time", atSec: 35 }, stage: "onboard", startNode: "upgrade_start",
        nodes: [
          {
            id: "upgrade_start", speaker: upgradePassenger.name, text: "В стандарте шумно. Я доплачу — пересадите меня в бизнес прямо сейчас.", timerSec: 16,
            options: [
              { id: "upgrade_check", text: "Уточнить причину, запросить у ЛНП наличие мест и вызвать его для оформления доплаты через терминал", next: "upgrade_result", effects: { loyalty: 1, safety: 0 }, correct: true, timeCostSec: 5, set: { "service.upgrade_checked": true, "service.upgrade_np_called": true }, feedback: "Проводник не оформляет повышение самостоятельно: наличие места и доплату подтверждает ЛНП через терминал." },
              { id: "upgrade_move_first", text: "Сначала пересадить пассажира, а оплату оформить позже", next: null, effects: { loyalty: 4, safety: -2 }, set: { "service.unapproved_upgrade": true }, feedback: "Изменение класса фактически выполнено до проверки возможности оформления." },
              { id: "upgrade_no", text: "Отказать: менять класс после посадки нельзя", next: null, effects: { loyalty: -4, safety: 0 }, feedback: "Категоричный отказ дан без проверки доступных вариантов." },
            ],
          },
          {
            id: "upgrade_result", speaker: "Обстановка", text: "Запрос на повышение класса возможен только при наличии свободного места. Свободный ресурс Business уже может быть нужен для другого пассажира.", timerSec: 12,
            options: [
              { id: "upgrade_available", text: "Оформить повышение после подтверждения ЛНП: место свободно, доплата проведена через терминал", next: null, if: { all: [{ flag: "service.upgrade_np_called" }, { resource: { type: "availableSeats", carId: business.id, range: { gte: 1 } }, }, { flag: "service.business_seat_reserved", eq: false }] }, effects: { loyalty: 3, safety: 0 }, correct: true, set: { "service.business_seat_reserved": true }, feedback: "ЛНП подтвердил и физический ресурс, и оформление повышения; место больше не доступно для следующих запросов." },
              { id: "upgrade_alternative", text: "Если место недоступно, объяснить ограничение и предложить решение в текущем классе", next: null, effects: { loyalty: 1, safety: 0 }, correct: true, feedback: "Отказ объяснён через реальное ограничение, а не через формальное «нельзя»." },
              { id: "upgrade_promise", text: "Пообещать освободить место в Business позже", next: null, effects: { loyalty: 3, safety: 0 }, set: { "service.unverified_business_promise": true }, feedback: "Нет основания обещать будущую доступность ресурса." },
            ],
          },
        ],
      },
      {
        id: "quiet_followup", title: "Звонок начинается", category: "request", actorId: klimova.id,
        trigger: { type: "time", atSec: 50 }, stage: "onboard", startNode: "quiet_followup_start",
        nodes: [{
          id: "quiet_followup_start", speaker: klimova.name, text: "Звонок уже начинается. Вы говорили, что попробуете найти тихое место. Что делать?", timerSec: 12,
          options: [
            { id: "quiet_use_business", text: "Пересадить в Business ради двадцатиминутного звонка, раз место свободно", next: null, if: { all: [{ flag: "service.business_seat_reserved", eq: false }, { resource: { type: "availableSeats", carId: business.id, range: { gte: 1 } } }] }, effects: { loyalty: -4, safety: 0 }, feedback: "Business — пассажирский салон, а не переговорная: звонок помешает отдыху и работе других пассажиров." },
            { id: "quiet_alternative", text: "Проводить в сервисный тамбур на время звонка, сохранив проход свободным", next: null, effects: { loyalty: 2, safety: 1 }, correct: true, feedback: "Решение не затрагивает права пассажиров Business и учитывает безопасность прохода." },
            { id: "quiet_break_promise", text: "Попросить пассажира Business уступить место на двадцать минут", next: null, effects: { loyalty: -7, safety: 0 }, feedback: "Старое обещание защищается за счёт прав и комфорта другого пассажира." },
          ],
        }],
      },
      {
        id: "service_complaint", title: "Претензия из-за обещанной услуги", category: "request", actorId: klimova.id,
        trigger: { type: "condition", if: { any: [{ flag: "service.business_seat_promised" }, { flag: "service.unverified_business_promise" }, { flag: "service.unverified_repair_promise" }] } }, stage: "onboard", startNode: "complaint_start",
        nodes: [{
          id: "complaint_start", speaker: "Пассажир", text: "Мне уже обещали решить вопрос. Почему сейчас оказывается, что это невозможно?", timerSec: 15,
          options: [
            { id: "complaint_ack", text: "Признать, что обещание было дано до проверки ресурса, объяснить ограничения и предложить подтверждённую альтернативу", next: null, effects: { loyalty: -1, safety: 0 }, correct: true, feedback: "Ошибка признана и исправляется без нового неподтверждённого обещания." },
            { id: "complaint_blame", text: "Объяснить, что обстоятельства изменились и проводник здесь ни при чём", next: null, effects: { loyalty: -6, safety: 0 }, feedback: "Ответственность за последствия решения переложена на обстоятельства." },
          ],
        }],
      },
    ],
  };
}
