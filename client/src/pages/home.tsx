import { Link, useLocation } from "wouter";
import { Plus, Pencil, GraduationCap, ClipboardCheck, Trash2, TrainFront, Users, Zap, Trophy } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useScenarios, useSaveScenario, useDeleteScenario, useLeaderboard } from "@/lib/api";
import { buildCar, type ScenarioData } from "@shared/scenario";
import { useApp } from "@/lib/player";

function emptyScenario(): ScenarioData {
  const car = buildCar(1, "second", 12);
  return {
    version: 1,
    train: { name: "Новый состав", cars: [car] },
    actors: [{ id: "a_conductor", name: "Проводник (вы)", role: "conductor", ticket: null, spawn: { carId: car.id, x: 1, y: 2 }, mood: 100, steps: [] }],
    events: [],
    durationSec: 60,
    initial: { loyalty: 70, safety: 80 },
  };
}

export default function Home() {
  const { data: scenarios, isLoading } = useScenarios();
  const { data: board } = useLeaderboard();
  const save = useSaveScenario();
  const del = useDeleteScenario();
  const [, navigate] = useLocation();
  const { player } = useApp();

  const create = async () => {
    const s = await save.mutateAsync({
      body: { name: "Новый сценарий", description: "", difficulty: 1, data: emptyScenario() },
    });
    navigate(`/editor/${s.id}`);
  };

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Сценарии</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Песочница для подготовки к хакатону: собирайте состав, расставляйте пассажиров, задавайте им поведение и
            нештатные события, затем проходите рейс в режиме тренировки или проверки.
          </p>
        </div>
        <Button onClick={create} disabled={save.isPending} data-testid="button-create-scenario">
          <Plus className="size-4 mr-1.5" /> Новый сценарий
        </Button>
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
                  <Button size="sm" asChild data-testid={`button-train-${s.id}`}>
                    <Link href={`/play/${s.id}/training`}>
                      <GraduationCap className="size-4 mr-1" /> Тренировка
                    </Link>
                  </Button>
                  <Button size="sm" variant="secondary" asChild data-testid={`button-check-${s.id}`}>
                    <Link href={`/play/${s.id}/check`}>
                      <ClipboardCheck className="size-4 mr-1" /> Проверка
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild data-testid={`button-edit-${s.id}`}>
                    <Link href={`/editor/${s.id}`}>
                      <Pencil className="size-4 mr-1" /> Редактор
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto text-muted-foreground"
                    aria-label="Удалить"
                    onClick={() => del.mutate(s.id)}
                    data-testid={`button-delete-${s.id}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {scenarios && scenarios.length === 0 && (
            <div className="sm:col-span-2 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              Пока нет сценариев. Создайте первый.
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
                    <span className="text-[hsl(var(--safety))]">{e.practicePoints}</span>
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
