/**
 * Таблицы SQLite (Drizzle ORM). Сам сценарий хранится как JSON в колонке `data`
 * и валидируется через scenarioDataSchema из ./scenario.
 */
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { scenarioDataSchema } from "./scenario";

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
  createdAt: integer("created_at").notNull(),
});

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
  attempts: number;
  bestScore: number;
  achievements: Achievement[];
}

export interface LeaderboardEntry {
  name: string;
  trainingPoints: number;
  practicePoints: number;
  attempts: number;
  bestScore: number;
}
