import { describe, it, expect, vi, afterEach } from "vitest";
import { demoScenario, scenarioDataSchema, type ScenarioData } from "../shared/scenario";
import {
  createSim,
  tick,
  chooseOption,
  computeResult,
  findNode,
  visibleOptions,
  resetReactionClock,
  type SimState,
} from "../shared/engine";
import {
  projectGameScene,
  resolvePreset,
  defaultPreset,
  resolveLandscape,
  resolveInterior,
  matchSpeaker,
  newLogEntries,
  consequenceKind,
  SPRITE_PRESETS,
  resolveNavmeshPlacement,
} from "../shared/visual";

afterEach(() => vi.useRealTimers());

/** Прогнать симуляцию до открытия диалога */
function runUntilDialogue(s: SimState, data: ScenarioData, pause = true, maxSec = 120) {
  for (let i = 0; i < maxSec * 10 && !s.active && !s.finished; i++) tick(s, 0.1, data, { pauseWhileDialogue: pause });
}

function pick(s: SimState, data: ScenarioData, id: string) {
  const node = findNode(data, s.active!.eventId, s.active!.nodeId)!;
  chooseOption(s, data, visibleOptions(node, s).find((o) => o.id === id)!);
}

describe("визуальная сцена: обратная совместимость", () => {
  it("старый сценарий без visual проходит схему и получает значения по умолчанию", () => {
    const data = demoScenario();
    expect(data.visual).toBeUndefined();
    const raw = JSON.parse(JSON.stringify(data));
    const parsed = scenarioDataSchema.parse(raw);
    expect(parsed.visual).toBeUndefined();
    expect(resolveLandscape(parsed)).toBe("day");
    expect(resolveInterior(parsed, "comfort")).toBe("class-comfort");
  });

  it("новые поля visual сохраняются схемой", () => {
    const data = demoScenario();
    data.visual = { landscape: "night", interior: "class-first" };
    data.actors[1].visual = { preset: "vip", accent: "#ff0000" };
    const parsed = scenarioDataSchema.parse(JSON.parse(JSON.stringify(data)));
    expect(parsed.visual).toEqual({ landscape: "night", interior: "class-first" });
    expect(parsed.actors[1].visual).toEqual({ preset: "vip", accent: "#ff0000" });
    expect(resolveLandscape(parsed)).toBe("night");
  });

  it("неизвестный пейзаж отвергается схемой", () => {
    const data = { ...demoScenario(), visual: { landscape: "rain" } };
    expect(scenarioDataSchema.safeParse(data).success).toBe(false);
  });
});

describe("пресеты спрайтов", () => {
  it("по роли и с fallback для неизвестного пресета", () => {
    expect(defaultPreset("conductor", "x")).toBe("conductor");
    expect(defaultPreset("troublemaker", "x")).toBe("troublemaker");
    expect(["passenger-f", "passenger-m"]).toContain(defaultPreset("passenger", "a1"));
    expect(["elderly-f", "elderly-m"]).toContain(defaultPreset("elderly", "a1"));
    expect(resolvePreset({ id: "a", role: "vip", visual: { preset: "несуществующий" } })).toBe("vip");
    expect(resolvePreset({ id: "a", role: "passenger", visual: { preset: "child" } })).toBe("child");
  });

  it("пресет пассажира стабилен для одного id", () => {
    expect(defaultPreset("passenger", "a_owner")).toBe(defaultPreset("passenger", "a_owner"));
    for (const a of demoScenario().actors) expect(SPRITE_PRESETS).toContain(resolvePreset(a));
  });

  it("бармен использует отдельный пресет и закреплён за стойкой бистро", () => {
    const data = demoScenario();
    const bartender = data.actors.find((actor) => actor.role === "bartender")!;
    const bistro = data.train.cars.find((car) => car.type === "bistro")!;
    const scene = projectGameScene(data, createSim(data), { viewCarId: bistro.id, follow: false });

    expect(resolvePreset(bartender)).toBe("bartender");
    expect(scene.characters.find((character) => character.id === bartender.id)?.placement).toEqual({ x: 86.5, y: 24.5, zIndex: 26 });
  });

  it("говорящий сопоставляется с актором по имени", () => {
    const data = demoScenario();
    expect(matchSpeaker(data, "Пассажир Громов")?.id).toBe("a_trouble");
    expect(matchSpeaker(data, "Пассажирка Соколова")?.id).toBe("a_elderly");
    expect(matchSpeaker(data, "Начальник поезда")).toBeUndefined();
  });
});

