import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { parallelSituationsScenario } from "../shared/scenarios/parallel-situations";
import { replayAttempt } from "../shared/replay";

process.env.DB_PATH = ":memory:";
let storage: typeof import("../server/storage").storage;
let db: typeof import("../server/storage").db;
beforeAll(async () => { ({ storage, db } = await import("../server/storage")); });

describe("серверный журнал управления нагрузкой", () => {
  it("сохраняет воспроизведённый аудит и обе компетенции в SQLite", () => {
    const data = parallelSituationsScenario();
    const replay = replayAttempt(data, "check", [
      { type: "select", eventId: "breathing", timestampMs: 24000 },
      { type: "choice", eventId: "breathing", nodeId: "breathing-start", choiceId: "medical-clarify", timestampMs: 24000 },
    ]);
    const scenario = storage.createScenario({ name: "Аудит тест", description: "", difficulty: 1, data });
    const attempt = storage.createAttempt({ playerName: "Синтетический тест", scenarioId: scenario.id, mode: "check",
      ...replay.result, log: replay.state.log, workload: replay.state.workload });
    expect(JSON.parse(attempt.workload)).toEqual(replay.state.workload);
    expect(JSON.parse(attempt.competencies)).toMatchObject({
      prioritization: replay.result.competencies.prioritization,
      situational_awareness: replay.result.competencies.situational_awareness,
    });
  });

  it("старый контракт попытки получает пустой журнал; bootstrap добавляет колонку с default", () => {
    const columns = db.all<{ name: string; dflt_value: string }>(sql`PRAGMA table_info(attempts)`);
    expect(columns.find((column) => column.name === "workload")?.dflt_value).toBe("'[]'");
    const attempt = storage.createAttempt({ playerName: "Старая попытка", scenarioId: 1, mode: "training", score: 80,
      loyalty: 80, safety: 80, accuracy: 1, avgReactionMs: 1000, competencies: { safety: 100 }, log: [] });
    expect(attempt.workload).toBe("[]");
  });
});
