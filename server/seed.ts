/**
 * Демо-оргструктура: 2 депо × 2 бригады × 5 проводников.
 * СИНТЕТИЧЕСКИЕ ДАННЫЕ: имена вымышлены, совпадения с реальными людьми случайны.
 * Реальных персональных данных сотрудников в демо-среде нет (152-ФЗ).
 */
import { db } from "./storage";
import { depots, teams, players, challenges, type ChallengeRule } from "@shared/schema";

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
