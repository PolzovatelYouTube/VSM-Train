/**
 * Демо-данные: 2 депо × 2 бригады × 5 проводников, челленджи и история рейсов.
 * СИНТЕТИЧЕСКИЕ ДАННЫЕ: имена вымышлены, совпадения с реальными людьми случайны.
 * Реальных персональных данных сотрудников в демо-среде нет (152-ФЗ).
 */
import { db, storage } from "./storage";
import { depots, teams, players, challenges, attempts, type ChallengeRule } from "@shared/schema";
import { scenarioDataSchema, type ScenarioData } from "@shared/scenario";
import { createSim, openNode, findNode, visibleOptions, chooseOption, timeoutDialogue, computeResult, evalCondition, resolveOutcome, effectiveNodeKind, continueInformation } from "@shared/engine";

const DEMO_STRUCTURE = [
  {
    depot: "Депо «Москва-ВСМ»",
    teams: [
      { name: "Бригада 1", conductors: ["Алина Рябова", "Денис Гончаров", "Ольга Миронова", "Тимур Сафин", "Ксения Лаптева"] },
      { name: "Бригада 2", conductors: ["Павел Ершов", "Марина Котова", "Илья Зуев", "Вера Никитина", "Руслан Галиев"] },
    ],
  },
  {
    depot: "Депо «Санкт-Петербург-ВСМ»",
    teams: [
      { name: "Бригада 3", conductors: ["Софья Белкина", "Артём Власов", "Нина Орехова", "Глеб Субботин", "Лилия Хасанова"] },
      { name: "Бригада 4", conductors: ["Егор Панов", "Дарья Смолина", "Максим Туров", "Элина Федосеева", "Роман Щукин"] },
    ],
  },
];

/** Заполняет оргструктуру один раз — при пустой таблице депо */
export function seedStructure() {
  if (db.select().from(depots).get()) return;
  for (const d of DEMO_STRUCTURE) {
    const depot = db.insert(depots).values({ name: d.depot }).returning().get();
    for (const t of d.teams) {
      const team = db.insert(teams).values({ name: t.name, depotId: depot.id }).returning().get();
      for (const name of t.conductors) {
        db.insert(players).values({ name, teamId: team.id }).onConflictDoNothing().run();
      }
    }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

const DEMO_CHALLENGES: { title: string; rule: ChallengeRule; days: number; rewardXp: number }[] = [
  { title: "Неделя медицины", rule: { type: "complete_category", category: "medical", count: 3 }, days: 7, rewardXp: 60 },
  { title: "Ни одного пропуска", rule: { type: "no_timeouts", count: 2 }, days: 5, rewardXp: 40 },
];

/** Демо-челленджи: стартовали вчера, чтобы на защите они были активны */
export function seedChallenges() {
  if (db.select().from(challenges).get()) return;
  const start = Date.now() - DAY_MS;
  for (const c of DEMO_CHALLENGES) {
    db.insert(challenges)
      .values({ title: c.title, rule: JSON.stringify(c.rule), startsAt: start, endsAt: start + c.days * DAY_MS, rewardXp: c.rewardXp })
      .run();
  }
}

// ───────────────────────────── Демо-история рейсов ─────────────────────────────

/** Детерминированный ГСЧ, чтобы демо-данные были одинаковыми при каждом запуске */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Прогоняет бота по диалогам сценария тем же движком, что и игрок:
 * с вероятностью skill выбирает верный вариант, с вероятностью lateness не успевает.
 */
function botRun(data: ScenarioData, rnd: () => number, skill: number, lateness: number) {
  const state = createSim(data);
  for (const ev of data.events) {
    if (ev.trigger.type === "condition" && !evalCondition(ev.trigger.if, state)) continue;
    openNode(state, data, ev.id, ev.startNode);
    while (state.active) {
      const node = findNode(data, state.active.eventId, state.active.nodeId);
      if (node && effectiveNodeKind(node, state) === "information") {
        continueInformation(state, data);
        continue;
      }
      const options = node ? visibleOptions(node, state) : [];
      const limitMs = (state.active.limitSec ?? node?.timerSec ?? 15) * 1000;
      if (!options.length || (node?.timerSec && rnd() < lateness)) {
        timeoutDialogue(state, data);
        state.log[state.log.length - 1].reactionMs = limitMs;
        continue;
      }
      const right = options.filter((o) => resolveOutcome(o, state).correct);
      const wrong = options.filter((o) => !resolveOutcome(o, state).correct);
      const pool = right.length && (rnd() < skill || !wrong.length) ? right : wrong;
      chooseOption(state, data, pool[Math.floor(rnd() * pool.length)]);
      state.log[state.log.length - 1].reactionMs = Math.round(limitMs * (0.2 + rnd() * (1.1 - skill)));
    }
  }
  return { log: state.log, result: computeResult(state, data) };
}

/** Демо-история: 3–9 рейсов у каждого синтетического проводника за последние 20 дней (часть баллов уже сгорела) */
export function seedDemoHistory() {
  if (db.select().from(attempts).get()) return;
  const list = storage.listScenarios().flatMap((s) => {
    const parsed = scenarioDataSchema.safeParse(JSON.parse(s.data));
    return parsed.success ? [{ id: s.id, data: parsed.data }] : [];
  });
  if (!list.length) return;
  const rnd = mulberry32(2026);
  const now = Date.now();
  for (const name of DEMO_STRUCTURE.flatMap((d) => d.teams.flatMap((t) => t.conductors))) {
    const skill = 0.45 + rnd() * 0.5;
    const lateness = 0.02 + rnd() * 0.18;
    const runs = 3 + Math.floor(rnd() * 7);
    const times = Array.from({ length: runs }, () => now - Math.floor(rnd() * 20 * DAY_MS)).sort((a, b) => a - b);
    for (const createdAt of times) {
      const sc = list[Math.floor(rnd() * list.length)];
      const { log, result } = botRun(sc.data, rnd, skill, lateness);
      storage.createAttempt(
        {
          playerName: name,
          scenarioId: sc.id,
          mode: rnd() < 0.7 ? "check" : "training",
          score: result.score,
          loyalty: result.loyalty,
          safety: result.safety,
          accuracy: result.accuracy,
          avgReactionMs: Math.round(result.avgReactionMs),
          competencies: result.competencies,
          log,
        },
        createdAt,
      );
    }
  }
}
