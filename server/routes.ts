import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage, seedScenarios } from "./storage";
import { seedStructure, seedChallenges, seedDemoHistory } from "./seed";
import { insertScenarioSchema, submitAttemptSchema, LEADERBOARD_SCOPES } from "@shared/schema";
import { buildCar, CAR_TYPES, DEFAULT_ROWS, scenarioDataSchema, type CarType } from "@shared/scenario";
import { replayAttempt } from "@shared/replay";
import { z } from "zod";
import { notifyAll, syncNotifications, listNotifications, markRead, notifyAttemptOutcome } from "./notifications";
import { hashPassword, issueToken, requireAuth, requireRole, verifyPassword } from "./auth";

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

const credentialsSchema = z.object({
  name: z.string().trim().min(3).max(80),
  password: z.string().min(8).max(128),
});

const publicAccount = (player: { id: number; name: string; role: string }) => ({ id: player.id, name: player.name, role: player.role });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seedScenarios();
  seedStructure();
  seedChallenges();
  seedDemoHistory();

  app.post("/api/auth/register", async (req, res) => {
    try {
      const body = credentialsSchema.parse(req.body);
      if (storage.findPlayerByName(body.name)) return res.status(409).json({ message: "Пользователь с таким именем уже существует" });
      const player = storage.createAccount(body.name, await hashPassword(body.password));
      const identity = { playerId: player.id, name: player.name, role: player.role as "conductor" | "supervisor" };
      res.status(201).json({ token: issueToken(identity), user: publicAccount(player) });
    } catch (e) {
      bad(res, e);
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const body = credentialsSchema.parse(req.body);
      const player = storage.findPlayerByName(body.name);
      if (!player?.passwordHash || !(await verifyPassword(body.password, player.passwordHash)))
        return res.status(401).json({ message: "Неверное имя или пароль" });
      const identity = { playerId: player.id, name: player.name, role: player.role as "conductor" | "supervisor" };
      res.json({ token: issueToken(identity), user: publicAccount(player) });
    } catch (e) {
      bad(res, e);
    }
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const player = storage.findPlayerByName(req.auth!.name);
    if (!player || player.id !== req.auth!.playerId) return res.status(401).json({ message: "Учётная запись не найдена" });
    res.json({ user: publicAccount(player) });
  });

  // ── Сценарии ──
  app.get("/api/scenarios", requireAuth, (_req, res) => {
    res.json(storage.listScenarios().map(rowToJson));
  });

  app.get("/api/scenarios/:id", requireAuth, (req, res) => {
    const row = storage.getScenario(parseId(req));
    if (!row) return res.status(404).json({ message: "Сценарий не найден" });
    res.json(rowToJson(row));
  });

  app.post("/api/scenarios", requireAuth, requireRole("supervisor"), (req, res) => {
    try {
      const body = insertScenarioSchema.parse(req.body);
      const row = storage.createScenario(body);
      notifyAll({ type: "new_scenario", title: `Новый сценарий: «${row.name}»`, body: row.description || "Доступен для тренировки и проверки.", link: `/play/${row.id}/training` });
      res.status(201).json(rowToJson(row));
    } catch (e) {
      bad(res, e);
    }
  });

  app.put("/api/scenarios/:id", requireAuth, requireRole("supervisor"), (req, res) => {
    try {
      const body = insertScenarioSchema.parse(req.body);
      const row = storage.updateScenario(parseId(req), body);
      if (!row) return res.status(404).json({ message: "Сценарий не найден" });
      res.json(rowToJson(row));
    } catch (e) {
      bad(res, e);
    }
  });

  app.delete("/api/scenarios/:id", requireAuth, requireRole("supervisor"), (req, res) => {
    storage.deleteScenario(parseId(req));
    res.status(204).end();
  });

  // Генератор планировки вагона — чтобы клиент и сервер использовали одну функцию
  app.get("/api/cars/template", requireAuth, (req, res) => {
    const type = String(req.query.type ?? "comfort");
    if (!(CAR_TYPES as readonly string[]).includes(type)) return res.status(400).json({ message: "Неизвестный тип вагона" });
    const number = Number(req.query.number ?? 1);
    const rows = Number(req.query.rows ?? DEFAULT_ROWS[type as CarType]);
    res.json(buildCar(number, type as CarType, rows));
  });

  // ── Попытки, игроки, рейтинг ──
  app.post("/api/attempts", requireAuth, (req, res) => {
    try {
      const body = submitAttemptSchema.parse(req.body);
      const scenario = storage.getScenario(body.scenarioId);
      if (!scenario) return res.status(404).json({ message: "Сценарий не найден" });
      const data = scenarioDataSchema.parse(JSON.parse(scenario.data));
      const replay = replayAttempt(data, body.mode, body.actions);
      const result = replay.result;
      const player = storage.findPlayerByName(req.auth!.name)!;
      const before = storage.getProfile(player.name)!;
      const row = storage.createAttempt({
        playerName: player.name,
        scenarioId: body.scenarioId,
        mode: body.mode,
        score: result.score,
        loyalty: Math.round(result.loyalty),
        safety: Math.round(result.safety),
        accuracy: result.accuracy,
        avgReactionMs: Math.round(result.avgReactionMs),
        competencies: result.competencies,
        log: replay.state.log,
      });
      notifyAttemptOutcome(player.id, before, storage.getProfile(player.name)!);
      res.status(201).json(row);
    } catch (e) {
      bad(res, e);
    }
  });

  app.get("/api/attempts", requireAuth, (req, res) => {
    const player = req.auth!.role === "supervisor" && req.query.player ? String(req.query.player) : req.auth!.name;
    res.json(storage.listAttempts(player));
  });

  app.get("/api/players/:name", requireAuth, (req, res) => {
    const name = decodeURIComponent(String(req.params.name));
    if (req.auth!.role !== "supervisor" && name !== req.auth!.name) return res.status(403).json({ message: "Нет доступа к чужому профилю" });
    res.json(storage.getProfile(name));
  });

  app.get("/api/challenges", requireAuth, (req, res) => {
    res.json(storage.challengesFor(req.auth!.playerId));
  });

  // ── Уведомления: клиент опрашивает раз в NOTIFICATIONS_POLL_MS ──
  app.get("/api/notifications", requireAuth, (req, res) => {
    res.json(listNotifications(syncNotifications(req.auth!.name).id));
  });

  app.post("/api/notifications/:id/read", requireAuth, (req, res) => {
    const row = markRead(parseId(req), req.auth!.playerId);
    if (!row) return res.status(404).json({ message: "Уведомление не найдено" });
    res.json(row);
  });

  // Оргструктура для переключателя рейтинга и страницы руководителя
  app.get("/api/structure", requireAuth, (_req, res) => {
    res.json({ depots: storage.listDepots(), teams: storage.listTeams() });
  });

  app.get("/api/teams/:id/analytics", requireAuth, requireRole("supervisor"), (req, res) => {
    const data = storage.teamAnalytics(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Бригада не найдена" });
    res.json(data);
  });

  // ?scope=team|depot|company&id= — id бригады или депо; для company не нужен
  const leaderboardQuery = z.object({
    scope: z.enum(LEADERBOARD_SCOPES).default("company"),
    id: z.coerce.number().int().optional(),
  });
  app.get("/api/leaderboard", requireAuth, (req, res) => {
    const q = leaderboardQuery.safeParse(req.query);
    if (!q.success) return bad(res, q.error);
    if (q.data.scope !== "company" && q.data.id === undefined)
      return res.status(400).json({ message: "Для рейтинга бригады или депо укажите id" });
    res.json(storage.leaderboard(q.data.scope, q.data.id));
  });

  return httpServer;
}
