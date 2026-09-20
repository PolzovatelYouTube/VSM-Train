import {
  scenarios,
  players,
  attempts,
  type ScenarioRow,
  type InsertScenario,
  type Player,
  type Attempt,
  type InsertAttempt,
  type Achievement,
  type PlayerProfile,
  type LeaderboardEntry,
} from "@shared/schema";
import { demoScenario } from "@shared/scenario";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite);

// Создаём таблицы при старте (без отдельного шага миграций — удобно для хакатона)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  difficulty INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  training_points INTEGER NOT NULL DEFAULT 0,
  practice_points INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  scenario_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  score INTEGER NOT NULL,
  loyalty INTEGER NOT NULL,
  safety INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  avg_reaction_ms INTEGER NOT NULL,
  competencies TEXT NOT NULL,
  log TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

export interface IStorage {
  listScenarios(): ScenarioRow[];
  getScenario(id: number): ScenarioRow | undefined;
  createScenario(s: InsertScenario): ScenarioRow;
  updateScenario(id: number, s: InsertScenario): ScenarioRow | undefined;
  deleteScenario(id: number): void;

  getOrCreatePlayer(name: string): Player;
  getProfile(name: string): PlayerProfile | undefined;
  createAttempt(a: InsertAttempt): Attempt;
  listAttempts(playerName?: string): Attempt[];
  leaderboard(): LeaderboardEntry[];
}

export class DatabaseStorage implements IStorage {
  listScenarios() {
    return db.select().from(scenarios).orderBy(desc(scenarios.updatedAt)).all();
  }
  getScenario(id: number) {
    return db.select().from(scenarios).where(eq(scenarios.id, id)).get();
  }
  createScenario(s: InsertScenario) {
    return db
      .insert(scenarios)
      .values({
        name: s.name,
        description: s.description,
        difficulty: s.difficulty,
        data: JSON.stringify(s.data),
        updatedAt: Date.now(),
      })
      .returning()
      .get();
  }
  updateScenario(id: number, s: InsertScenario) {
    return db
      .update(scenarios)
      .set({
        name: s.name,
        description: s.description,
        difficulty: s.difficulty,
        data: JSON.stringify(s.data),
        updatedAt: Date.now(),
      })
      .where(eq(scenarios.id, id))
      .returning()
      .get();
  }
  deleteScenario(id: number) {
    db.delete(scenarios).where(eq(scenarios.id, id)).run();
  }

  getOrCreatePlayer(name: string) {
    const existing = db.select().from(players).where(eq(players.name, name)).get();
    if (existing) return existing;
    return db.insert(players).values({ name }).returning().get();
  }

  createAttempt(a: InsertAttempt) {
    const player = this.getOrCreatePlayer(a.playerName);
    const row = db
      .insert(attempts)
      .values({
        playerId: player.id,
        scenarioId: a.scenarioId,
        mode: a.mode,
        score: a.score,
        loyalty: a.loyalty,
        safety: a.safety,
        accuracy: a.accuracy,
        avgReactionMs: a.avgReactionMs,
        competencies: JSON.stringify(a.competencies),
        log: JSON.stringify(a.log),
        createdAt: Date.now(),
      })
      .returning()
      .get();

    // Баллы обучения — за любое прохождение тренировки, баллы практики — только за проверочный рейс
    if (a.mode === "training") {
      db.update(players)
        .set({ trainingPoints: player.trainingPoints + Math.max(10, Math.round(a.score / 2)) })
        .where(eq(players.id, player.id))
        .run();
    } else {
      db.update(players)
        .set({ practicePoints: player.practicePoints + a.score })
        .where(eq(players.id, player.id))
        .run();
    }
    return row;
  }

  listAttempts(playerName?: string) {
    if (!playerName) return db.select().from(attempts).orderBy(desc(attempts.createdAt)).all();
    const p = db.select().from(players).where(eq(players.name, playerName)).get();
    if (!p) return [];
    return db.select().from(attempts).where(eq(attempts.playerId, p.id)).orderBy(desc(attempts.createdAt)).all();
  }

  getProfile(name: string): PlayerProfile | undefined {
    const p = db.select().from(players).where(eq(players.name, name)).get();
    if (!p) return undefined;
    const rows = this.listAttempts(name);
    const bestScore = rows.reduce((m, r) => Math.max(m, r.score), 0);
    return { ...p, attempts: rows.length, bestScore, achievements: computeAchievements(rows) };
  }

  leaderboard(): LeaderboardEntry[] {
    const ps = db.select().from(players).all();
    return ps
      .map((p) => {
        const rows = db.select().from(attempts).where(eq(attempts.playerId, p.id)).all();
        return {
          name: p.name,
          trainingPoints: p.trainingPoints,
          practicePoints: p.practicePoints,
          attempts: rows.length,
          bestScore: rows.reduce((m, r) => Math.max(m, r.score), 0),
        };
      })
      .sort((a, b) => b.practicePoints - a.practicePoints || b.trainingPoints - a.trainingPoints);
  }
}

function computeAchievements(rows: Attempt[]): Achievement[] {
  const checks = rows.filter((r) => r.mode === "check");
  return [
    {
      id: "first_run",
      title: "Первый рейс",
      description: "Пройти любой сценарий",
      unlocked: rows.length > 0,
    },
    {
      id: "safety_first",
      title: "Безопасность превыше всего",
      description: "Завершить рейс с рейтингом безопасности 90+",
      unlocked: rows.some((r) => r.safety >= 90),
    },
    {
      id: "diplomat",
      title: "Дипломат",
      description: "Лояльность пассажиров 90+ по итогам рейса",
      unlocked: rows.some((r) => r.loyalty >= 90),
    },
    {
      id: "lightning",
      title: "Молния",
      description: "Средняя реакция быстрее 5 секунд",
      unlocked: rows.some((r) => r.avgReactionMs > 0 && r.avgReactionMs < 5000),
    },
    {
      id: "flawless",
      title: "Без ошибок",
      description: "Все решения верные в проверочном рейсе",
      unlocked: checks.some((r) => r.accuracy >= 0.999),
    },
    {
      id: "veteran",
      title: "Ветеран ВСМ",
      description: "10 пройденных рейсов",
      unlocked: rows.length >= 10,
    },
  ];
}

export const storage = new DatabaseStorage();

/** Первый запуск: если сценариев нет — добавляем демо */
export function seedIfEmpty() {
  if (storage.listScenarios().length === 0) {
    storage.createScenario({
      name: "Демо: рейс Москва — Санкт-Петербург",
      description:
        "Три вагона, шесть акторов, три события: спор за место, медицинский инцидент, просьба VIP-пассажира.",
      difficulty: 1,
      data: demoScenario(),
    });
  }
}
