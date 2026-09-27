import { buildCar, type Actor, type GameEvent, type ScenarioData } from "../scenario";

// Ситуации из методички «Примеры ситуаций на посадке и на борту»: №4, №6, №28.
// Реплики «Сервисного общения» перенесены дословно, шаги размечены по ролевой модели.
// Шкалы влияют на ход рейса: лояльность < 30 открывает жалобу начальнику поезда,
// безопасность < 40 в ситуации №6 ведёт к вызову ПТБ. Имена пассажиров вымышленные.

export const ONBOARD_SCENARIO_NAME = "Ситуации на борту: питомец, нетрезвый пассажир, лекарство";

export function onboardScenario(): ScenarioData {
  const car1 = buildCar(1, "first", 6);
  const car2 = buildCar(2, "business", 8);
  const car3 = buildCar(3, "bistro", 6);
  const car4 = buildCar(4, "standard", 10);

  // №4 — питомец без переноски
  const evPet: GameEvent = {
    id: "ev_pet",
    title: "Питомец без переноски",
    category: "request",
    actorId: "a_pet_owner",
    trigger: { type: "actor" },
    stage: "onboard",
    startNode: "p1",
    nodes: [
      {
        id: "p1",
        speaker: "Пассажирка Орлова",
        text: "Это Бублик, он смирный, посидит у меня на коленях. Переноску я не брала — зачем она?",
        timerSec: 20,
        onTimeout: { next: "p5", effects: { loyalty: -10, safety: -5 }, text: "Пока проводник молчал, собака спрыгнула и побежала по проходу" },
        options: [
          {
            id: "p1a",
            text: "«Понимаю, Бублик у Вас очень спокойный. Давайте вместе устроим его так, чтобы ему было безопасно»",
            next: "p2",
            effects: { loyalty: 5, safety: 0 },
            correct: true,
            step: "acknowledge",
            hint: "Спокойно разобраться в ситуации: пассажир должен понимать, что о нём заботятся, а не отчитывают.",
          },
          {
            id: "p1b",
            text: "«Обращаю Ваше внимание, что провоз питомцев осуществляется только в переноске»",
            next: "p3",
            effects: { loyalty: 0, safety: 5 },
            step: "rule",
          },
          {
            id: "p1c",
            text: "«Вы нарушаете правила. Уберите собаку или выходите на следующей станции»",
            next: "p5",
            effects: { loyalty: -20, safety: 0 },
          },
        ],
      },
      {
        id: "p2",
        speaker: "Пассажирка Орлова",
        text: "А что с ним может случиться? Он же у меня на руках.",
        timerSec: 20,
        options: [
          {
            id: "p2a",
            text: "«Провоз питомцев осуществляется только в переноске, это необходимо для безопасного нахождения питомцев на борту»",
            next: "p3",
            effects: { loyalty: 5, safety: 5 },
            correct: true,
            step: "rule",
          },
          {
            id: "p2b",
            text: "Зачитать все пункты правил перевозки животных, размеры переносок и штрафы",
            next: "p3",
            effects: { loyalty: -10, safety: 5 },
            step: "rule",
            hint: "Не перегружать пассажира излишней информацией.",
          },
        ],
      },
      {
        id: "p3",
        speaker: "Пассажирка Орлова",
        text: "Ну хорошо, а где я её сейчас возьму?",
        timerSec: 20,
        onTimeout: { next: "p5", effects: { loyalty: -10, safety: 0 }, text: "Пассажирка решила, что переноски нет, и отказалась что-либо делать" },
        options: [
          {
            id: "p3a",
            text: "«Вы можете приобрести переноску на борту нашего поезда. Я принесу её прямо к Вашему месту»",
            next: "p4",
            effects: { loyalty: 10, safety: 10 },
            correct: true,
            step: "solution",
            set: { carrier_offered: true },
          },
          {
            id: "p3b",
            text: "«Это уже Ваша забота, надо было думать до посадки»",
            next: "p5",
            effects: { loyalty: -15, safety: 0 },
          },
        ],
      },
      {
        id: "p4",
        speaker: "Пассажирка Орлова",
        text: "Спасибо, давайте. Бублик, потерпи немножко.",
        options: [
          {
            id: "p4a",
            text: "«Прошу Вас разместить питомца в переноске. Если Бублику понадобится вода — скажите, я принесу»",
            next: null,
            effects: { loyalty: 10, safety: 5 },
            correct: true,
            step: "assure",
          },
        ],
      },
      {
        id: "p5",
        speaker: "Пассажирка Орлова",
        text: "Не буду я ничего покупать и никуда его сажать!",
        timerSec: 20,
        options: [
          {
            id: "p5a",
            text: "Предложить ещё раз: «Переноску можно приобрести прямо сейчас на борту, это займёт пару минут»",
            next: "p4",
            effects: { loyalty: 5, safety: 5 },
            correct: true,
            step: "solution",
            if: { flag: "carrier_offered" },
          },
          {
            id: "p5b",
            text: "Спокойно сообщить, что приглашаете начальника поезда для урегулирования, и вызвать его",
            next: null,
            effects: { loyalty: -5, safety: 10 },
            correct: true,
            set: { np_called: true },
            hint: "При отказе — вызвать начальника поезда.",
          },
          {
            id: "p5c",
            text: "Забрать собаку и отнести её в тамбур",
            next: null,
            effects: { loyalty: -25, safety: -15 },
          },
        ],
      },
    ],
  };

  // №6 — пассажир с признаками алкогольного опьянения
  const evDrunk: GameEvent = {
    id: "ev_drunk",
    title: "Пассажир с признаками опьянения",
    category: "conflict",
    actorId: "a_drunk",
    trigger: { type: "actor" },
    stage: "onboard",
    startNode: "d1",
    nodes: [
      {
        id: "d1",
        speaker: "Пассажир Кузнецов",
        text: "(громко, с запахом алкоголя) Командир! Сделай музыку погромче, мы тут отдыхаем!",
        timerSec: 15,
        onTimeout: { next: "d3", effects: { loyalty: -5, safety: -15 }, text: "Пассажир начал задевать соседей" },
        options: [
          {
            id: "d1a",
            text: "Подойти, спокойно оценить обстановку (агрессия, риск для него и соседей): «Вижу, настроение отличное. Давайте я помогу Вам устроиться»",
            next: "d2",
            effects: { loyalty: 0, safety: 5 },
            correct: true,
            step: "acknowledge",
            hint: "Сначала оценить безопасность: агрессия, нарушение порядка, риск для себя и других.",
          },
          {
            id: "d1b",
            text: "«Вы пьяны! Немедленно успокойтесь, или Вас высадят»",
            next: "d3",
            effects: { loyalty: -15, safety: -15 },
          },
          {
            id: "d1c",
            text: "Не обращать внимания и продолжить обход",
            next: "d3",
            effects: { loyalty: -10, safety: -20 },
          },
        ],
      },
      {
        id: "d2",
        speaker: "Пассажир Кузнецов",
        text: "А чё такого? Я никому не мешаю!",
        timerSec: 15,
        onTimeout: { next: "d3", effects: { loyalty: 0, safety: -10 }, text: "Пассажир встал и пошёл по вагону" },
        options: [
          {
            id: "d2a",
            text: "«Прошу Вас соблюдать спокойствие и не создавать неудобств другим пассажирам»",
            next: "d4",
            effects: { loyalty: 5, safety: 10 },
            correct: true,
            step: "rule",
          },
          {
            id: "d2b",
            text: "Вступить в спор: «Мешаете, и ещё как! Вот соседи жалуются»",
            next: "d3",
            effects: { loyalty: -10, safety: -10 },
            hint: "Не вступать в спор.",
          },
        ],
      },
      {
        id: "d3",
        speaker: "Пассажир Кузнецов",
        text: "(встаёт и толкает соседа) Да вы кто такие вообще, чтобы мне указывать?!",
        timerSec: 12,
        onTimeout: { next: "d_ptb", effects: { loyalty: -5, safety: -20 }, text: "Конфликт перешёл в потасовку" },
        options: [
          {
            id: "d3a",
            text: "Не вступать в спор, встать между пассажирами, отсадить соседей и сообщить начальнику поезда",
            next: "d4",
            nextIf: [{ if: { safety: { lt: 40 } }, next: "d_ptb" }],
            effects: { loyalty: 0, safety: 10 },
            correct: true,
            step: "solution",
          },
          {
            id: "d3b",
            text: "Попытаться вывести пассажира из вагона силой",
            next: "d_ptb",
            effects: { loyalty: -10, safety: -20 },
          },
        ],
      },
      {
        id: "d4",
        speaker: "Рация",
        text: "Нужно сообщить начальнику поезда. Что вы скажете в эфир — пассажир стоит рядом и всё слышит?",
        timerSec: 15,
        options: [
          {
            id: "d4a",
            text: "«Начальник поезда, прошу подойти в 4-й вагон: пассажир нарушает порядок, нужна ваша помощь»",
            next: "d5",
            nextIf: [{ if: { safety: { lt: 40 } }, next: "d_ptb" }],
            effects: { loyalty: 5, safety: 10 },
            correct: true,
            step: "solution",
            set: { np_called: true },
            hint: "По рации не говорить, что пассажир пьян, — это провоцирует агрессию.",
          },
          {
            id: "d4b",
            text: "«В четвёртом пьяный буянит, срочно сюда»",
            next: "d_ptb",
            effects: { loyalty: -10, safety: -25 },
            set: { np_called: true },
            hint: "Критическая ошибка: пассажир слышит, что его называют пьяным.",
          },
        ],
      },
      {
        id: "d5",
        speaker: "Начальник поезда",
        text: "Иду. Оставайтесь рядом, следите за соседями и оборудованием.",
        options: [
          {
            id: "d5a",
            text: "Заверить соседей: «Всё под контролем, начальник поезда уже идёт. Если хотите, пересажу Вас»",
            next: null,
            effects: { loyalty: 10, safety: 5 },
            correct: true,
            step: "assure",
          },
        ],
      },
      {
        id: "d_ptb",
        speaker: "Начальник поезда",
        text: "Ситуация выходит из-под контроля — вызываю ПТБ. Ваши действия до их прихода?",
        timerSec: 12,
        options: [
          {
            id: "d6a",
            text: "Обеспечить безопасность соседей: отсадить их, не вступать в контакт, следить за оборудованием; при необходимости — ЛОВД на ближайшей станции",
            next: null,
            effects: { loyalty: 5, safety: 15 },
            correct: true,
            set: { ptb_called: true },
          },
          {
            id: "d6b",
            text: "Самому удерживать пассажира до прихода ПТБ",
            next: null,
            effects: { loyalty: -5, safety: -20 },
          },
        ],
      },
    ],
  };

  // №28 — пассажир просит лекарство
  const evMedicine: GameEvent = {
    id: "ev_medicine",
    title: "Просьба дать лекарство",
    category: "medical",
    actorId: "a_headache",
    trigger: { type: "time", atSec: 70 },
    stage: "onboard",
    startNode: "m1",
    context: [
      { flag: "condition_checked", label: "Динамика состояния уточнена" },
      { flag: "condition_worsening", label: "Состояние ухудшается" },
      { flag: "np_called", label: "Начальник поезда уведомлён" },
      { flag: "medic_found", label: "Медработник среди пассажиров откликнулся" },
    ],
    nodes: [
      {
        id: "m1",
        speaker: "Пассажирка Белова",
        text: "Простите, у вас не найдётся таблетки? Голова раскалывается.",
        timerSec: 20,
        onTimeout: { next: "m5", effects: { loyalty: -10, safety: -10 }, text: "Пассажирке стало хуже" },
        options: [
          {
            id: "m1a",
            text: "«Сочувствую, сейчас помогу. Подскажите, что именно беспокоит, усиливается ли это и бывало ли такое раньше?»",
            next: "m2",
            effects: { loyalty: 3, safety: 3 },
            correct: true,
            step: "acknowledge",
            timeCostSec: 4,
            set: { condition_checked: true },
            hint: "Выяснить причину недомогания.",
          },
          {
            id: "m1b",
            text: "Дать таблетку из своей личной аптечки",
            next: "m_bad",
            effects: { loyalty: 5, safety: -30 },
            set: { gave_pills: true },
          },
          {
            id: "m1c",
            text: "Спросить таблетку у коллеги из соседнего вагона",
            next: "m_bad",
            effects: { loyalty: 0, safety: -20 },
            set: { gave_pills: true },
          },
        ],
      },
      {
        id: "m2",
        speaker: "Пассажирка Белова",
        text: "Давление, наверное. Обычно я пью своё, а сегодня забыла дома. Сейчас сильнее кружится голова.",
        timerSec: 20,
        options: [
          {
            id: "m2a",
            text: "Уточнить, усиливается ли головокружение, и сообщить, что личные препараты не выдаются",
            next: "m3",
            effects: { loyalty: 1, safety: 2 },
            correct: true,
            step: "rule",
            timeCostSec: 4,
            set: { condition_worsening: true },
            feedback: "Динамика уточнена: состояние ухудшается. Разговор занимает время и требует следующего решения, а не автоматически завершает помощь.",
          },
          {
            id: "m2b",
            text: "Посоветовать потерпеть до конечной станции",
            next: null,
            effects: { loyalty: -15, safety: -15 },
          },
        ],
      },
      {
        id: "m3",
        speaker: "Пассажирка Белова",
        text: "Воды, пожалуйста. Но голова всё равно болит и сильнее кружится…",
        timerSec: 20,
        onTimeout: { next: "m5", effects: { loyalty: -5, safety: -10 }, text: "Пассажирка осталась без помощи и побледнела" },
        options: [
          {
            id: "m3a",
            text: "Уведомить начальника поезда, объявить по громкой связи поиск медработника среди пассажиров, запросить медиков на ближайшую станцию",
            next: "m4",
            effects: { loyalty: 3, safety: 10 },
            correct: true,
            step: "solution",
            set: { np_called: true },
            outcomes: [{ if: { flag: "condition_worsening" }, correct: true, effects: { loyalty: 1, safety: 15 }, feedback: "Состояние ухудшается: уведомление, поиск медработника и запрос медиков становятся более срочными. На уточнение уже потрачено время." }],
          },
          {
            id: "m3b",
            text: "Начальник поезда уже в курсе — объявить поиск медработника и передать, что состояние ухудшается",
            next: "m4",
            effects: { loyalty: 2, safety: 12 },
            correct: true,
            step: "solution",
            if: { flag: "np_called" },
          },
          {
            id: "m3c",
            text: "Принести воды и вернуться к своим делам",
            next: null,
            effects: { loyalty: -5, safety: -15 },
          },
        ],
      },
      {
        id: "m4",
        speaker: "Пассажирка Белова",
        text: "На объявление откликнулся медработник среди пассажиров. Состояние пока не стабилизировалось.",
        options: [
          {
            id: "m4a",
            text: "Передать медработнику наблюдения, остаться рядом и согласовать дальнейшие действия с начальником поезда",
            next: null,
            effects: { loyalty: 6, safety: 8 },
            correct: true,
            step: "assure",
            set: { medic_found: true },
            outcomes: [{ if: { all: [{ flag: "condition_worsening" }, { flag: "np_called" }] }, correct: true, effects: { loyalty: 4, safety: 12 }, feedback: "Медработник найден, начальник поезда уже в курсе, а помощь координируется с учётом ухудшения. Идеального исхода нет: доверие тревожной пассажирки восстанавливается постепенно." }],
          },
        ],
      },
      {
        id: "m5",
        speaker: "Пассажирка Белова",
        text: "(бледнеет и хватается за подлокотник) Мне совсем нехорошо…",
        timerSec: 12,
        options: [
          {
            id: "m5a",
            text: "Остаться рядом, уведомить начальника поезда, объявить поиск медработника и вызвать медиков на ближайшую станцию",
            next: "m4",
            effects: { loyalty: 5, safety: 15 },
            correct: true,
            step: "solution",
            set: { np_called: true },
          },
        ],
      },
      {
        id: "m_bad",
        speaker: "Начальник поезда",
        text: "Личные препараты выдавать нельзя: мы не знаем, какая будет реакция, а ответственность ляжет на нас. Что делаете дальше?",
        timerSec: 15,
        options: [
          {
            id: "mba",
            text: "Остаться с пассажиркой, объявить поиск медработника среди пассажиров, вызвать медиков на ближайшую станцию",
            next: null,
            effects: { loyalty: 5, safety: 10 },
            correct: true,
            step: "solution",
          },
          {
            id: "mbb",
            text: "Ничего не предпринимать — таблетка должна помочь",
            next: null,
            effects: { loyalty: 0, safety: -20 },
          },
        ],
      },
    ],
  };

  // Последствие низкой лояльности в любой из ситуаций
  const evComplaint: GameEvent = {
    id: "ev_complaint",
    title: "Жалоба начальнику поезда",
    category: "request",
    actorId: null,
    trigger: { type: "condition", if: { loyalty: { lt: 30 } } },
    stage: "complaint",
    startNode: "c1",
    nodes: [
      {
        id: "c1",
        speaker: "Начальник поезда",
        text: "Пассажир написал жалобу на обслуживание в вашем вагоне. Как будете исправлять ситуацию?",
        timerSec: 20,
        options: [
          {
            id: "c1a",
            text: "Лично подойти к пассажиру, извиниться за доставленные неудобства и выяснить, что именно не устроило",
            next: "c2",
            effects: { loyalty: 10, safety: 0 },
            correct: true,
            step: "acknowledge",
          },
          {
            id: "c1b",
            text: "Объяснить начальнику поезда, что пассажир сам виноват",
            next: null,
            effects: { loyalty: -10, safety: 0 },
          },
        ],
      },
      {
        id: "c2",
        speaker: "Пассажир",
        text: "Ну, хоть кто-то выслушал.",
        options: [
          {
            id: "c2a",
            text: "Предложить решение по сути претензии и заверить, что вопрос на контроле до конца поездки",
            next: null,
            effects: { loyalty: 10, safety: 0 },
            correct: true,
            step: "assure",
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
    id: "a_pet_owner",
    name: "Орлова",
    // Не passenger: у обычного passenger проблемный набор PNG-поз.
    // elderly даёт стабильный stand/sit-спрайт.
    role: "elderly",
    ticket: { carId: car2.id, seat: "4C" },
    // Спавн только в проходе/у двери, а не на кресле.
    spawn: { carId: car2.id, x: car2.length - 1, y: 2 },
    mood: 70,
    steps: [
      { type: "wait", seconds: 2 },
      { type: "goto", target: { kind: "ownSeat" } },
      { type: "sit" },
      { type: "say", text: "Бублик, сиди смирно." },
      { type: "wait", seconds: 3 },
      { type: "emit", eventId: "ev_pet" },
    ],
  },

  {
    id: "a_drunk",
    name: "Кузнецов",
    // Не passenger: troublemaker нужен для конфликтной сцены
    // и не должен использовать проблемный стандартный passenger-спрайт.
    role: "troublemaker",
    ticket: { carId: car4.id, seat: "6B" },
    // Стартуем непосредственно на его месте — sit будет корректно
    // привязан к 6B, а не к соседней клетке.
    spawn: { carId: car4.id, x: 7, y: 1 },
    mood: 50,
    steps: [
      { type: "sit" },
      { type: "wait", seconds: 30 },
      // Встаёт в проход, а не на другом сиденье.
      { type: "goto", target: { kind: "cell", carId: car4.id, x: 7, y: 3 } },
      { type: "say", text: "Эй! Где тут музыку погромче делают?!" },
      { type: "mood", delta: -20 },
      { type: "emit", eventId: "ev_drunk" },
    ],
  },

  {
    id: "a_neighbour",
    name: "Смирнов",
    // elderly вместо passenger: гарантированно нормальная посадка.
    role: "elderly",
    ticket: { carId: car4.id, seat: "6A" },
    spawn: { carId: car4.id, x: 7, y: 0 },
    mood: 80,
    steps: [{ type: "sit" }],
  },

  {
    id: "a_headache",
    name: "Белова",
    // Уже правильная роль: для elderly предусмотрены stand/sit-кадры.
    role: "elderly",
    ticket: { carId: car1.id, seat: "3B" },
    spawn: { carId: car1.id, x: 4, y: 2 },
    mood: 60,
    steps: [
      { type: "sit" },
      { type: "wait", seconds: 68 },
      { type: "mood", delta: -30 },
      { type: "say", text: "Голова раскалывается…" },
      { type: "emit", eventId: "ev_medicine" },
    ],
  },
];

  return {
    version: 1,
    gameplay: "sequential",
    train: { name: "ВСМ «Сапсан-2» №703", cars: [car1, car2, car3, car4] },
    actors,
    events: [evPet, evDrunk, evMedicine, evComplaint],
    durationSec: 150,
    initial: { loyalty: 70, safety: 80 },
  };
}
