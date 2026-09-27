import { buildCar, type Actor, type GameEvent, type ScenarioData } from "../scenario";

// Маломобильные пассажиры и бдительность: синтетические учебные ситуации о помощи
// пассажиру в кресле-коляске, собаке-проводнике и бесхозной вещи. Если вещь трогали,
// разбор переносится до прибытия на ближайшую станцию. Имена пассажиров вымышленные.

export const ACCESSIBILITY_SCENARIO_NAME = "Маломобильные пассажиры и бесхозная вещь";

export function accessibilityScenario(): ScenarioData {
  const car1 = buildCar(1, "business", 8);
  const car2 = buildCar(2, "comfort", 8);
  const car3 = buildCar(3, "bistro", 6);
  const car4 = buildCar(4, "standard", 10);
  car2.availableSeats = 1;
  car2.capabilities = { wheelchairStorage: true, writtenCommunication: true, visualInformation: true };
  car4.capabilities = { accessibleToilet: true };

  // Пассажир в кресле-коляске: помощь при размещении с вещами (п. 8.7), место для сложенного кресла (п. 6.3),
  // питание на место (п. 8.8), информация — от самого пассажира (п. 8.9)
  const evWheelchair: GameEvent = {
    id: "ev_wheelchair",
    title: "Пассажир в кресле-коляске",
    category: "request",
    actorId: "a_wheelchair",
    trigger: { type: "actor" },
    stage: "boarding",
    startNode: "w1",
    context: [{ flag: "boarding_priority_given", label: "Приоритетная посадка и порядок высадки согласованы" }],
    nodes: [
      {
        id: "w1",
        speaker: "Пассажир Громов",
        text: "Добрый день. Я заранее сообщил через контакт-центр, что мне понадобится помощь. Мне на место 2A: с креслом справлюсь, а чемодан на полку сам не подниму.",
        timerSec: 20,
        onTimeout: {
          next: "w_bad",
          effects: { loyalty: -10, safety: -10 },
          text: "Пассажир попытался сам поднять чемодан, кресло перекрыло проход",
        },
        options: [
          {
            id: "w1a",
            text: "«Добрый день! Я помогу Вам разместиться с вещами. Подскажите, как Вам удобнее: пересесть на место или остаться в кресле? При высадке помогу после выхода основного потока.»",
            next: "w2",
            effects: { loyalty: 10, safety: 5 },
            correct: true,
            step: "acknowledge",
            set: { boarding_priority_given: true },
            hint: "Обращаться к самому пассажиру и уточнить, какая помощь ему нужна.",
            feedback: "Помощь при размещении с вещами — обязанность персонала (СТО РЖД 03.014, п. 8.7). Сначала узнать у самого пассажира, как ему удобно (п. 8.9).",
          },
          {
            id: "w1b",
            text: "Обратиться к сопровождающей: «Помогите ему пересесть, а чемодан я возьму»",
            next: "w2",
            effects: { loyalty: -10, safety: 0 },
            feedback: "Говорить нужно с самим пассажиром, а не через сопровождающего: он сам решает, какая помощь ему нужна.",
          },
          {
            id: "w1c",
            text: "Молча взяться за ручки кресла и покатить пассажира к месту",
            next: "w_bad",
            effects: { loyalty: -15, safety: -5 },
            feedback: "Кресло-коляску нельзя трогать без спроса: это личное пространство пассажира, а неожиданное движение опасно.",
          },
        ],
      },
      {
        id: "w2",
        speaker: "Пассажир Громов",
        text: "Пересяду сам, только придержите кресло. А куда его потом?",
        timerSec: 20,
        onTimeout: { next: "w_bad", effects: { loyalty: -5, safety: -10 }, text: "Кресло так и осталось стоять в проходе" },
        options: [
          {
            id: "w2a",
            text: "«Кресло сложим и разместим на специальном месте рядом с Вами, чтобы проход оставался свободным. Понадобится — сразу принесу»",
            next: "w3",
            effects: { loyalty: 5, safety: 10 },
            correct: true,
            step: "rule",
            feedback: "Для кресла в сложенном состоянии предусмотрено место в вагоне (п. 6.3). Проход — путь эвакуации, он должен быть свободен.",
          },
          {
            id: "w2b",
            text: "«Оставим пока здесь, у прохода, чтобы было под рукой»",
            next: "w3",
            effects: { loyalty: 0, safety: -15 },
            feedback: "Кресло в проходе мешает обходу и эвакуации — это нарушение безопасности, даже если пассажиру так удобнее.",
          },
        ],
      },
      {
        id: "w3",
        speaker: "Пассажир Громов",
        text: "Спасибо. А в бистро я, наверное, не доберусь — поезд качает.",
        timerSec: 20,
        options: [
          {
            id: "w3a",
            text: "«Не беспокойтесь, питание можно заказать прямо на место. Сейчас принесу меню»",
            next: "w4",
            effects: { loyalty: 10, safety: 0 },
            correct: true,
            step: "solution",
            set: { meal_ordered: true },
            feedback: "Пассажирам, которым трудно передвигаться, должна быть доступна доставка питания на место (п. 8.8).",
          },
          {
            id: "w3b",
            text: "«Бистро в третьем вагоне, там удобные поручни — дойдёте»",
            next: "w4",
            effects: { loyalty: -10, safety: -5 },
            hint: "Предложить заказ питания на место.",
            feedback: "Проводник переложил проблему на пассажира. Переход между вагонами на ходу для него небезопасен.",
          },
        ],
      },
      {
        id: "w4",
        kind: "information",
        speaker: "Пассажир Громов",
        text: "Разговор завершён. Пассажиру сообщено, где находится проводник и как вызвать помощь: кнопкой вызова у места.",
        next: null,
        options: [],
      },
      {
        id: "w_bad",
        speaker: "Сопровождающая Громова",
        text: "Осторожно! Чемодан сейчас упадёт, а кресло загородило весь проход!",
        timerSec: 12,
        options: [
          {
            id: "wba",
            text: "«Простите, сейчас всё уберу». Придержать и поднять чемодан, сложить кресло, освободить проход",
            next: "w3",
            effects: { loyalty: 5, safety: 10 },
            correct: true,
            step: "acknowledge",
            feedback: "Проводник признал ошибку и устранил угрозу: багаж закреплён, проход свободен.",
          },
          {
            id: "wbb",
            text: "Попросить других пассажиров помочь, а самому продолжить обход",
            next: null,
            effects: { loyalty: -15, safety: -10 },
            feedback: "Помогать маломобильному пассажиру — задача персонала, а не соседей.",
          },
        ],
      },
    ],
  };

  // Незрячая пассажирка с собакой-проводником (п. 4.5): не путать с питомцем из ситуации №4
  const evGuideDog: GameEvent = {
    id: "ev_guide_dog",
    title: "Собака-проводник и недовольный сосед",
    category: "conflict",
    actorId: "a_neighbour_dog",
    trigger: { type: "actor" },
    stage: "onboard",
    startNode: "g1",
    context: [{ flag: "dog_passage_clear", label: "Собака-проводник размещена без перекрытия прохода" }],
    nodes: [
      {
        id: "g1",
        speaker: "Пассажир Фомин",
        text: "Проводник! Почему собака без переноски? Мне с котом переноску купить велели, а тут овчарка в проходе лежит!",
        timerSec: 20,
        onTimeout: { next: "g_bad", effects: { loyalty: -10, safety: 0 }, text: "Сосед начал громко возмущаться, пассажирка растерялась" },
        options: [
          {
            id: "g1a",
            text: "«Понимаю Ваше беспокойство, спасибо, что сказали. Сейчас всё объясню»",
            next: "g2",
            effects: { loyalty: 5, safety: 0 },
            correct: true,
            step: "acknowledge",
          },
          {
            id: "g1b",
            text: "Подойти к пассажирке: «Уберите собаку в переноску, для всех правила одинаковые»",
            next: "g_bad",
            effects: { loyalty: -20, safety: 0 },
            step: "rule",
            feedback: "Собака-проводник — не питомец. Незрячих пассажиров с собакой-проводником обслуживают по отдельным правилам (СТО РЖД 03.014, п. 4.5), переноска ей не нужна.",
          },
          {
            id: "g1c",
            text: "Сделать вид, что не услышал, и пройти дальше",
            next: "g_bad",
            effects: { loyalty: -10, safety: 0 },
            feedback: "Проигнорированная жалоба перерастает в конфликт, а достаётся в итоге незрячей пассажирке.",
          },
        ],
      },
      {
        id: "g2",
        speaker: "Пассажир Фомин",
        text: "И что, ей можно, а мне нельзя?",
        timerSec: 20,
        options: [
          {
            id: "g2a",
            text: "«Это собака-проводник: у неё есть опознавательный жилет и документ об обучении. Она помогает пассажирке ориентироваться, переноска не требуется»",
            next: "g3",
            effects: { loyalty: 5, safety: 5 },
            correct: true,
            step: "rule",
            feedback: "Правило объяснено спокойно и по существу, без спора и без обсуждения здоровья пассажирки.",
          },
          {
            id: "g2b",
            text: "«Правила есть правила, не спорьте со мной»",
            next: "g3",
            effects: { loyalty: -10, safety: 0 },
            step: "rule",
            feedback: "Правило не объяснено: сосед остаётся с ощущением несправедливости.",
          },
        ],
      },
      {
        id: "g3",
        speaker: "Пассажирка Лебедева",
        text: "Простите, если мы мешаем. Джесси обычно тихо лежит у ног, не в проходе.",
        timerSec: 20,
        options: [
          {
            id: "g3a",
            text: "«Всё в порядке. Проверю, что Джесси лежит у Вашего места и не перекрывает проход». Соседу — предложить свободное место у окна, если ему некомфортно",
            next: "g4",
            effects: { loyalty: 10, safety: 5 },
            correct: true,
            step: "solution",
            set: { neighbour_moved: true, dog_passage_clear: true },
            feedback: "Решение для обеих сторон: пассажирка остаётся на своём месте, собака не перекрывает путь эвакуации, соседу предложен выбор.",
          },
          {
            id: "g3b",
            text: "Погладить собаку и угостить печеньем, чтобы «подружить» её с соседом",
            next: "g4",
            effects: { loyalty: -10, safety: -5 },
            feedback: "Собака-проводник работает. Гладить, кормить и отвлекать её без разрешения хозяйки нельзя.",
          },
          {
            id: "g3c",
            text: "Предложить пассажирке с собакой перейти в конец вагона, поближе к тамбуру",
            next: "g4",
            effects: { loyalty: -20, safety: 0 },
            feedback: "Пересаживать приходится того, кому некомфортно, а не пассажирку с собакой-проводником.",
          },
        ],
      },
      {
        id: "g4",
        kind: "information",
        speaker: "Пассажир Фомин",
        text: "Разговор завершён. Пассажирам сообщено, как обратиться к проводнику за дальнейшей помощью.",
        next: null,
        options: [],
      },
      {
        id: "g_bad",
        speaker: "Пассажирка Лебедева",
        text: "(тихо) Мы, наверное, выйдем в тамбур, чтобы никому не мешать…",
        timerSec: 15,
        options: [
          {
            id: "gba",
            text: "«Пожалуйста, оставайтесь — это Ваше место, и Вы никому не мешаете. Я сейчас всё улажу»",
            next: "g2",
            effects: { loyalty: 10, safety: 5 },
            correct: true,
            step: "acknowledge",
          },
          {
            id: "gbb",
            text: "Согласиться и проводить пассажирку в тамбур",
            next: null,
            effects: { loyalty: -25, safety: -10 },
            feedback: "Незрячая пассажирка провела поездку в тамбуре из-за чужой жалобы — грубое нарушение стандарта обслуживания и её безопасности.",
          },
        ],
      },
    ],
  };

  // Нарушение слуха: канал общения выбирают по потребности пассажира, а не по роли.
  const evHearing: GameEvent = {
    id: "ev_hearing",
    title: "Уточнение по письменному сообщению",
    category: "request",
    actorId: "a_hearing",
    trigger: { type: "time", atSec: 48 },
    stage: "onboard",
    startNode: "h1",
    context: [{ flag: "hearing_channel_agreed", label: "Предпочтительный канал общения уточнён" }],
    nodes: [
      {
        id: "h1",
        speaker: "Пассажирка Андреева",
        text: "Я не расслышала объявление в вагоне. Подскажите, когда следующая остановка?",
        timerSec: 15,
        options: [
          {
            id: "h1a",
            text: "Уточнить, удобнее ли показать информацию на экране или записать её",
            next: "h2",
            effects: { loyalty: 1, safety: 0 },
            correct: true,
            step: "acknowledge",
            timeCostSec: 3,
            set: { hearing_channel_agreed: true },
            feedback: "Сначала уточнён удобный способ общения; вопрос занимает время, но не заставляет пассажира подстраиваться под один канал.",
          },
          {
            id: "h1b",
            text: "Повторить объявление громче из прохода",
            next: null,
            effects: { loyalty: -5, safety: 0 },
            feedback: "Громкость не заменяет доступный канал. Потребность в письменной или визуальной информации не была учтена.",
          },
        ],
      },
      {
        id: "h2",
        speaker: "Пассажирка Андреева",
        text: "Пожалуйста, лучше покажите или напишите — так я точно не перепутаю время.",
        timerSec: 12,
        options: [
          {
            id: "h2a",
            text: "Показать время на информационном дисплее или в текстовом сообщении приложения",
            next: null,
            if: { all: [{ flag: "hearing_channel_agreed" }, { resource: { type: "capability", carId: car2.id, capability: "writtenCommunication" } }, { resource: { type: "capability", carId: car2.id, capability: "visualInformation" } }, { resource: { type: "serviceEntitlement", entitlement: "writtenCommunication" } }] },
            effects: { loyalty: 5, safety: 0 },
            correct: true,
            step: "solution",
            feedback: "В этом составе доступны визуальный дисплей и текстовый канал; информация передана в согласованном электронном формате.",
          },
          {
            id: "h2b",
            text: "Сказать, что можно узнать время только по громкому объявлению",
            next: null,
            effects: { loyalty: -6, safety: 0 },
            feedback: "Доступный в составе канал не использован, хотя пассажирка прямо обозначила удобный формат.",
          },
        ],
      },
    ],
  };

  // Нарушение зрения: устное описание и ориентация — не та же помощь, что письменный канал.
  const evVision: GameEvent = {
    id: "ev_vision",
    title: "Ориентация в вагоне",
    category: "request",
    actorId: "a_vision",
    trigger: { type: "time", atSec: 62 },
    stage: "onboard",
    startNode: "v1",
    context: [{ flag: "orientation_preference", label: "Формат ориентации уточнён" }],
    nodes: [
      {
        id: "v1",
        speaker: "Пассажир Серов",
        text: "Я не вижу табличек. Подскажите, как пройти к санузлу?",
        timerSec: 15,
        options: [
          {
            id: "v1a",
            text: "Спросить, удобнее ли устное описание маршрута или сопровождение до ориентира",
            next: "v2",
            effects: { loyalty: 1, safety: 0 },
            correct: true,
            step: "acknowledge",
            timeCostSec: 3,
            set: { orientation_preference: true },
            feedback: "Пассажир сам выбирает подходящий формат ориентации; зрение не означает, что сопровождение нужно без спроса.",
          },
          {
            id: "v1b",
            text: "Молча указать рукой в сторону тамбура",
            next: null,
            effects: { loyalty: -6, safety: -2 },
            feedback: "Жест не даёт ориентиров, которые пассажир может использовать; помощь фактически не оказана.",
          },
        ],
      },
      {
        id: "v2",
        speaker: "Пассажир Серов",
        text: "Опишите, пожалуйста: сколько рядов до двери и где будет поворот?",
        timerSec: 12,
        options: [
          {
            id: "v2a",
            text: "Предложить сопровождение под руку до санузла, дополнительно описав маршрут по рядам",
            next: null,
            if: { all: [{ flag: "orientation_preference" }, { resource: { type: "serviceEntitlement", entitlement: "verbalOrientation" } }] },
            effects: { loyalty: 5, safety: 2 },
            correct: true,
            step: "solution",
            feedback: "На ходу поезда сопровождение безопаснее одного словесного описания; ориентиры дополняют помощь, а не заменяют её.",
          },
          {
            id: "v2b",
            text: "Попросить посмотреть на таблички у двери",
            next: null,
            effects: { loyalty: -7, safety: -2 },
            feedback: "Ответ игнорирует сообщённую потребность и не даёт безопасной ориентации.",
          },
        ],
      },
    ],
  };

  // Бесхозная вещь: не трогать, ограничить приближение и передать доклад начальнику поезда.
  const evItem: GameEvent = {
    id: "ev_item",
    title: "Бесхозная вещь",
    category: "security",
    actorId: "a_reporter",
    trigger: { type: "time", atSec: 75 },
    stage: "onboard",
    startNode: "i1",
    nodes: [
      {
        id: "i1",
        speaker: "Пассажирка Зайцева",
        text: "Под сиденьем 7C лежит сумка, уже полчаса никто к ней не подходит. Мне как-то не по себе.",
        timerSec: 15,
        onTimeout: { next: "i_bad", effects: { loyalty: -5, safety: -15 }, text: "Пассажиры начали собираться вокруг сумки" },
        options: [
          {
            id: "i1a",
            text: "«Благодарю за бдительность. Через начальника поезда передам просьбу спокойно уточнить принадлежность вещи по громкой связи»",
            next: "i2",
            effects: { loyalty: 5, safety: 5 },
            correct: true,
            step: "acknowledge",
          },
          {
            id: "i1b",
            text: "Подойти, открыть сумку и посмотреть, что внутри",
            next: "i2",
            effects: { loyalty: 0, safety: -25 },
            set: { item_touched: true },
            hint: "Не трогать вещь.",
            feedback: "Бесхозную вещь не трогают, не открывают и не переносят: действия координирует начальник поезда.",
          },
          {
            id: "i1c",
            text: "«Наверное, кто-то в бистро ушёл, не волнуйтесь»",
            next: "i_bad",
            effects: { loyalty: -5, safety: -15 },
            feedback: "Сигнал пассажира проигнорирован: владелец не установлен, угроза не оценена.",
          },
        ],
      },
      {
        id: "i2",
        speaker: "Обстановка",
        text: "Вы у места 7C. Рядом сидят пассажиры, кто-то уже тянется к сумке.",
        timerSec: 15,
        onTimeout: { next: "i3", effects: { loyalty: 0, safety: -10 }, text: "Пассажир успел сдвинуть сумку ногой" },
        options: [
          {
            id: "i2a",
            text: "«Уважаемые пассажиры, просьба не приближаться к предмету. Мы сейчас уточним принадлежность вещи»",
            next: "i3",
            effects: { loyalty: 5, safety: 10 },
            correct: true,
            step: "rule",
          },
          {
            id: "i2b",
            text: "Громко: «Всем срочно покинуть вагон, там может быть бомба!»",
            next: "i3",
            effects: { loyalty: -20, safety: -10 },
            feedback: "Паника в вагоне опаснее самой вещи: давка в проходе и тамбуре. Говорить спокойно и конкретно.",
          },
        ],
      },
      {
        id: "i3",
        speaker: "Рация",
        text: "Что передадите начальнику поезда?",
        timerSec: 15,
        options: [
          {
            id: "i3a",
            text: "«Начальник поезда, в 4-м вагоне у места 7C оставленная вещь. Пассажиров попросил не подходить. Прошу передать диспетчеру и организовать встречу ЛОВД на ближайшей станции»",
            next: "i4",
            effects: { loyalty: 0, safety: 15 },
            correct: true,
            step: "solution",
            set: { np_called: true },
            feedback: "Начальнику поезда переданы место, принятые меры и запрос на координацию с диспетчером и ЛОВД; пассажиры не привлекаются к разбору.",
          },
          {
            id: "i3b",
            text: "Отнести сумку в служебное отделение, а потом доложить",
            next: "i4",
            effects: { loyalty: 0, safety: -25 },
            set: { item_touched: true, np_called: true },
            feedback: "Переносить вещь нельзя: это риск для проводника и пассажиров по пути.",
          },
        ],
      },
      {
        id: "i4",
        kind: "information",
        speaker: "Пассажирка Зайцева",
        text: "Начальник поезда принял доклад и передал информацию диспетчеру. Пассажирам сообщено сохранять спокойствие и следовать рекомендациям персонала.",
        next: null,
        options: [],
      },
      {
        id: "i_bad",
        speaker: "Пассажир",
        text: "Чья это сумка?! Давайте её в тамбур вынесем, и дело с концом!",
        timerSec: 12,
        options: [
          {
            id: "iba",
            text: "«Прошу всех сохранять спокойствие и не приближаться к предмету. Мы сейчас уточним принадлежность вещи»",
            next: "i3",
            effects: { loyalty: 5, safety: 10 },
            correct: true,
            feedback: "Пассажиры остановлены до того, как тронули вещь; дальше — доклад по радиосвязи.",
          },
          {
            id: "ibb",
            text: "Разрешить пассажирам вынести сумку",
            next: null,
            effects: { loyalty: 0, safety: -25 },
            set: { item_touched: true },
            feedback: "Вещь переместили посторонние люди — худший из вариантов.",
          },
        ],
      },
    ],
  };

  const evStationArrival: GameEvent = {
    id: "ev_station_arrival",
    title: "Прибытие на ближайшую станцию",
    category: "security",
    actorId: null,
    trigger: { type: "time", atSec: 120 },
    stage: "alighting",
    startNode: "station_arrival",
    nodes: [{
      id: "station_arrival",
      kind: "information",
      speaker: "Обстановка",
      text: "Поезд прибыл на ближайшую станцию. Сведения о бесхозной вещи переданы встречающим службам.",
      next: null,
      set: { station_arrived: true },
      options: [],
    }],
  };

  // Последствие: вещь трогали — разбор проводится только после прибытия на станцию.
  const evPtb: GameEvent = {
    id: "ev_ptb",
    title: "Разбор бесхозной вещи на станции",
    category: "security",
    actorId: null,
    trigger: { type: "condition", if: { all: [{ flag: "item_touched" }, { flag: "station_arrived" }] } },
    stage: "complaint",
    startNode: "t1",
    nodes: [
      {
        id: "t1",
        speaker: "Сотрудник ЛОВД / службы безопасности на станции",
        text: "Вещь перемещали или открывали? Кто к ней прикасался?",
        timerSec: 15,
        options: [
          {
            id: "t1a",
            text: "Доложить честно и точно: кто, когда и что делал с вещью",
            next: null,
            effects: { loyalty: 0, safety: 10 },
            correct: true,
            feedback: "Точный доклад помогает встречающим службам оценить ситуацию. В следующий раз вещь не следует трогать до прибытия на станцию.",
          },
          {
            id: "t1b",
            text: "«Никто не трогал, она так и лежала»",
            next: null,
            effects: { loyalty: 0, safety: -20 },
            feedback: "Скрыть перемещение вещи опаснее всего: встречающие службы получают неверную информацию.",
          },
        ],
      },
    ],
  };

  const actors: Actor[] = [
    {
      id: "a_conductor",
      name: "Проводник (вы)",
      role: "conductor",
      ticket: null,
      spawn: { carId: car2.id, x: 1, y: 2 },
      mood: 100,
      steps: [],
    },
    {
      id: "a_bartender",
      name: "Бармен вагона-бистро",
      role: "bartender",
      ticket: null,
      spawn: { carId: car3.id, x: 3, y: 0 },
      mood: 80,
      steps: [],
    },
    {
      id: "a_wheelchair",
      name: "Громов",
      role: "passenger",
      accessibilityNeeds: ["wheelchair", "mobility"],
      ticket: { carId: car2.id, seat: "2A" },
      spawn: { carId: car2.id, x: 1, y: 2 },
      mood: 70,
      steps: [
        { type: "wait", seconds: 2 },
        { type: "say", text: "Подскажите, где место 2A?" },
        { type: "emit", eventId: "ev_wheelchair" },
        { type: "goto", target: { kind: "ownSeat" } },
        { type: "sit" },
      ],
    },
    {
      id: "a_guide_dog_owner",
      name: "Лебедева",
      role: "passenger",
      accessibilityNeeds: ["vision"],
      ticket: { carId: car2.id, seat: "5C" },
      spawn: { carId: car2.id, x: 6, y: 3 },
      mood: 80,
      steps: [{ type: "sit" }],
    },
    {
      id: "a_neighbour_dog",
      name: "Фомин",
      role: "passenger",
      ticket: { carId: car2.id, seat: "5D" },
      spawn: { carId: car2.id, x: car2.length - 1, y: 2 },
      mood: 60,
      steps: [
        { type: "wait", seconds: 25 },
        { type: "goto", target: { kind: "ownSeat" } },
        { type: "sit" },
        { type: "say", text: "Это ещё что за собака?!" },
        { type: "mood", delta: -15 },
        { type: "emit", eventId: "ev_guide_dog" },
      ],
    },
    {
      id: "a_hearing",
      name: "Андреева",
      role: "passenger",
      accessibilityNeeds: ["hearing"],
      ticket: { carId: car2.id, seat: "6A" },
      spawn: { carId: car2.id, x: 7, y: 0 },
      mood: 75,
      steps: [{ type: "sit" }],
    },
    {
      id: "a_vision",
      name: "Серов",
      role: "passenger",
      accessibilityNeeds: ["vision"],
      ticket: { carId: car2.id, seat: "7C" },
      spawn: { carId: car2.id, x: 8, y: 3 },
      mood: 75,
      steps: [{ type: "sit" }],
    },
    {
      id: "a_reporter",
      name: "Зайцева",
      role: "passenger",
      ticket: { carId: car4.id, seat: "8D" },
      spawn: { carId: car4.id, x: 9, y: 4 },
      mood: 70,
      steps: [{ type: "sit" }, { type: "wait", seconds: 70 }, { type: "mood", delta: -20 }],
    },
  ];

  return {
    version: 1,
    gameplay: "sequential",
    train: { name: "ВСМ «Сапсан-2» №705", cars: [car1, car2, car3, car4] },
    actors,
    events: [evWheelchair, evGuideDog, evHearing, evVision, evItem, evStationArrival, evPtb],
    durationSec: 150,
    initial: { loyalty: 70, safety: 80 },
    serviceEntitlements: {
      mealDelivery: true,
      mobilityAssistance: true,
      writtenCommunication: true,
      verbalOrientation: true,
    },
  };
}
