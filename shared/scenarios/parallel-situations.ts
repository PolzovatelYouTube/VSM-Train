import { type GameEvent } from "../scenario";
import { multiIncidentScenario } from "./multi-incident";

export const PARALLEL_SITUATIONS_SCENARIO_NAME = "Parallel situations — управление нагрузкой";

/** Отдельный синтетический сценарий. Стадии риска не выводятся из категории. */
export function parallelSituationsScenario() {
  const data = multiIncidentScenario();
  data.train.name = "Parallel situations: четыре обращения";
  data.durationSec = 80;
  // This variant supplies its own unattended-item branch below.
  data.events = data.events.filter((event) => event.id !== "unattended");
  const socket = data.events.find((ev) => ev.id === "socket")!;
  socket.severity = 0.5;
  socket.responseWindowSec = 45;
  socket.escalation!.afterSec = 45;

  const dispute = data.events.find((ev) => ev.id === "seat-dispute")!;
  dispute.severity = 2;
  dispute.escalation = { afterSec: 18, effects: { loyalty: -4, safety: -8 },
    text: "Пассажир толкнул соседа, проход остаётся перекрыт багажом.", set: { dispute_louder: true } };
  dispute.priorityRules = [{ afterSec: 10, severity: 4, urgency: "critical", responseWindowSec: 8,
    text: "Один пассажир толкает другого, багаж перекрывает проход." }];

  const medical = data.events.find((ev) => ev.id === "breathing")!;
  medical.title = "Пассажир сообщает о недомогании";
  medical.severity = 1;
  medical.urgency = "routine";
  medical.responseWindowSec = 20;
  medical.context = [{ flag: "medical_context_checked", label: "Наблюдаемые признаки уточнены" }];
  medical.priorityRules = [
    { afterSec: 8, severity: 5, urgency: "critical", responseWindowSec: 8,
      set: { medical_warning: true },
      text: "Пассажир побледнел, ему трудно дышать; сосед повторно зовёт проводника." },
    { if: { flag: "medical_context_checked" }, severity: 1, urgency: "routine", responseWindowSec: 20,
      text: "Немного болит голова. Пассажир говорит связно, дышит спокойно; наблюдение согласуется с ним." },
  ];
  medical.escalation = { afterSec: 16, nextEvent: "medical-worse", effects: { loyalty: -2, safety: -6 },
    set: { medical_worse: true }, text: "Пассажир осел в кресле. Помощь не организована до ухудшения." };
  medical.nodes = [
    { id: "breathing-start", kind: "decision", speaker: "Пассажир", text: "У меня немного болит голова. Можно к Вам обратиться?", options: [
      { id: "medical-clarify", text: "Уточнить состояние и наблюдаемые признаки", next: "medical-assessment", timeCostSec: 2,
        set: { medical_context_checked: true }, effects: { loyalty: 1, safety: 0 }, correct: true,
        feedback: "Контекст уточнён. Первые признаки умеренные; другие обращения могут требовать более быстрого вмешательства." },
      { id: "medical-delegate", text: "Попросить коллегу подойти к пассажиру и организовать наблюдение", next: null, timeCostSec: 2,
        set: { medical_observation_arranged: true }, effects: { loyalty: 0, safety: 2 }, correct: true,
        feedback: "Помощь передана конкретному коллеге; ситуация не оставлена без наблюдения." },
    ] },
    { id: "medical-assessment", kind: "decision", speaker: "Пассажир", text: "Признаки уточнены. Как организуете помощь?", options: [
      { id: "medical-monitor", text: "Согласовать наблюдение с коллегой, оставив понятный способ вызвать помощь", next: null, timeCostSec: 2,
        outcomes: [{ if: { flag: "medical_warning" }, correct: false, effects: { loyalty: -2, safety: -6 },
          feedback: "Признаки уже изменились: одного наблюдения недостаточно, нужна организация срочной помощи." }],
        set: { medical_observation_arranged: true }, effects: { loyalty: 2, safety: 2 }, correct: true },
      { id: "medical-call", text: "Остаться рядом и обратиться к начальнику поезда для организации медицинской помощи", next: null, timeCostSec: 3,
        set: { medical_help_arranged: true }, effects: { loyalty: 1, safety: 4 }, correct: true },
    ] },
  ];
  data.events.find((ev) => ev.id === "medical-worse")!.severity = 5;

  const unattended: GameEvent = {
    id: "unattended", title: "Сообщение о бесхозной вещи", category: "technical", actorId: "item-reporter",
    trigger: { type: "time", atSec: 45 }, severity: 5, urgency: "critical", responseWindowSec: 10,
    location: { carId: data.train.cars[2].id, x: 6, y: 0 },
    escalation: { afterSec: 10, effects: { loyalty: -3, safety: -12 }, set: { crowd_near_item: true },
      text: "Пассажиры собираются у вещи, один пытается её сдвинуть." },
    startNode: "item-report", nodes: [
      { id: "item-report", kind: "decision", speaker: "Пассажир", text: "У сиденья лежит сумка, владелец не откликается. К ней подходят люди.", options: [
        { id: "item-radio", text: "Не приближая людей к вещи, передать точное местоположение начальнику поезда и ПТБ", next: null,
          timeCostSec: 2, effects: { loyalty: 0, safety: 6 }, correct: true, set: { item_reported: true } },
        { id: "item-colleague", text: "Поручить коллеге ограничить приближение пассажиров, самому сразу доложить по рации", next: null,
          timeCostSec: 3, effects: { loyalty: -1, safety: 8 }, correct: true, set: { item_reported: true } },
      ] },
    ],
  };
  data.events.push(unattended);
  data.actors.push({ id: "item-reporter", name: "Кузнецова", role: "passenger", ticket: { carId: data.train.cars[2].id, seat: "5A" },
    spawn: { carId: data.train.cars[2].id, x: 6, y: 0 }, mood: 60, steps: [] });
  return data;
}
