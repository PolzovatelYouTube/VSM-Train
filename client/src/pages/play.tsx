import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Pause, Play as PlayIcon, RotateCcw, Zap, Gauge, Eye, Trophy } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { DebriefCard } from "@/components/app/Debrief";
import { buildDebrief } from "@shared/analytics";
import { type MapActor } from "@/components/app/CarMap";
import { Meter } from "@/components/app/widgets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/player";
import { useScenario, useSubmitAttempt } from "@/lib/api";
import { type ScenarioData, type DialogueOption } from "@shared/scenario";
import type { ReplayAction } from "@shared/schema";
import { createSim, tick, chooseOption, triggerEvent, computeResult, findEvent, findNode, visibleOptions, eventCarType, resetReactionClock, type SimState, type SimResult, type LogEntry } from "@shared/engine";
import { projectGameScene, newLogEntries, resolveLandscape } from "@shared/visual";
import { GameStage } from "@/game/GameStage";
import { GameHud } from "@/game/GameHud";
import { DialogueStage } from "@/game/DialogueStage";
import { ConsequenceOverlay } from "@/game/ConsequenceOverlay";
import { MiniCarMap } from "@/game/MiniCarMap";
import { preloadAssets, sceneAssetUrls } from "@/game/assets";
import { useReducedMotion, useElementSize, useMediaQuery, OVERLAY_DIALOGUE_QUERY } from "@/game/motion";

type Mode = "training" | "check";

export default function Play() {
  const { id, mode: modeParam } = useParams<{ id: string; mode: string }>();
  const mode: Mode = modeParam === "check" ? "check" : "training";
  const sid = Number(id);
  const { data: row, isLoading } = useScenario(sid);
  const data = row?.data;

  if (isLoading || !data) {
    return (
      <Shell wide>
        <Skeleton className="h-10 w-72 mb-4" />
        <Skeleton className="h-72 w-full" />
      </Shell>
    );
  }
  return <Runner key={`${sid}-${mode}`} sid={sid} data={data} mode={mode} scenarioName={row!.name} />;
}

const CONSEQUENCE_MS = 1300;
const CONSEQUENCE_MS_REDUCED = 700;

