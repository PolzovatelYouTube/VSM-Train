import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage, seedScenarios } from "./storage";
import { seedStructure } from "./seed";
import { insertScenarioSchema, insertAttemptSchema } from "@shared/schema";
import { buildCar, CAR_TYPES, DEFAULT_ROWS, scenarioDataSchema, type CarType } from "@shared/scenario";
import { z } from "zod";

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
      res.status(201).json(rowToJson(storage.createScenario(body)));
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
      res.status(201).json(storage.createAttempt(body));
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

  // Оргструктура для переключателя рейтинга и страницы руководителя
  app.get("/api/structure", (_req, res) => {
    res.json({ depots: storage.listDepots(), teams: storage.listTeams() });
  });

  app.get("/api/leaderboard", (_req, res) => {
    res.json(storage.leaderboard());
  });

  return httpServer;
}
