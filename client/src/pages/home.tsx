import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Pencil, GraduationCap, ClipboardCheck, Trash2, TrainFront, Users, Zap, Trophy, Wrench, Gamepad2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Shell } from "@/components/app/Shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useScenarios, useSaveScenario, useDeleteScenario, useLeaderboard } from "@/lib/api";
import { deleteScenarioMessage } from "@/lib/deleteConfirmation";
import { buildCar, type ScenarioData } from "@shared/scenario";
import { useApp } from "@/lib/player";

function emptyScenario(): ScenarioData {
  const car = buildCar(1, "comfort", 12);
  return {
    version: 1,
    train: { name: "Новый состав", cars: [car] },
    actors: [{ id: "a_conductor", name: "Проводник (вы)", role: "conductor", ticket: null, spawn: { carId: car.id, x: 1, y: 2 }, mood: 100, steps: [] }],
    events: [],
    durationSec: 60,
    initial: { loyalty: 70, safety: 80 },
  };
}

type HomeMode = "play" | "create";
const MODE_KEY = "vsm-home-mode";

/** Два входа: «Начать смену» (прохождение) и «Создать сценарий» (конструктор) */
function ModeSwitch({ mode, onChange }: { mode: HomeMode; onChange: (m: HomeMode) => void }) {
  const items: { key: HomeMode; title: string; text: string; icon: typeof Gamepad2 }[] = [
    { key: "play", title: "Начать смену", text: "Пройти рейс в вагоне: пассажиры, диалоги, последствия решений. Тренировка или проверка.", icon: Gamepad2 },
    { key: "create", title: "Создать сценарий", text: "Конструктор: состав, пассажиры, события, ветвления и визуальная сцена. Предпросмотр игры.", icon: Wrench },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 mb-6" role="tablist" aria-label="Режим работы">
      {items.map(({ key, title, text, icon: Icon }) => {
        const active = key === mode;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            data-testid={`button-mode-${key}`}
            className={cn(
              "group relative overflow-hidden rounded-xl border p-5 text-left min-h-[44px] transition-colors",
              active
                ? key === "play"
                  ? "border-primary bg-primary text-primary-foreground shadow-lg"
                  : "border-foreground/80 bg-foreground text-background shadow-lg"
                : "bg-card hover:bg-accent",
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn("grid place-items-center size-11 shrink-0 rounded-lg", active ? "bg-white/15" : "bg-muted")}>
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block text-lg font-bold tracking-tight">{title}</span>
                <span className={cn("block text-sm mt-0.5", active ? "opacity-85" : "text-muted-foreground")}>{text}</span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function Home() {
  const { data: scenarios, isLoading } = useScenarios();
  const { data: board } = useLeaderboard();
  const save = useSaveScenario();
  const del = useDeleteScenario();
  const [, navigate] = useLocation();
  const { player } = useApp();
  const [mode, setModeState] = useState<HomeMode>(() => (localStorage.getItem(MODE_KEY) === "create" ? "create" : "play"));
  const setMode = (m: HomeMode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  };

  const create = async () => {
    const s = await save.mutateAsync({
      body: { name: "Новый сценарий", description: "", difficulty: 1, data: emptyScenario() },
    });
    navigate(`/editor/${s.id}`);
  };

  const remove = (scenario: { id: number; name: string }) => {
    if (!window.confirm(deleteScenarioMessage(scenario))) return;
    del.mutate(scenario.id);
  };

  return (
    <Shell>
      <ModeSwitch mode={mode} onChange={setMode} />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{mode === "play" ? "Выберите смену" : "Мои сценарии"}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {mode === "play"
              ? "Тренировка — с паузой на диалогах и подсказками. Проверка — таймер на каждое решение, результат идёт в рейтинг."
              : "Собирайте состав, расставляйте пассажиров, задавайте поведение и нештатные события, настраивайте визуальную сцену."}
          </p>
        </div>
        {mode === "create" && (
          <Button onClick={create} disabled={save.isPending} className="min-h-11" data-testid="button-create-scenario">
            <Plus className="size-4 mr-1.5" /> Новый сценарий
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
        <section className="grid gap-4 sm:grid-cols-2 content-start">
          {isLoading &&
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
          {scenarios?.map((s) => (
            <Card key={s.id} data-testid={`card-scenario-${s.id}`} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{s.name}</CardTitle>
                  <Badge variant="secondary" className="shrink-0">
                    {["", "Базовый", "Средний", "Сложный"][s.difficulty] ?? "Базовый"}
                  </Badge>
                </div>
                {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <TrainFront className="size-3.5" /> {s.data.train.cars.length} ваг.
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {s.data.actors.length} акторов
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Zap className="size-3.5" /> {s.data.events.length} событий
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mode === "play" ? (
                    <>
                      <Button className="min-h-11 flex-1" asChild data-testid={`button-train-${s.id}`}>
                        <Link href={`/play/${s.id}/training`}>
                          <GraduationCap className="size-4 mr-1" /> Тренировка
                        </Link>
                      </Button>
                      <Button className="min-h-11 flex-1" variant="secondary" asChild data-testid={`button-check-${s.id}`}>
                        <Link href={`/play/${s.id}/check`}>
                          <ClipboardCheck className="size-4 mr-1" /> Проверка
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button className="min-h-11" asChild data-testid={`button-edit-${s.id}`}>
                        <Link href={`/editor/${s.id}`}>
                          <Pencil className="size-4 mr-1" /> Редактор
                        </Link>
                      </Button>
                      <Button className="min-h-11" variant="outline" asChild data-testid={`button-preview-${s.id}`}>
                        <Link href={`/play/${s.id}/training`}>
                          <Eye className="size-4 mr-1" /> Предпросмотр
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto size-11 text-muted-foreground hover:text-destructive"
                        aria-label={`Удалить сценарий «${s.name}»`}
                        title="Удалить сценарий"
                        disabled={del.isPending}
                        onClick={() => remove(s)}
                        data-testid={`button-delete-${s.id}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {scenarios && scenarios.length === 0 && (
            <div className="sm:col-span-2 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              {mode === "play" ? "Пока нет сценариев. Переключитесь в «Создать сценарий»." : "Пока нет сценариев. Создайте первый."}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="size-4 text-[hsl(var(--loyalty))]" /> Топ проводников
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {board?.slice(0, 5).map((e, i) => (
                <div key={e.name} className="flex items-center gap-2 text-sm" data-testid={`row-top-${i}`}>
                  <span className="font-mono text-muted-foreground w-4">{i + 1}</span>
                  <span className={e.name === player ? "font-semibold" : ""}>{e.name}</span>
                  <span className="ml-auto font-mono tabular text-xs">
                    <span className="text-[hsl(var(--safety))]">{e.activePoints}</span>
                    <span className="text-muted-foreground"> / {e.trainingPoints}</span>
                  </span>
                </div>
              ))}
              {board && board.length === 0 && <p className="text-sm text-muted-foreground">Ещё никто не проходил рейс.</p>}
              <p className="text-xs text-muted-foreground pt-1">практика / обучение</p>
              <Button variant="ghost" size="sm" className="px-0" asChild>
                <Link href="/leaderboard">Полный рейтинг →</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Как это устроено</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <b className="text-foreground">Редактор</b> — карта вагона сверху. Кликните по клетке, чтобы поставить
                пассажира, задайте ему билет и список шагов: идти, сесть, ждать, запустить событие.
              </p>
              <p>
                <b className="text-foreground">Событие</b> — граф диалога с вариантами ответа, таймером и эффектами на
                лояльность и безопасность.
              </p>
              <p>
                <b className="text-foreground">Тренировка</b> ставит рейс на паузу и показывает подсказки.{" "}
                <b className="text-foreground">Проверка</b> идёт без пауз и фиксирует скорость реакции.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </Shell>
  );
}