function Runner({ sid, data, mode, scenarioName }: { sid: number; data: ScenarioData; mode: Mode; scenarioName: string }) {
  const { player } = useApp();
  const submit = useSubmitAttempt();
  const reduced = useReducedMotion();
  const overlayDialogue = useMediaQuery(OVERLAY_DIALOGUE_QUERY);
  const [dialogueRef, dialogueSize] = useElementSize<HTMLDivElement>();
  const simRef = useRef<SimState>(createSim(data));
  const [, setFrame] = useState(0);
  const [phase, setPhase] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [speed, setSpeed] = useState(1);
  const [carId, setCarId] = useState(data.actors.find((a) => a.role === "conductor")?.spawn.carId ?? data.train.cars[0].id);
  const [follow, setFollow] = useState(true);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loaded, setLoaded] = useState(0);
  const submittedRef = useRef(false);
  const replayActionsRef = useRef<ReplayAction[]>([]);
  const lastActiveRef = useRef<string | null>(null);
  // Визуальная пауза после выбора/таймаута: симуляция стоит, UI показывает реакцию. На движок не влияет.
  const consequenceRef = useRef<{ entry: LogEntry; until: number; key: number } | null>(null);
  const followRef = useRef(follow);
  followRef.current = follow;

  const isTraining = mode === "training";
  const sim = simRef.current;
  const landscape = resolveLandscape(data);

  // Предзагрузка ассетов сцены до старта (ошибки не блокируют игру — есть fallback)
  useEffect(() => {
    let alive = true;
    preloadAssets(sceneAssetUrls(landscape), (p) => alive && setLoaded(p)).then(() => alive && setLoaded(1));
    return () => {
      alive = false;
    };
  }, [landscape]);

  const showConsequence = useCallback(
    (entry: LogEntry) => {
      consequenceRef.current = { entry, until: performance.now() + (reduced ? CONSEQUENCE_MS_REDUCED : CONSEQUENCE_MS), key: Date.now() };
    },
    [reduced],
  );

  // Игровой цикл на requestAnimationFrame
  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * speed;
      last = now;
      const s = simRef.current;
      const cq = consequenceRef.current;
      if (cq) {
        // пока идёт реакция — время рейса и таймер решения стоят
        if (now >= cq.until) {
          consequenceRef.current = null;
          resetReactionClock(s);
        }
      } else {
        const before = s.log.length;
        tick(s, dt, data, { pauseWhileDialogue: isTraining });
        const fresh = newLogEntries(before, s);
        if (fresh.length) showConsequence(fresh[fresh.length - 1]); // таймаут
      }
      // автослежение за событием
      const key = s.active ? `${s.active.eventId}` : null;
      if (key && key !== lastActiveRef.current) {
        lastActiveRef.current = key;
        const ev = findEvent(data, key);
        const actor = ev?.actorId ? s.actors.find((a) => a.id === ev.actorId) : null;
        if (followRef.current && actor) setCarId(actor.carId);
      }
      if (!s.active) lastActiveRef.current = null;
      setFrame((f) => f + 1);
      if (s.finished && !consequenceRef.current) {
        setResult(computeResult(s, data));
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, speed, data, isTraining, showConsequence]);

  // Сохранение результата
  useEffect(() => {
    if (phase !== "done" || !result || submittedRef.current) return;
    submittedRef.current = true;
    submit.mutate({
      playerName: player || "Аноним",
      scenarioId: sid,
      mode,
      actions: [
        ...replayActionsRef.current,
        ...simRef.current.log
          .filter((entry) => entry.optionId !== null)
          .map((entry) => ({ type: "choice" as const, nodeId: entry.nodeId, choiceId: entry.optionId!, timestampMs: Math.round(entry.t * 1000) })),
      ].sort((a, b) => a.timestampMs - b.timestampMs),
    });
  }, [phase, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    simRef.current = createSim(data);
    submittedRef.current = false;
    replayActionsRef.current = [];
    lastActiveRef.current = null;
    consequenceRef.current = null;
    setResult(null);
    setPhase("idle");
    setFrame((f) => f + 1);
  };

  const choose = useCallback(
    (o: DialogueOption) => {
      const s = simRef.current;
      if (consequenceRef.current || !s.active) return; // защита от двойного выбора
      const before = s.log.length;
      chooseOption(s, data, o);
      const fresh = newLogEntries(before, s);
      if (fresh.length) showConsequence(fresh[fresh.length - 1]);
      setFrame((f) => f + 1);
    },
    [data, showConsequence],
  );

  const cq = consequenceRef.current;
  const model = projectGameScene(data, sim, { viewCarId: carId, follow, consequence: cq?.entry ?? null });
  const car = data.train.cars.find((c) => c.id === model.carId) ?? data.train.cars[0];
  const activeEvent = sim.active && !cq ? findEvent(data, sim.active.eventId) : null;
  const activeNode = sim.active && !cq ? findNode(data, sim.active.eventId, sim.active.nodeId) : null;
  const limitSec = sim.active?.limitSec;
  const timerLeft = !isTraining && limitSec ? Math.max(0, limitSec - (sim.t - (sim.active?.openedAt ?? 0))) : null;
  const eventCar = sim.active ? eventCarType(sim, data, sim.active.eventId) : null;
  const feedback = cq?.entry.optionId
    ? findNode(data, cq.entry.eventId, cq.entry.nodeId)?.options.find((o) => o.id === cq.entry.optionId)?.feedback
    : cq
      ? findNode(data, cq.entry.eventId, cq.entry.nodeId)?.onTimeout?.text
      : undefined;

  const mapActors: MapActor[] = sim.actors.map((ra) => {
    const def = data.actors.find((a) => a.id === ra.id)!;
    return {
      id: ra.id,
      name: def.name,
      role: def.role,
      carId: ra.carId,
      x: ra.x,
      y: ra.y,
      seated: ra.seated,
      wrongSeat: ra.wrongSeat,
      mood: ra.mood,
      bubble: ra.bubble?.text ?? null,
      alert: model.focusedActorId === ra.id && model.phase !== "observe",
    };
  });

  const badges: Record<string, number> = {};
  for (const ra of sim.actors) badges[ra.carId] = (badges[ra.carId] ?? 0) + 1;
  const manualEvents = data.events.filter((e) => e.trigger.type === "manual" && !sim.fired.includes(e.id));

  return (
    <Shell wide>
      <GameHud
        scenarioName={scenarioName}
        trainName={data.train.name}
        training={isTraining}
        t={sim.t}
        total={data.durationSec}
        loyalty={sim.loyalty}
        safety={sim.safety}
        consequence={model.consequence}
        consequenceKey={String(cq?.key ?? 0)}
      />

      <div className="game-layout">
        <GameStage model={model} car={car} className="game-stage" reserveBottom={overlayDialogue && activeEvent ? dialogueSize.h + 16 : 0}>
          {model.consequence && <ConsequenceOverlay c={model.consequence} feedback={feedback} />}
          {phase === "idle" && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/55 backdrop-blur-[2px]">
              <div className="g-rise max-w-md space-y-3 rounded-xl bg-card/95 p-4 text-center shadow-2xl sm:p-6">
                <h2 className="text-lg font-bold">Смена начинается</h2>
                <p className="text-sm text-muted-foreground">
                  {isTraining
                    ? "Тренировка: при событии рейс ставится на паузу, верные ответы подсвечены, есть подсказки. Результат идёт в баллы обучения."
                    : "Проверочный рейс: без пауз и подсказок. Таймер на каждое решение, фиксируется скорость реакции. Результат идёт в баллы практики."}
                </p>
                {loaded < 1 && (
                  <div className="space-y-1" aria-live="polite">
                    <Progress value={loaded * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">Загружаем сцену… {Math.round(loaded * 100)}%</p>
                  </div>
                )}
                <Button size="lg" className="min-h-11" disabled={loaded < 1} onClick={() => setPhase("running")} data-testid="button-start">
                  <PlayIcon className="mr-1.5 size-4" /> Начать смену
                </Button>
              </div>
            </div>
          )}
          {phase === "paused" && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/40">
              <Button size="lg" className="min-h-11" onClick={() => setPhase("running")} data-testid="button-resume-stage">
                <PlayIcon className="mr-1.5 size-4" /> Продолжить
              </Button>
            </div>
          )}
        </GameStage>

        <div className="game-dialogue" ref={dialogueRef}>
          {activeEvent && activeNode ? (
            <DialogueStage
              event={activeEvent}
              node={activeNode}
              options={visibleOptions(activeNode, sim)}
              training={isTraining}
              timerLeft={timerLeft}
              limitSec={limitSec}
              locked={!!cq || phase !== "running"}
              speakerInScene={!!model.speakerId}
              eventCar={eventCar}
              onChoose={choose}
            />
          ) : phase === "running" && !cq ? (
            <p className="px-1 text-xs text-muted-foreground lg:hidden" data-testid="text-observe">
              {sim.feed[sim.feed.length - 1]?.text}
            </p>
          ) : null}
        </div>

        <aside className="game-side space-y-3">
          {phase === "done" && result && <ResultCard result={result} mode={mode} sid={sid} onRetry={reset} saving={submit.isPending} />}
          {phase === "done" && <DebriefCard items={buildDebrief(data, sim.log)} />}

          <div className="flex flex-wrap items-center gap-2">
            {phase === "running" && isTraining && (
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => setPhase("paused")} data-testid="button-pause">
                <Pause className="mr-1 size-4" /> Пауза
              </Button>
            )}
            {phase === "paused" && (
              <Button size="sm" className="min-h-11" onClick={() => setPhase("running")} data-testid="button-resume">
                <PlayIcon className="mr-1 size-4" /> Продолжить
              </Button>
            )}
            {phase !== "idle" && (
              <Button size="sm" variant="ghost" className="min-h-11" onClick={reset} data-testid="button-reset">
                <RotateCcw className="mr-1 size-4" /> Заново
              </Button>
            )}
            <Button size="sm" variant={follow ? "secondary" : "ghost"} className="min-h-11" onClick={() => setFollow((f) => !f)} title="Переключать вагон на событие" data-testid="button-follow">
              <Eye className="mr-1 size-4" /> Слежение
            </Button>
            <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))} data-testid="button-speed">
              <Gauge className="mr-1 size-4" /> <span className="font-mono">×{speed}</span>
            </Button>
          </div>
          {isTraining && phase !== "idle" && phase !== "done" && manualEvents.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="size-3.5" /> Песочница:
              </span>
              {manualEvents.map((e) => (
                <Button key={e.id} size="sm" variant="outline" className="min-h-11 text-xs" onClick={() => { replayActionsRef.current.push({ type: "trigger", eventId: e.id, timestampMs: Math.round(simRef.current.t * 1000) }); triggerEvent(simRef.current, data, e.id); setFrame((f) => f + 1); }} data-testid={`button-trigger-${e.id}`}>
                  {e.title}
                </Button>
              ))}
            </div>
          )}

          <MiniCarMap cars={data.train.cars} car={car} actors={mapActors} badges={badges} onSelect={(id) => { setFollow(false); setCarId(id); }} />

          {phase !== "done" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Журнал рейса</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm" data-testid="list-feed">
                  {[...sim.feed].reverse().slice(0, 8).map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-10 shrink-0 pt-0.5 font-mono text-xs tabular text-muted-foreground">
                        {Math.floor(f.t / 60)}:{Math.floor(f.t % 60).toString().padStart(2, "0")}
                      </span>
                      <span className={cn(f.kind === "warn" && "text-[hsl(var(--loyalty))]", f.kind === "bad" && "text-[hsl(var(--danger))]", f.kind === "good" && "text-[hsl(var(--safety))]")}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function ResultCard({ result, mode, sid, onRetry, saving }: { result: SimResult; mode: Mode; sid: number; onRetry: () => void; saving: boolean }) {
  const comps: { key: keyof SimResult["competencies"]; label: string }[] = [
    { key: "communication", label: "Коммуникация" },
    { key: "safety", label: "Безопасность" },
    { key: "protocol", label: "Соблюдение алгоритмов" },
    { key: "speed", label: "Скорость реакции" },
    { key: "roleModel", label: "Ролевая модель общения" },
  ];
  return (
    <Card data-testid="card-result">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Разбор рейса</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-end gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Итоговый балл</div>
            <div className="font-mono text-4xl font-bold tabular leading-none" data-testid="text-score">{result.score}</div>
          </div>
          <div className="flex-1 space-y-2 pb-1">
            <Meter label="Лояльность" value={result.loyalty} kind="loyalty" compact />
            <Meter label="Безопасность" value={result.safety} kind="safety" compact />
          </div>
        </div>
        <div className="space-y-2.5">
          {comps.map((c) => (
            <div key={c.key}>
              <div className="flex justify-between text-xs mb-1">
                <span>{c.label}</span>
                <span className="font-mono tabular">{result.competencies[c.key]}</span>
              </div>
              <Progress value={result.competencies[c.key]} className="h-1.5" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md bg-muted/60 p-2.5">
            <div className="text-muted-foreground">Средняя реакция</div>
            <div className="font-mono text-base font-semibold tabular">{(result.avgReactionMs / 1000).toFixed(1)} с</div>
          </div>
          <div className="rounded-md bg-muted/60 p-2.5">
            <div className="text-muted-foreground">Верных решений</div>
            <div className="font-mono text-base font-semibold tabular">{Math.round(result.accuracy * 100)}%</div>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold mb-1.5">Рекомендации</div>
          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
            {result.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          {saving ? "Сохраняем результат…" : `Результат записан в ${mode === "training" ? "баллы обучения" : "баллы практики"}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRetry} data-testid="button-retry">
            <RotateCcw className="size-4 mr-1" /> Пройти снова
          </Button>
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/play/${sid}/${mode === "training" ? "check" : "training"}`}>
              {mode === "training" ? "Проверочный рейс" : "В тренировку"}
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/leaderboard">
              <Trophy className="size-4 mr-1" /> Рейтинг
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
