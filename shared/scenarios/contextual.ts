import { buildCar, type ScenarioData, type GameEvent } from "../scenario";

export const CONTEXTUAL_SCENARIO_NAME = "Решения в контексте: семь ситуаций на борту";

// Синтетические учебные обстоятельства. Не нормативный документ.
export function contextualScenario(): ScenarioData {
  const car = buildCar(1, "standard", 12);
  const familyCar = buildCar(2, "comfort", 10);
  car.availableSeats = 0;
  familyCar.availableSeats = 0;
  familyCar.capabilities = { babyCareSpace: true };
  const events: GameEvent[] = [
    {
      id: "seat", title: "Два билета на одно место", category: "conflict", actorId: "seat_claimant",
      trigger: { type: "time", atSec: 2 }, stage: "boarding", startNode: "seat_start",
      context: [{ flag: "tickets_checked", label: "Билеты обоих пассажиров проверены через ММТ" }, { flag: "wrong_car", label: "Причина расхождения: ошибочно выбран вагон" }, { flag: "unclaimed_evoucher", label: "Причина расхождения: электронная регистрация не погашена" }, { flag: "seat_complaint", label: "Претензия после пересадки без проверки" }],
      nodes: [{ id: "seat_start", speaker: "Два пассажира", text: "У обоих в билете указано 5A. Проход занят багажом, очередь растёт.", timerSec: 22,
        onTimeout: { next: null, effects: { loyalty: -6, safety: -4 }, set: { seat_complaint: true }, text: "Очередь выросла, спор остался без решения" },
        options: [
          { id: "seat_check", text: "Признать неудобство и сверить оба билета через переносной терминал ММТ", next: "seat_checked_wrong_car", nextIf: [{ if: { flag: "unclaimed_evoucher" }, next: "seat_checked_unclaimed" }, { if: { flag: "wrong_car" }, next: "seat_checked_wrong_car" }], effects: { loyalty: 0, safety: -2 }, correct: true, step: "acknowledge", timeCostSec: 8, set: { tickets_checked: true }, feedback: "Решение основано на данных переносного терминала ММТ, а не на том, кто говорит убедительнее." },
          { id: "seat_move", text: "Попросить одного временно пересесть, чтобы освободить проход", next: null, effects: { loyalty: -5, safety: 4 }, set: { seat_complaint: true }, feedback: "Проход освобождён быстро, но выбор пассажира без проверки вызывает претензию." },
          { id: "seat_resolve", text: "Передать проверенное расхождение начальнику поезда, освободив проход", next: null, if: { flag: "tickets_checked" }, effects: { loyalty: 3, safety: 2 }, correct: true, feedback: "Основание проверено; окончательное размещение требует участия начальника поезда." },
        ] },
        { id: "seat_checked_wrong_car", kind: "information", speaker: "Терминал ММТ", text: "Причина расхождения: один пассажир выбрал не тот вагон. Данные переданы начальнику поезда; пассажиры освобождают проход и ждут решения.", next: null, options: [] },
        { id: "seat_checked_unclaimed", kind: "information", speaker: "Терминал ММТ", text: "Причина расхождения: электронная регистрация прежнего пассажира не была погашена, хотя место фактически пустовало. Данные переданы начальнику поезда; место пока не гарантировано.", next: null, options: [] },
      ],
    },
    {
      id: "smell", title: "Дискомфорт от соседа", category: "request", actorId: "smell_complainer",
      trigger: { type: "time", atSec: 40 }, stage: "onboard", startNode: "smell_start",
      context: [{ flag: "seats_checked", label: "Наличие свободных мест проверено" }, { flag: "smell_ventilation", label: "Причина запаха: неисправность вентиляции в ряду" }, { flag: "third_party_upset", label: "Сосед недоволен вмешательством" }],
      nodes: [{ id: "smell_start", speaker: "Пассажир", text: "Рядом сильный запах. Пересадите меня куда-нибудь.", timerSec: 20,
        options: [
          { id: "smell_check", text: "Тихо уточнить жалобу, проверить доступные места и источник запаха", next: "smell_start", if: { flag: "seats_checked", eq: false }, timeCostSec: 7, set: { seats_checked: true }, effects: { loyalty: 0, safety: 0 }, correct: true, feedback: "Свободных мест не оказалось. Дальнейшее решение зависит от причины: личные вещи пассажира и вентиляция требуют разных действий." },
          { id: "smell_talk", text: "По отдельности пригласить обоих пассажиров к тамбуру и тихо обсудить временный компромисс", next: null, if: { all: [{ flag: "seats_checked" }, { flag: "smell_ventilation", eq: false }, { resource: { type: "availableSeats", carId: car.id, range: { lt: 1 } } }] }, effects: { loyalty: 2, safety: 0 }, set: { third_party_upset: true }, correct: true, feedback: "Разговор не слышен остальному салону. При источнике в личных вещах компромисс ищут без публичного обсуждения соседа." },
          { id: "smell_engineer", text: "Сообщить бортинженеру о запахе из вентиляции в конкретном ряду и обозначить пассажирам дальнейший порядок", next: null, if: { all: [{ flag: "seats_checked" }, { flag: "smell_ventilation" }] }, effects: { loyalty: 1, safety: 2 }, correct: true, set: { ventilation_engineer_called: true }, feedback: "Если источник технический, пересадка пассажиров не заменяет диагностику и работу бортинженера." },
          { id: "smell_promise", text: "Пообещать другое место до проверки", next: null, effects: { loyalty: 3, safety: 0 }, set: { third_party_upset: true }, feedback: "Обещание успокаивает сейчас, но другое место не подтверждено; претензия вернётся позже." },
        ] }],
    },
    {
      id: "sale", title: "Сигнал бармену вагона-бистро о признаках опьянения", category: "request", actorId: "drunk_passenger",
      trigger: { type: "time", atSec: 75 }, stage: "onboard", startNode: "sale_start",
      contentTodo: "TODO: подтвердить у заказчика порядок продажи алкоголя при признаках опьянения. В сценарии нет юридического запрета или полномочия на отказ.",
      context: [{ flag: "sale_observed", label: "Наблюдаемые признаки уточнены" }],
      nodes: [{ id: "sale_start", speaker: "Бармен вагона-бистро", text: "Проводник передал признаки опьянения пассажира, который просит ещё алкоголь. Продажа проводится только в вагоне-бистро через кассовый терминал; нарушения порядка пока нет.", timerSec: 18,
        options: [
          { id: "sale_observe", text: "Передать бармену наблюдаемые признаки и спокойно уточнить обстановку", next: "sale_start", if: { flag: "sale_observed", eq: false }, timeCostSec: 6, effects: { loyalty: 0, safety: 0 }, set: { sale_observed: true }, correct: true, feedback: "Сигнал передан сотруднику, который работает с кассовым терминалом; наблюдение уточняет риск, но не подменяет методику обслуживания." },
          { id: "sale_consult", text: "Попросить бармена приостановить продажу и уточнить порядок у начальника поезда", next: null, effects: { loyalty: -2, safety: 2 }, correct: true, feedback: "Проводник не принимает решение о продаже вместо бармена: запрос передан ответственному сотруднику и начальнику поезда." },
          { id: "sale_label", text: "Объявить при соседях: «Вы пьяны»", next: null, effects: { loyalty: -6, safety: -4 }, feedback: "Публичная оценка провоцирует конфликт; в существующей методике рекомендуется спокойное общение без такого ярлыка." },
        ] }],
    },
    {
      id: "argument", title: "Спор и грубость", category: "conflict", actorId: "neighbour_grumpy",
      trigger: { type: "time", atSec: 110 }, stage: "onboard", startNode: "argument_start",
      context: [{ flag: "heard_both", label: "Обе стороны выслушаны" }],
      nodes: [{ id: "argument_start", speaker: "Пассажиры", text: "Он первый начал! А вы вообще не вмешивайтесь! Угроз и физического контакта пока нет.", timerSec: 20,
        options: [
          { id: "argument_listen", text: "Признать напряжение и кратко выслушать обе стороны", next: "argument_start", if: { flag: "heard_both", eq: false }, timeCostSec: 7, effects: { loyalty: 0, safety: -1 }, set: { heard_both: true }, correct: true, step: "acknowledge", feedback: "Выслушивание снижает вероятность пристрастного решения, но спор продолжается во время разговора." },
          { id: "argument_rule", text: "Попросить обоих соблюдать спокойствие и предложить разойтись", next: null, step: "rule", effects: { loyalty: -4, safety: 2 }, feedback: "Разумная просьба прозвучала раньше признания ситуации; стороны воспринимают её как отмахивание.", outcomes: [{ if: { flag: "heard_both" }, correct: true, effects: { loyalty: 2, safety: 2 }, feedback: "После выслушивания просьба воспринимается как нейтральная. Разговор всё равно занял время." }] },
          { id: "argument_side", text: "Поддержать того, кто пожаловался первым", next: null, effects: { loyalty: -5, safety: -3 }, feedback: "Очередность жалобы не определяет правоту; занятие стороны усиливает спор." },
        ] }],
    },
    {
      id: "care", title: "Место для ухода за ребёнком", category: "request", actorId: "mother_with_child",
      trigger: { type: "time", atSec: 145 }, stage: "onboard", startNode: "care_start",
      context: [{ flag: "care_checked", label: "Потребность и ограничения пространства уточнены" }, { flag: "review_ready", label: "Начался последующий обход" }],
      contentTodo: "TODO: подтвердить фактическое оснащение состава и порядок предоставления служебного купе. Возможность санузла с пеленальным столиком задана как synthetic capability учебного состава.",
      nodes: [{ id: "care_start", speaker: "Мать с ребёнком", text: "Нужно место для ухода. Сначала нужно проверить, есть ли рядом оборудованный санузел; проход должен оставаться свободным.", timerSec: 20,
        options: [
          { id: "care_ask", text: "Уточнить, что требуется и какая помощь приемлема", next: "care_start", if: { flag: "care_checked", eq: false }, effects: { loyalty: 0, safety: 0 }, timeCostSec: 6, set: { care_checked: true }, correct: true, feedback: "Уточнена потребность; следующим шагом проверяется оснащение ближайшего вагона." },
          { id: "care_toilet", text: "Проверить и предложить оборудованный санузел с пеленальным столиком в соседнем вагоне", next: null, if: { all: [{ flag: "care_checked" }, { resource: { type: "capability", carId: familyCar.id, capability: "babyCareSpace" } }] }, effects: { loyalty: 3, safety: 1 }, correct: true, set: { review_ready: true }, feedback: "Сначала использовано подтверждённое оснащение состава; проход не занят." },
          { id: "care_arrange", text: "При отсутствии оборудованного санузла обратиться к начальнику поезда о служебном купе", next: null, if: { all: [{ flag: "care_checked" }, { resource: { type: "capability", carId: familyCar.id, capability: "babyCareSpace", eq: false } }] }, effects: { loyalty: 2, safety: 0 }, correct: true, set: { review_ready: true }, feedback: "Служебное купе запрашивается только после проверки доступного санитарного оснащения и по согласованию с начальником поезда." },
          { id: "care_aisle", text: "Предложить устроиться в проходе прямо сейчас", next: null, effects: { loyalty: 3, safety: -5 }, set: { review_ready: true }, feedback: "Быстрая помощь уменьшает неудобство, но загромождает проход; компромисс создаёт риск." },
        ], onTimeout: { next: null, effects: { loyalty: -4, safety: 0 }, set: { review_ready: true }, text: "Помощь не согласована; начался следующий обход" } }],
    },
    {
      id: "panic", title: "Паника или индивидуальное недомогание", category: "medical", actorId: "anxious_passenger",
      trigger: { type: "time", atSec: 180 }, stage: "onboard", startNode: "panic_start",
      contentTodo: "TODO: добавить подтверждённый алгоритм распознавания и помощи при панической атаке. Проводник не ставит диагноз; здесь используется только оценка → доклад → поиск медика из существующего сценария.",
      context: [{ flag: "panic_context", label: "Уточнено: индивидуальное недомогание, массовой паники нет" }, { flag: "panic_rapid_worsening", label: "Наблюдается быстрое ухудшение состояния" }],
      nodes: [{ id: "panic_start", speaker: "Пассажир", text: "Мне страшно, трудно дышать. Причина пока неизвестна, остальные пассажиры спокойны.", timerSec: 15,
        options: [
          { id: "panic_ask", text: "Кратко уточнить состояние и обстановку, оставаясь рядом", next: "panic_start", if: { flag: "panic_context", eq: false }, effects: { loyalty: 0, safety: 0 }, timeCostSec: 5, correct: true, set: { panic_context: true }, feedback: "Контекст уточнён без диагноза, но времени на помощь осталось меньше." },
          { id: "panic_rapid_change", text: "Зафиксировать быстрое ухудшение и немедленно передать наблюдаемые признаки ЛНП", next: "panic_start", if: { all: [{ flag: "panic_context" }, { flag: "panic_rapid_worsening", eq: false }] }, effects: { loyalty: 0, safety: 2 }, timeCostSec: 1, correct: true, set: { panic_rapid_worsening: true }, feedback: "Изменение состояния зафиксировано как наблюдение, а не как диагноз; следующий уровень решения принимает ЛНП." },
          { id: "panic_help", text: "Остаться рядом, сообщить начальнику поезда и искать медработника", next: null, if: { flag: "panic_rapid_worsening", eq: false }, effects: { loyalty: -1, safety: 3 }, correct: true, feedback: "При неопределённости выбран осторожный путь из существующего медицинского сценария; пассажир может переживать из-за вызова помощи.", outcomes: [{ if: { flag: "panic_context" }, correct: true, effects: { loyalty: 1, safety: 3 }, feedback: "Уточнён индивидуальный характер недомогания, передаются наблюдения, а не диагноз. На уточнение потрачено время." }] },
          { id: "panic_escalate_stop", text: "Передать ЛНП быстрое ухудшение; ЛНП оценивает с диспетчером необходимость незапланированной остановки", next: null, if: { flag: "panic_rapid_worsening" }, effects: { loyalty: -1, safety: 5 }, correct: true, feedback: "Проводник передаёт наблюдаемые признаки и не принимает решение об остановке самостоятельно." },
          { id: "panic_diagnose", text: "Сказать, что это точно паническая атака и помощь не нужна", next: null, effects: { loyalty: 2, safety: -8 }, feedback: "Причина не установлена; уверенное успокоение может задержать необходимую помощь." },
        ] }],
    },
    {
      id: "stages", title: "Алкоголь: изменение обстановки", category: "conflict", actorId: "drunk_passenger",
      trigger: { type: "time", atSec: 215 }, stage: "onboard", startNode: "stages_observe",
      context: [{ flag: "intoxication_stage", label: "Стадия: 1 — употребление, 2 — признаки опьянения, 3 — нарушение порядка" }],
      contentTodo: "TODO: подтвердить нормативные действия на стадии употребления. Эскалация при нарушении порядка основана на ситуации №6 onboard.ts; факт употребления сам по себе не объявляется нарушением.",
      nodes: [
        { id: "stages_observe", speaker: "Обстановка", text: "Пассажир пьёт напиток, купленный в вагоне-бистро, сидит спокойно и никому не мешает.", timerSec: 18, options: [
          { id: "stage_watch", text: "Оценить обстановку без публичных ярлыков", next: "stage_signs", effects: { loyalty: 0, safety: 0 }, correct: true, timeCostSec: 3, set: { intoxication_stage: 2 }, feedback: "Позже заметны неуверенные движения; дальнейшее решение опирается на новые наблюдения, а не роль пассажира." },
          { id: "stage_escalate", text: "Сообщить начальнику поезда о нарушении порядка", next: "stage_signs", effects: { loyalty: -4, safety: 0 }, set: { intoxication_stage: 2 }, feedback: "На этом этапе нарушения не наблюдалось; доклад преувеличивает обстоятельства." },
        ] },
        { id: "stage_signs", speaker: "Обстановка", text: "Речь замедлена, пассажир качается, но угроз соседям пока нет.", timerSec: 15, options: [
          { id: "stage_calm", text: "Спокойно предложить устроиться на месте", next: "stage_disorder", effects: { loyalty: 2, safety: 1 }, correct: true, set: { intoxication_stage: 3 }, feedback: "Помощь соответствует текущим признакам, но не гарантирует дальнейшего спокойствия: позднее пассажир начинает толкать соседа." },
          { id: "stage_consult", text: "Попросить коллегу наблюдать за пассажиром и уточнить порядок помощи у начальника поезда", next: "stage_disorder", timeCostSec: 4, effects: { loyalty: -1, safety: 2 }, correct: true, set: { intoxication_stage: 3 }, feedback: "Наблюдение поручено коллеге; консультация занимает время. Нейтральный доклад не объявляет пассажира нарушителем." },
        ] },
        { id: "stage_disorder", speaker: "Обстановка", text: "Пассажир встал и толкает соседа. Наблюдается нарушение порядка.", timerSec: 12, options: [
          { id: "stage_calm_only", text: "Только спокойно предложить устроиться на месте", next: null, effects: { loyalty: 2, safety: 1 }, correct: true,
            outcomes: [{ if: { flag: "intoxication_stage", eq: 3 }, correct: false, effects: { loyalty: 0, safety: -6 }, feedback: "Та же просьба теперь недостаточна: соседи подвергаются риску, требуется доклад и обеспечение их безопасности." }] },
          { id: "stage_report", text: "Обеспечить безопасность соседей и сообщить начальнику поезда о нарушении порядка", next: null, effects: { loyalty: -2, safety: 5 }, correct: true, feedback: "Использован подход ситуации №6: нейтральный доклад без ярлыка. Вмешательство может вызвать недовольство пассажира." },
        ] },
      ],
    },
    {
      id: "seat_followup", title: "Претензия после решения о месте", category: "request", actorId: "seat_claimant",
      trigger: { type: "condition", if: { all: [{ flag: "seat_complaint" }, { flag: "review_ready" }] } }, stage: "complaint", startNode: "followup",
      nodes: [{ id: "followup", speaker: "Начальник поезда", text: "При следующем обходе пассажир вернулся к претензии: его переместили до проверки билетов или оставили спор без решения.", options: [
        { id: "followup_review", text: "Признать неудобство и вернуться к проверке оснований", next: null, effects: { loyalty: -3, safety: 0 }, correct: true, feedback: "Претензия рассмотрена, но доверие после прежнего решения восстановлено не полностью." },
        { id: "followup_report", text: "Зафиксировать претензию и передать проверку начальнику поезда", next: null, timeCostSec: 4, effects: { loyalty: -5, safety: 1 }, correct: true, feedback: "Проверка передана уполномоченному сотруднику; пассажир дольше ждёт личного решения." },
      ] }],
    },
    {
      id: "smell_followup", title: "Претензия соседа после вмешательства", category: "request", actorId: "neighbour_grumpy",
      trigger: { type: "condition", if: { all: [{ flag: "third_party_upset" }, { flag: "review_ready" }] } }, stage: "complaint", startNode: "neighbour",
      nodes: [{ id: "neighbour", speaker: "Сосед", text: "Теперь ко мне относятся как к виноватому. А обещанного свободного места так и нет.", options: [
        { id: "neighbour_review", text: "Выслушать соседа, объяснить ограничения и согласовать дальнейшие действия", next: null, effects: { loyalty: -2, safety: 0 }, correct: true, feedback: "Третья сторона тоже нуждается в уважительном общении; прежнее вмешательство имеет цену для доверия." },
        { id: "neighbour_record", text: "Предложить зафиксировать обращение и вернуться к нему при обходе с начальником поезда", next: null, timeCostSec: 3, effects: { loyalty: -4, safety: 0 }, correct: true, feedback: "Обращение не потеряется, но ожидание совместного обхода снижает доверие." },
      ] }],
    },
  ];
  return { version: 1, train: { name: "Учебный рейс: решения в контексте", cars: [car, familyCar] },
    actors: [
      { id: "conductor", name: "Проводник", role: "conductor", ticket: null, spawn: { carId: car.id, x: 1, y: 3 }, mood: 100, steps: [] },
      { id: "seat_claimant", name: "Пассажир Орлов", role: "passenger", ticket: { carId: car.id, seat: "5A" }, spawn: { carId: car.id, x: 6, y: 0 }, mood: 55, steps: [] },
      { id: "seat_second_claimant", name: "Пассажир Крылов", role: "passenger", ticket: { carId: car.id, seat: "5A" }, spawn: { carId: car.id, x: 6, y: 4 }, mood: 55, steps: [] },
      { id: "smell_complainer", name: "Пассажирка Лебедева", role: "passenger", ticket: { carId: car.id, seat: "6A" }, spawn: { carId: car.id, x: 7, y: 0 }, mood: 60, steps: [] },
      { id: "neighbour_grumpy", name: "Пассажир Громов", role: "troublemaker", ticket: { carId: car.id, seat: "6B" }, spawn: { carId: car.id, x: 7, y: 1 }, mood: 50, steps: [] },
      { id: "drunk_passenger", name: "Пассажир Серов", role: "troublemaker", ticket: { carId: car.id, seat: "8A" }, spawn: { carId: car.id, x: 9, y: 0 }, mood: 55, steps: [] },
      { id: "mother_with_child", name: "Пассажирка Назарова с ребёнком", role: "passenger", ticket: { carId: car.id, seat: "10A" }, spawn: { carId: car.id, x: 11, y: 0 }, mood: 65, steps: [] },
      { id: "anxious_passenger", name: "Пассажирка Белова", role: "passenger", ticket: { carId: car.id, seat: "11A" }, spawn: { carId: car.id, x: 12, y: 0 }, mood: 60, steps: [] },
    ],
    events, durationSec: 300, initial: { loyalty: 60, safety: 65 } };
}
