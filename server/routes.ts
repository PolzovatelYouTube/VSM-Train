import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage, seedScenarios } from "./storage";
import { seedStructure, seedChallenges, seedDemoHistory } from "./seed";
import { insertScenarioSchema, insertAttemptSchema, LEADERBOARD_SCOPES } from "@shared/schema";
import { buildCar, CAR_TYPES, DEFAULT_ROWS, scenarioDataSchema, type CarType } from "@shared/scenario";
import { z } from "zod";
import { notifyAll, syncNotifications, listNotifications, markRead, notifyAttemptOutcome } from "./notifications";

const parseId = (req: Request) => Number.parseInt(String(req.params.id), 10);
// Данные прогоняем через схему, чтобы старые сценарии мигрировали на лету (например, тип вагона "second" → "comfort")
const rowToJson = (r: { data: string } & Record<string, unknown>) => {
  const raw = JSON.parse(r.data);
  const parsed = scenarioDataSchema.safeParse(raw);
  return { ...r, data: parsed.success ? parsed.data : raw };
};

function bad(res: Response, err: unknown) {
  const message = err instanceof z.ZodError ? z.prettifyError(err) : String((err as Error)?.message ?? err);
  res.status(400).json({ message });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seedScenarios();
  seedStructure();
  seedChallenges();
  seedDemoHistory();

  // ── Сценарии ──
  app.get("/api/scenarios", (_req, res) => {
    res.json(storage.listScenarios().map(rowToJson));
  });

  app.get("/api/scenarios/:id", (req, res) => {
    const row = storage.getScenario(parseId(req));
    if (!row) return res.status(404).json({ message: "Сценарий не найден" });
    res.json(rowToJson(row));
  });

  app.post("/api/scenarios", (req, res) => {
    try {
      const body = insertScenarioSchema.parse(req.body);
      const row = storage.createScenario(body);
      notifyAll({ type: "new_scenario", title: `Новый сценарий: «${row.name}»`, body: row.description || "Доступен для тренировки и проверки.", link: `/play/${row.id}/training` });
      res.status(201).json(rowToJson(row));
    } catch (e) {
      bad(res, e);
    }
  });

  app.put("/api/scenarios/:id", (req, res) => {
    try {
      const body = insertScenarioSchema.parse(req.body);
      const row = storage.updateScenario(parseId(req), body);
      if (!row) return res.status(404).json({ message: "Сценарий не найден" });
      res.json(rowToJson(row));
    } catch (e) {
      bad(res, e);
    }
  });

  app.delete("/api/scenarios/:id", (req, res) => {
    storage.deleteScenario(parseId(req));
    res.status(204).end();
  });

  // Генератор планировки вагона — чтобы клиент и сервер использовали одну функцию
  app.get("/api/cars/template", (req, res) => {
    const type = String(req.query.type ?? "comfort");
    if (!(CAR_TYPES as readonly string[]).includes(type)) return res.status(400).json({ message: "Неизвестный тип вагона" });
    const number = Number(req.query.number ?? 1);
    const rows = Number(req.query.rows ?? DEFAULT_ROWS[type as CarType]);
    res.json(buildCar(number, type as CarType, rows));
  });

  // ── Попытки, игроки, рейтинг ──
  app.post("/api/attempts", (req, res) => {
    try {
      const body = insertAttemptSchema.parse(req.body);
      const player = storage.getOrCreatePlayer(body.playerName);
      const before = storage.getProfile(body.playerName)!;
      const row = storage.createAttempt(body);
      notifyAttemptOutcome(player.id, before, storage.getProfile(body.playerName)!);
      res.status(201).json(row);
    } catch (e) {
      bad(res, e);
    }
  });

  app.get("/api/attempts", (req, res) => {
    const player = req.query.player ? String(req.query.player) : undefined;
    res.json(storage.listAttempts(player));
  });

  app.get("/api/players/:name", (req, res) => {
    const name = decodeURIComponent(String(req.params.name));
    storage.getOrCreatePlayer(name);
    res.json(storage.getProfile(name));
  });

  app.get("/api/challenges", (req, res) => {
    const name = String(req.query.player ?? "");
    if (!name) return res.status(400).json({ message: "Укажите player" });
    res.json(storage.challengesFor(storage.getOrCreatePlayer(name).id));
  });

  // ── Уведомления: клиент опрашивает раз в NOTIFICATIONS_POLL_MS ──
  app.get("/api/notifications", (req, res) => {
    const name = String(req.query.player ?? "");
    if (!name) return res.status(400).json({ message: "Укажите player" });
    res.json(listNotifications(syncNotifications(name).id));
  });

  app.post("/api/notifications/:id/read", (req, res) => {
    const row = markRead(parseId(req));
    if (!row) return res.status(404).json({ message: "Уведомление не найдено" });
    res.json(row);
  });

  // Оргструктура для переключателя рейтинга и страницы руководителя
  app.get("/api/structure", (_req, res) => {
    res.json({ depots: storage.listDepots(), teams: storage.listTeams() });
  });

  app.get("/api/teams/:id/analytics", (req, res) => {
    const data = storage.teamAnalytics(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Бригада не найдена" });
    res.json(data);
  });

  // ?scope=team|depot|company&id= — id бригады или депо; для company не нужен
  const leaderboardQuery = z.object({
    scope: z.enum(LEADERBOARD_SCOPES).default("company"),
    id: z.coerce.number().int().optional(),
  });
  app.get("/api/leaderboard", (req, res) => {
    const q = leaderboardQuery.safeParse(req.query);
    if (!q.success) return bad(res, q.error);
    if (q.data.scope !== "company" && q.data.id === undefined)
      return res.status(400).json({ message: "Для рейтинга бригады или депо укажите id" });
    res.json(storage.leaderboard(q.data.scope, q.data.id));
  });

  return httpServer;
}
