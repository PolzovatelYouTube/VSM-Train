import {
  scenarios,
  depots,
  teams,
  players,
  attempts,
  challenges,
  challengeCompletions,
  challengeRuleSchema,
  type ChallengeProgress,
  type ScenarioRow,
  type InsertScenario,
  type Player,
  type Depot,
  type Team,
  type Attempt,
  type InsertAttempt,
  type Achievement,
  type PlayerProfile,
  type LeaderboardEntry,
} from "@shared/schema";
import { demoScenario } from "@shared/scenario";
import { onboardScenario, ONBOARD_SCENARIO_NAME } from "@shared/scenarios/onboard";
import { TRAINING_POINTS, PRACTICE_POINTS, ACHIEVEMENT_THRESHOLDS as T } from "@shared/rules";
import {
  xpForAttempt,
  levelFor,
  activePoints,
  expiringPoints,
  challengeProgress,
  describeRule,
  type ProgressRow,
} from "@shared/gamification";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and, lte, gte } from "drizzle-orm";

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
CREATE TABLE IF NOT EXISTS depots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  depot_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  rule TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  reward_xp INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS challenge_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  UNIQUE (challenge_id, player_id)
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

/** Добавить колонку в уже существующую таблицу (база могла быть создана прошлой версией) */
function ensureColumn(table: string, column: string, ddl: string, backfill?: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  if (backfill) sqlite.exec(backfill);
}
ensureColumn("players", "team_id", "INTEGER");
ensureColumn("players", "xp", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("attempts", "xp", "INTEGER NOT NULL DEFAULT 0");
// старые проверочные рейсы получают баллы по текущему правилу
ensureColumn(
  "attempts",
  "points",
  "INTEGER NOT NULL DEFAULT 0",
  `UPDATE attempts SET points = ROUND(score * ${PRACTICE_POINTS.share}) WHERE mode = 'check'`,
);

export interface IStorage {
  listScenarios(): ScenarioRow[];
  getScenario(id: number): ScenarioRow | undefined;
  createScenario(s: InsertScenario): ScenarioRow;
  updateScenario(id: number, s: InsertScenario): ScenarioRow | undefined;
  deleteScenario(id: number): void;

  listDepots(): Depot[];
  listTeams(): Team[];
  getOrCreatePlayer(name: string): Player;
  getProfile(name: string): PlayerProfile | undefined;
  createAttempt(a: InsertAttempt): Attempt;
  challengesFor(playerId: number): ChallengeProgress[];
  awardChallenges(playerId: number): ChallengeProgress[];
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

  listDepots() {
    return db.select().from(depots).all();
  }
  listTeams() {
    return db.select().from(teams).all();
  }

  /** Новый проводник без бригады попадает в первую бригаду — чтобы сразу участвовать в рейтинге бригады и депо */
  getOrCreatePlayer(name: string) {
    const existing = db.select().from(players).where(eq(players.name, name)).get();
    if (existing) return existing;
    const firstTeam = db.select().from(teams).orderBy(teams.id).get();
    return db.insert(players).values({ name, teamId: firstTeam?.id ?? null }).returning().get();
  }

  createAttempt(a: InsertAttempt) {
    const player = this.getOrCreatePlayer(a.playerName);
    const xp = xpForAttempt(a.mode, a.score);
    const points = a.mode === "check" ? practicePointsFor(a.score) : 0;
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
        xp,
        points,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    // Баллы обучения — за любое прохождение тренировки, баллы практики — только за проверочный рейс.
    // Опыт (xp) — за любую попытку, он не сгорает и определяет уровень.
    if (a.mode === "training") {
      db.update(players)
        .set({ trainingPoints: player.trainingPoints + trainingPointsFor(a.score), xp: player.xp + xp })
        .where(eq(players.id, player.id))
        .run();
    } else {
      db.update(players)
        .set({ practicePoints: player.practicePoints + points, xp: player.xp + xp })
        .where(eq(players.id, player.id))
        .run();
    }
    this.awardChallenges(player.id);
    return row;
  }

  /** Челленджи, активные сейчас, с прогрессом игрока */
  challengesFor(playerId: number): ChallengeProgress[] {
    const now = Date.now();
    const active = db.select().from(challenges).where(and(lte(challenges.startsAt, now), gte(challenges.endsAt, now))).all();
    const rows: ProgressRow[] = db
      .select()
      .from(attempts)
      .where(eq(attempts.playerId, playerId))
      .all()
      .map((r) => ({ score: r.score, createdAt: r.createdAt, log: JSON.parse(r.log) }));
    return active.map((c) => {
      const rule = challengeRuleSchema.parse(JSON.parse(c.rule));
      return { ...c, description: describeRule(rule), ...challengeProgress(rule, c, rows) };
    });
  }

  /** Начислить опыт за челленджи, выполненные этой попыткой. Возвращает только что выполненные. */
  awardChallenges(playerId: number): ChallengeProgress[] {
    const already = new Set(
      db.select().from(challengeCompletions).where(eq(challengeCompletions.playerId, playerId)).all().map((c) => c.challengeId),
    );
    const fresh = this.challengesFor(playerId).filter((c) => c.done && !already.has(c.id));
    for (const c of fresh) {
      db.insert(challengeCompletions).values({ challengeId: c.id, playerId, completedAt: Date.now() }).run();
      const p = db.select().from(players).where(eq(players.id, playerId)).get()!;
      db.update(players).set({ xp: p.xp + c.rewardXp }).where(eq(players.id, playerId)).run();
    }
    return fresh;
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
    const now = Date.now();
    return {
      ...p,
      level: levelFor(p.xp),
      activePoints: activePoints(rows, now),
      expiring: expiringPoints(rows, now),
      challenges: this.challengesFor(p.id),
      attempts: rows.length,
      bestScore,
      achievements: computeAchievements(rows),
    };
  }

  leaderboard(): LeaderboardEntry[] {
    const ps = db.select().from(players).all();
    const now = Date.now();
    return ps
      .map((p) => {
        const rows = db.select().from(attempts).where(eq(attempts.playerId, p.id)).all();
        const level = levelFor(p.xp);
        return {
          name: p.name,
          xp: p.xp,
          level: level.level,
          levelTitle: level.title,
          activePoints: activePoints(rows, now),
          trainingPoints: p.trainingPoints,
          practicePoints: p.practicePoints,
          attempts: rows.length,
          bestScore: rows.reduce((m, r) => Math.max(m, r.score), 0),
        };
      })
      .sort((a, b) => b.activePoints - a.activePoints || b.xp - a.xp);
  }
}

export const trainingPointsFor = (score: number) =>
  Math.max(TRAINING_POINTS.min, Math.round(score * TRAINING_POINTS.share));
export const practicePointsFor = (score: number) => Math.round(score * PRACTICE_POINTS.share);

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
      description: `Завершить рейс с рейтингом безопасности ${T.safetyFirst}+`,
      unlocked: rows.some((r) => r.safety >= T.safetyFirst),
    },
    {
      id: "diplomat",
      title: "Дипломат",
      description: `Лояльность пассажиров ${T.diplomat}+ по итогам рейса`,
      unlocked: rows.some((r) => r.loyalty >= T.diplomat),
    },
    {
      id: "lightning",
      title: "Молния",
      description: `Средняя реакция быстрее ${T.lightningMs / 1000} секунд`,
      unlocked: rows.some((r) => r.avgReactionMs > 0 && r.avgReactionMs < T.lightningMs),
    },
    {
      id: "flawless",
      title: "Без ошибок",
      description: "Все решения верные в проверочном рейсе",
      unlocked: checks.some((r) => r.accuracy >= T.flawlessAccuracy),
    },
    {
      id: "veteran",
      title: "Ветеран ВСМ",
      description: `${T.veteranRuns} пройденных рейсов`,
      unlocked: rows.length >= T.veteranRuns,
    },
  ];
}

export const storage = new DatabaseStorage();

const SEED_SCENARIOS = [
  {
    name: "Демо: рейс Москва — Санкт-Петербург",
    description:
      "Три вагона, шесть акторов, три события: спор за место, медицинский инцидент, просьба VIP-пассажира.",
    difficulty: 1,
    data: demoScenario,
  },
  {
    name: ONBOARD_SCENARIO_NAME,
    description:
      "Ситуации №4, №6 и №28 из методички «Ситуации на борту»: ролевая модель, ветки на таймаут, жалоба при лояльности < 30, вызов ПТБ при безопасности < 40.",
    difficulty: 2,
    data: onboardScenario,
  },
];

/** При запуске добавляем встроенные сценарии, которых ещё нет в базе (по названию) */
export function seedScenarios() {
  const names = new Set(storage.listScenarios().map((s) => s.name));
  for (const s of SEED_SCENARIOS) {
    if (!names.has(s.name)) storage.createScenario({ ...s, data: s.data() });
  }
}
