import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Pause, Play as PlayIcon, RotateCcw, Zap, Gauge, Lightbulb, Eye, Trophy, GraduationCap, ClipboardCheck } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { CarMap, Legend, type MapActor } from "@/components/app/CarMap";
import { TrainStrip, Meter, Clock, TimerRing, CATEGORY_COLOR } from "@/components/app/widgets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/player";
import { useScenario, useSubmitAttempt } from "@/lib/api";
import { EVENT_CATEGORY_LABEL, type ScenarioData } from "@shared/scenario";
import { createSim, tick, chooseOption, triggerEvent, computeResult, findEvent, findNode, visibleOptions, type SimState, type SimResult } from "@shared/engine";

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

function Runner({ sid, data, mode, scenarioName }: { sid: number; data: ScenarioData; mode: Mode; scenarioName: string }) {
  const { player } = useApp();
  const submit = useSubmitAttempt();
  const simRef = useRef<SimState>(createSim(data));
  const [, setFrame] = useState(0);
  const [phase, setPhase] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [speed, setSpeed] = useState(1);
  const [carId, setCarId] = useState(data.actors.find((a) => a.role === "conductor")?.spawn.carId ?? data.train.cars[0].id);
  const [follow, setFollow] = useState(true);
  const [result, setResult] = useState<SimResult | null>(null);
  const submittedRef = useRef(false);
  const lastActiveRef = useRef<string | null>(null);

  const isTraining = mode === "training";
  const sim = simRef.current;

  // Игровой цикл на requestAnimationFrame
  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * speed;
      last = now;
      const s = simRef.current;
      tick(s, dt, data, { pauseWhileDialogue: isTraining });
      // автослежение за событием
      const key = s.active ? `${s.active.eventId}` : null;
      if (key && key !== lastActiveRef.current) {
        lastActiveRef.current = key;
        const ev = findEvent(data, key);
        const actor = ev?.actorId ? s.actors.find((a) => a.id === ev.actorId) : null;
        if (follow && actor) setCarId(actor.carId);
      }
      if (!s.active) lastActiveRef.current = null;
      setFrame((f) => f + 1);
      if (s.finished) {
        setResult(computeResult(s, data));
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, speed, data, isTraining, follow]);

  // Сохранение результата
  useEffect(() => {
    if (phase !== "done" || !result || submittedRef.current) return;
    submittedRef.current = true;
    submit.mutate({
      playerName: player || "Аноним",
      scenarioId: sid,
      mode,
      score: result.score,
      loyalty: Math.round(result.loyalty),
      safety: Math.round(result.safety),
      accuracy: result.accuracy,
      avgReactionMs: Math.round(result.avgReactionMs),
      competencies: result.competencies,
      log: simRef.current.log,
    });
  }, [phase, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    simRef.current = createSim(data);
    submittedRef.current = false;
    lastActiveRef.current = null;
    setResult(null);
    setPhase("idle");
    setFrame((f) => f + 1);
  };

  const car = data.train.cars.find((c) => c.id === carId) ?? data.train.cars[0];
  const activeEvent = sim.active ? findEvent(data, sim.active.eventId) : null;
  const activeNode = sim.active ? findNode(data, sim.active.eventId, sim.active.nodeId) : null;
  const timerLeft = activeNode?.timerSec ? Math.max(0, activeNode.timerSec - (sim.t - (sim.active?.openedAt ?? 0))) : null;

  const mapActors: MapActor[] = useMemo(
    () =>
      sim.actors.map((ra) => {
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
          alert: !!activeEvent && activeEvent.actorId === ra.id,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim.t, sim.active, data],
  );

  const badges: Record<string, number> = {};
  for (const ra of sim.actors) badges[ra.carId] = (badges[ra.carId] ?? 0) + 1;
  const manualEvents = data.events.filter((e) => e.trigger.type === "manual" && !sim.fired.includes(e.id));

  return (
    <Shell wide>
      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/" data-testid="link-back">
            <ArrowLeft className="size-4 mr-1" /> Сценарии
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{scenarioName}</div>
          <div className="text-xs text-muted-foreground">{data.train.name}</div>
        </div>
        <Badge variant={isTraining ? "secondary" : "default"} className="gap-1" data-testid="badge-mode">
          {isTraining ? <GraduationCap className="size-3.5" /> : <ClipboardCheck className="size-3.5" />}
          {isTraining ? "Тренировка" : "Проверочный рейс"}
        </Badge>
        <Clock t={sim.t} total={data.durationSec} />
        <div className="flex flex-wrap gap-4 ml-auto">
          <Meter label="Лояльность пассажиров" value={sim.loyalty} kind="loyalty" compact />
          <Meter label="Рейтинг безопасности" value={sim.safety} kind="safety" compact />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <section className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TrainStrip cars={data.train.cars} selectedId={car.id} onSelect={(id) => { setCarId(id); }} badges={badges} />
            <div className="ml-auto flex items-center gap-1.5">
              <Button size="sm" variant={follow ? "secondary" : "ghost"} onClick={() => setFollow((f) => !f)} title="Переключать вагон на событие" data-testid="button-follow">
                <Eye className="size-4 mr-1" /> Слежение
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))} data-testid="button-speed">
                <Gauge className="size-4 mr-1" /> <span className="font-mono">×{speed}</span>
              </Button>
            </div>
          </div>

          <div className="relative rounded-lg border bg-card/50 p-3 sm:p-4 overflow-x-auto min-h-[260px] sm:min-h-0">
            <CarMap car={car} actors={mapActors} />
            {phase === "idle" && (
              <div className="absolute inset-0 grid place-items-center rounded-lg bg-background/70 backdrop-blur-sm">
                <div className="text-center space-y-3 p-4 sm:p-6 max-w-md">
                  <h2 className="text-lg font-bold">Готовы к рейсу?</h2>
                  <p className="text-sm text-muted-foreground">
                    {isTraining
                      ? "Режим тренировки: при событии рейс ставится на паузу, верные ответы подсвечены, есть подсказки. Результат идёт в баллы обучения."
                      : "Проверочный рейс: без пауз и подсказок. Таймер на каждое решение, фиксируется скорость реакции. Результат идёт в баллы практики."}
                  </p>
                  <Button size="lg" onClick={() => setPhase("running")} data-testid="button-start">
                    <PlayIcon className="size-4 mr-1.5" /> Начать рейс
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {phase === "running" && isTraining && (
              <Button size="sm" variant="outline" onClick={() => setPhase("paused")} data-testid="button-pause">
                <Pause className="size-4 mr-1" /> Пауза
              </Button>
            )}
            {phase === "paused" && (
              <Button size="sm" onClick={() => setPhase("running")} data-testid="button-resume">
                <PlayIcon className="size-4 mr-1" /> Продолжить
              </Button>
            )}
            {phase !== "idle" && (
              <Button size="sm" variant="ghost" onClick={reset} data-testid="button-reset">
                <RotateCcw className="size-4 mr-1" /> Заново
              </Button>
            )}
            {isTraining && phase !== "idle" && phase !== "done" && manualEvents.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Zap className="size-3.5" /> Песочница:
                </span>
                {manualEvents.map((e) => (
                  <Button key={e.id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => { triggerEvent(simRef.current, data, e.id); setFrame((f) => f + 1); }} data-testid={`button-trigger-${e.id}`}>
                    {e.title}
                  </Button>
                ))}
              </div>
            )}
            <div className="w-full">
              <Legend />
            </div>
          </div>
        </section>

        <aside className={cn("space-y-4", (activeEvent || phase === "done") && "order-first xl:order-none")}>
          {phase === "done" && result ? (
            <ResultCard result={result} mode={mode} sid={sid} onRetry={reset} saving={submit.isPending} />
          ) : activeEvent && activeNode ? (
            <Card className="border-[hsl(var(--danger))]/40 shadow-lg" data-testid="card-dialogue">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <Badge className={cn("border-0 mb-2", CATEGORY_COLOR[activeEvent.category])}>{EVENT_CATEGORY_LABEL[activeEvent.category]}</Badge>
                    <CardTitle className="text-base leading-snug">{activeEvent.title}</CardTitle>
                  </div>
                  {!isTraining && timerLeft !== null && <TimerRing left={timerLeft} total={activeNode.timerSec!} />}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-muted/60 p-3">
                  <div className="text-xs text-muted-foreground mb-1">{activeNode.speaker}</div>
                  <p className="text-sm leading-relaxed" data-testid="text-dialogue">{activeNode.text}</p>
                </div>
                <div className="space-y-2">
                  {visibleOptions(activeNode, sim).map((o, i) => (
                    <button
                      key={o.id}
                      onClick={() => { chooseOption(simRef.current, data, o); setFrame((f) => f + 1); }}
                      data-testid={`button-option-${o.id}`}
                      className={cn(
                        "w-full text-left rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:border-primary/40",
                        isTraining && o.correct && "border-[hsl(var(--safety))]/60 bg-[hsl(var(--safety))]/5",
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground mr-2">{i + 1}</span>
                      {o.text}
                      {isTraining && o.hint && o.correct && (
                        <span className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Lightbulb className="size-3.5 shrink-0 mt-0.5 text-[hsl(var(--loyalty))]" /> {o.hint}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {isTraining && <p className="text-xs text-muted-foreground">Верный вариант подсвечен зелёным. В проверочном рейсе подсказок не будет.</p>}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Журнал рейса</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm" data-testid="list-feed">
                  {[...sim.feed].reverse().slice(0, 10).map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-xs text-muted-foreground tabular pt-0.5 w-10 shrink-0">
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

          {phase !== "done" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Пассажиры в вагоне {car.number}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {sim.actors.filter((a) => a.carId === car.id).map((ra) => {
                  const def = data.actors.find((a) => a.id === ra.id)!;
                  return (
                    <div key={ra.id} className="flex items-center gap-2" data-testid={`row-actor-${ra.id}`}>
                      <span className="truncate">{def.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {ra.path.length ? "идёт" : ra.seated ? (ra.wrongSeat ? "чужое место" : "сидит") : ra.done ? "стоит" : "ждёт"}
                      </span>
                      {def.role !== "conductor" && <span className="font-mono text-xs tabular w-7 text-right">{ra.mood}</span>}
                    </div>
                  );
                })}
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
