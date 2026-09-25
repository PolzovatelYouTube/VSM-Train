import { describe, it, expect, beforeAll } from "vitest";

// отдельная БД в памяти, чтобы тест не трогал data.db
process.env.DB_PATH = ":memory:";
let n: typeof import("../server/notifications");
let storage: typeof import("../server/storage").storage;
let seedChallenges: typeof import("../server/seed").seedChallenges;

beforeAll(async () => {
  ({ storage } = await import("../server/storage"));
  ({ seedChallenges } = await import("../server/seed"));
  n = await import("../server/notifications");
  seedChallenges();
});

const attempt = (playerName: string, score: number) => ({
  playerName,
  scenarioId: 1,
  mode: "check" as const,
  score,
  loyalty: 95,
  safety: 95,
  accuracy: 1,
  avgReactionMs: 3000,
  competencies: { roleModel: 100 },
  log: [],
});

describe("уведомления", () => {
  it("notifyAll доставляет всем игрокам, markRead отмечает прочитанным", () => {
    const a = storage.getOrCreatePlayer("Тест Первый");
    const b = storage.getOrCreatePlayer("Тест Второй");
    n.notifyAll({ type: "new_scenario", title: "Новый сценарий", body: "…" });
    const [forA] = n.listNotifications(a.id).filter((x) => x.type === "new_scenario");
    expect(forA).toBeDefined();
    expect(n.listNotifications(b.id).some((x) => x.type === "new_scenario")).toBe(true);
    expect(n.markRead(forA.id)?.readAt).not.toBeNull();
  });

  it("о челлендже — один раз, сколько бы ни опрашивали", () => {
    const p = n.syncNotifications("Тест Третий");
    n.syncNotifications("Тест Третий");
    const started = n.listNotifications(p.id).filter((x) => x.type === "challenge_started");
    expect(started.length).toBe(storage.challengesFor(p.id).length);
  });

  it("сгорающие баллы: уведомление при опросе, без дублей в течение суток", () => {
    const DAY = 24 * 3600_000;
    // попытка 12 дней назад: при TTL 14 дней сгорит через 2 дня
    storage.createAttempt(attempt("Тест Четвёртый", 80), Date.now() - 12 * DAY);
    const p = n.syncNotifications("Тест Четвёртый");
    n.syncNotifications("Тест Четвёртый");
    const expiring = n.listNotifications(p.id).filter((x) => x.type === "points_expiring");
    expect(expiring).toHaveLength(1);
    expect(expiring[0].body).toMatch(/Через 2 дн\./);
  });

  it("новая ачивка и новый уровень — по разнице профиля до и после попытки", () => {
    const name = "Тест Пятый";
    const p = storage.getOrCreatePlayer(name);
    const before = storage.getProfile(name)!;
    for (let i = 0; i < 3; i++) storage.createAttempt(attempt(name, 100));
    n.notifyAttemptOutcome(p.id, before, storage.getProfile(name)!);
    const types = n.listNotifications(p.id).map((x) => x.type);
    expect(types).toContain("achievement");
    expect(types).toContain("level_up");
  });
});