describe("projectGameScene", () => {
  it("observe: в начале рейса — вагон проводника, все в покое", () => {
    const data = demoScenario();
    const s = createSim(data);
    const m = projectGameScene(data, s);
    expect(m.phase).toBe("observe");
    expect(m.carId).toBe(data.train.cars[1].id);
    expect(m.landscape).toBe("day");
    expect(m.characters.map((c) => c.id)).toContain("a_conductor");
    expect(m.characters.every((c) => !c.dimmed)).toBe(true);
    expect(m.characters.every((c) => Number.isFinite(c.placement.x) && Number.isFinite(c.placement.y))).toBe(true);
  });

  it("navmesh сажает персонажа в координаты кресла и задаёт глубину", () => {
    const data = demoScenario();
    const car = data.train.cars[1];
    const seat = car.cells.find((c) => c.seat === "5A")!;
    const s = createSim(data);
    const actor = s.actors.find((a) => a.id === "a_trouble")!;
    actor.carId = car.id;
    actor.x = seat.x;
    actor.y = seat.y;
    actor.seated = true;
    actor.path = [];

    expect(resolveNavmeshPlacement(car, actor)).toEqual({ x: 65.5, y: 20, zIndex: 73 });
    const sceneActor = projectGameScene(data, s).characters.find((c) => c.id === actor.id);
    expect(sceneActor?.placement).toEqual({ x: 65.5, y: 20, zIndex: 73 });
    expect(sceneActor?.facing).toBe("left");
  });

  it("dialogue: фокус на Громове, он говорит, остальные приглушены", () => {
    const data = demoScenario();
    const s = createSim(data);
    runUntilDialogue(s, data);
    expect(s.active?.eventId).toBe("ev_conflict");
    const m = projectGameScene(data, s);
    expect(m.phase).toBe("dialogue");
    expect(m.focusedActorId).toBe("a_trouble");
    expect(m.speakerId).toBe("a_trouble");
    const byId = Object.fromEntries(m.characters.map((c) => [c.id, c]));
    expect(byId.a_trouble.state).toBe("talk");
    expect(byId.a_conductor.state).toBe("listen");
    expect(byId.a_conductor.dimmed).toBe(false);
    expect(byId.a_elderly.dimmed).toBe(true);
  });

  it("consequence: верный выбор → positive, ошибочный → negative, таймаут → timeout", () => {
    const data = demoScenario();
    const s = createSim(data);
    runUntilDialogue(s, data);
    const before = s.log.length;
    pick(s, data, "o1");
    const [entry] = newLogEntries(before, s);
    const m = projectGameScene(data, s, { consequence: entry });
    expect(m.phase).toBe("consequence");
    expect(m.consequence).toMatchObject({ kind: "positive", loyalty: entry.effects.loyalty });
    expect(m.characters.find((c) => c.id === "a_trouble")!.state).toBe("positive");
    expect(m.characters.find((c) => c.id === "a_trouble")!.emotion).toBe("happy");

    const trouble = s.actors.find((a) => a.id === "a_trouble")!;
    trouble.bubble = { text: "Прошлая реплика", until: s.t + 10 };
    expect(projectGameScene(data, s).characters.find((c) => c.id === "a_trouble")!.bubble).toBe("Прошлая реплика");
    expect(projectGameScene(data, s, { consequence: entry }).characters.find((c) => c.id === "a_trouble")!.bubble).toBeNull();

    pick(s, data, "o5");
    const bad = s.log[s.log.length - 1];
    expect(projectGameScene(data, s, { consequence: bad }).characters.find((c) => c.id === "a_trouble")!.state).toBe("negative");
    expect(consequenceKind({ ...bad, optionId: null })).toBe("timeout");
  });

  it("finished: после конца рейса", () => {
    const data = demoScenario();
    data.events = [];
    const s = createSim(data);
    for (let i = 0; i < 1000 && !s.finished; i++) tick(s, 0.1, data, { pauseWhileDialogue: true });
    expect(projectGameScene(data, s).phase).toBe("finished");
  });

  it("проектор не мутирует состояние симуляции", () => {
    const data = demoScenario();
    const s = createSim(data);
    runUntilDialogue(s, data);
    const snap = JSON.stringify(s);
    projectGameScene(data, s, { viewCarId: data.train.cars[0].id, follow: false });
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("без слежения камера остаётся в выбранном вагоне", () => {
    const data = demoScenario();
    const s = createSim(data);
    runUntilDialogue(s, data);
    const m = projectGameScene(data, s, { viewCarId: data.train.cars[0].id, follow: false });
    expect(m.carId).toBe(data.train.cars[0].id);
  });
});

/** Полный прогон демо: выбор по стратегии, с визуальной паузой (UI) или без */
function playDemo(mode: "training" | "check", choose: (nodeId: string) => string | null, visualDelay: boolean) {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const data = demoScenario();
  const s = createSim(data);
  const pause = mode === "training";
  for (let i = 0; i < 5000 && !s.finished; i++) {
    if (s.active) {
      vi.advanceTimersByTime(1000); // «думаем» 1 с
      const id = choose(s.active.nodeId);
      if (id) {
        const before = s.log.length;
        pick(s, data, id);
        if (visualDelay) {
          // UI показывает реакцию 1.2 с: симуляция стоит, проектор вызывается, затем отсчёт реакции перезапускается
          const [entry] = newLogEntries(before, s);
          projectGameScene(data, s, { consequence: entry });
          vi.advanceTimersByTime(1200);
          resetReactionClock(s);
        }
        continue;
      }
    }
    tick(s, 0.1, data, { pauseWhileDialogue: pause });
  }
  return { s, data };
}

describe("визуальная задержка не влияет на результат", () => {
  const good: Record<string, string> = { n1: "o1", n2: "o4", n3: "o6", m1: "m1a", m2: "m2a", r1: "r1a" };

  it("training: одинаковый computeResult с визуальной паузой и без", () => {
    const a = playDemo("training", (n) => good[n], false);
    const b = playDemo("training", (n) => good[n], true);
    expect(a.s.finished && b.s.finished).toBe(true);
    expect(computeResult(b.s, b.data)).toEqual(computeResult(a.s, a.data));
    expect(computeResult(a.s, a.data).accuracy).toBe(1);
  });

  it("check: одинаковый результат, в том числе с ошибочным выбором", () => {
    const bad: Record<string, string> = { ...good, n1: "o2", n3: "o7" };
    const a = playDemo("check", (n) => bad[n], false);
    const b = playDemo("check", (n) => bad[n], true);
    expect(b.s.finished).toBe(true);
    expect(computeResult(b.s, b.data)).toEqual(computeResult(a.s, a.data));
    expect(computeResult(a.s, a.data).accuracy).toBeLessThan(1);
  });

  it("check: таймаут доходит до результата", () => {
    const a = playDemo("check", () => null, false);
    expect(a.s.finished).toBe(true);
    expect(computeResult(a.s, a.data).timeouts).toBeGreaterThan(0);
  });
});
