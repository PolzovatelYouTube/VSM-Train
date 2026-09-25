/**
 * Таблицы SQLite (Drizzle ORM). Сам сценарий хранится как JSON в колонке `data`
 * и валидируется через scenarioDataSchema из ./scenario.
 */
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { scenarioDataSchema, EVENT_CATEGORIES } from "./scenario";
import type { LevelInfo, ExpiringPoints } from "./gamification";
import type { Skill, MemberSkills, TeamMistake } from "./analytics";

export const scenarios = sqliteTable("scenarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  difficulty: integer("difficulty").notNull().default(1), // 1..3
  data: text("data").notNull(), // JSON ScenarioData
  updatedAt: integer("updated_at").notNull(),
});

// Оргструктура: компания → депо → бригада → проводник
export const depots = sqliteTable("depots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  depotId: integer("depot_id").notNull(),
});

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  teamId: integer("team_id"), // null — проводник ещё не закреплён за бригадой
  xp: integer("xp").notNull().default(0), // опыт: за попытки и челленджи, определяет уровень
  trainingPoints: integer("training_points").notNull().default(0),
  practicePoints: integer("practice_points").notNull().default(0),
});

export const attempts = sqliteTable("attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull(),
  scenarioId: integer("scenario_id").notNull(),
  mode: text("mode").notNull(), // 'training' | 'check'
  score: integer("score").notNull(),
  loyalty: integer("loyalty").notNull(),
  safety: integer("safety").notNull(),
  accuracy: real("accuracy").notNull(),
  avgReactionMs: integer("avg_reaction_ms").notNull(),
  competencies: text("competencies").notNull(), // JSON
  log: text("log").notNull(), // JSON LogEntry[]
  xp: integer("xp").notNull().default(0), // сколько опыта дала попытка
  points: integer("points").notNull().default(0), // баллы практики за попытку (сгорают через POINTS_TTL_DAYS)
  createdAt: integer("created_at").notNull(),
});

// Челлендж — ограниченное по времени задание с наградой в опыте.
// rule — декларативное правило (challengeRuleSchema), прогресс считается по попыткам в окне startsAt..endsAt.
export const challenges = sqliteTable("challenges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  rule: text("rule").notNull(), // JSON ChallengeRule
  startsAt: integer("starts_at").notNull(),
  endsAt: integer("ends_at").notNull(),
  rewardXp: integer("reward_xp").notNull(),
});

/** Кто и когда выполнил челлендж — чтобы награда начислялась один раз */
export const challengeCompletions = sqliteTable("challenge_completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  challengeId: integer("challenge_id").notNull(),
  playerId: integer("player_id").notNull(),
  completedAt: integer("completed_at").notNull(),
});

export const challengeRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("complete_category"), category: z.enum(EVENT_CATEGORIES), count: z.number().int().min(1) }),
  z.object({ type: z.literal("min_score"), score: z.number().int(), count: z.number().int().min(1) }),
  z.object({ type: z.literal("no_timeouts"), count: z.number().int().min(1) }),
]);
export type ChallengeRule = z.infer<typeof challengeRuleSchema>;
export type ChallengeRow = typeof challenges.$inferSelect;

export interface ChallengeProgress {
  id: number;
  title: string;
  description: string;
  rewardXp: number;
  startsAt: number;
  endsAt: number;
  current: number;
  target: number;
  done: boolean;
}

// ── Схемы вставки ──
export const insertScenarioSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  difficulty: z.number().int().min(1).max(3).default(1),
  data: scenarioDataSchema,
});
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type ScenarioRow = typeof scenarios.$inferSelect;

export const insertPlayerSchema = createInsertSchema(players).pick({ name: true });
export type Player = typeof players.$inferSelect;
export type Depot = typeof depots.$inferSelect;
export type Team = typeof teams.$inferSelect;

export const insertAttemptSchema = z.object({
  playerName: z.string().min(1),
  scenarioId: z.number().int(),
  mode: z.enum(["training", "check"]),
  score: z.number().int(),
  loyalty: z.number().int(),
  safety: z.number().int(),
  accuracy: z.number(),
  avgReactionMs: z.number().int(),
  competencies: z.record(z.string(), z.number()),
  log: z.array(z.any()),
});
export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type Attempt = typeof attempts.$inferSelect;

// ── Ачивки (вычисляются на сервере из истории попыток) ──
export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface PlayerProfile extends Player {
  level: LevelInfo;
  activePoints: number; // несгоревшие баллы практики
  expiring: ExpiringPoints | null;
  challenges: ChallengeProgress[];
  skills: Skill[];
  insights: string[];
  attempts: number;
  bestScore: number;
  achievements: Achievement[];
}

export const LEADERBOARD_SCOPES = ["team", "depot", "company"] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];

export interface LeaderboardEntry {
  name: string;
  team: string | null;
  depot: string | null;
  xp: number;
  level: number;
  levelTitle: string;
  activePoints: number; // несгоревшие баллы практики — по ним сортируется рейтинг
  trainingPoints: number;
  practicePoints: number;
  attempts: number;
  bestScore: number;
}

export interface TeamAnalytics {
  team: Team;
  depot: Depot | null;
  members: MemberSkills[];
  mistakes: TeamMistake[];
}
