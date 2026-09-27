import { Link } from "wouter";
import { GraduationCap, ClipboardCheck, TrainFront, Users, Zap, Trophy, MessageCircle, MousePointerClick } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useScenarios, useLeaderboard } from "@/lib/api";
import { useApp } from "@/lib/player";

/** Краткая карта продукта с небольшими визуальными примерами реальных действий. */
function HowItWorks() {
  return (
    <section className="mb-7" aria-labelledby="how-it-works-title" data-testid="section-how-it-works">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="how-it-works-title" className="text-xl font-bold tracking-tight">Как проходит тренировка</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Выберите рабочую ситуацию, принимайте решения по ходу рейса и получите персональный разбор навыков.</p>
        </div>
        <span className="text-xs text-muted-foreground">Ситуация → действие → обратная связь</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><MousePointerClick className="size-4 text-primary" /> 1. Выберите ситуацию и режим</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-32 rounded-lg border bg-muted/35 p-2.5 text-xs">
              <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 shadow-sm">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10"><TrainFront className="size-4 text-primary" /></span>
                <span className="min-w-0"><b className="block truncate">Ситуации на борту</b><span className="text-[10px] text-muted-foreground">4 рабочих события</span></span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-primary/35 bg-primary/5 p-2"><GraduationCap className="mb-0.5 size-3.5 text-primary" /><b className="block">Тренировка</b><span className="text-[10px] text-muted-foreground">пауза и подсказки</span></div>
                <div className="rounded-md border border-[hsl(var(--danger))]/30 bg-card p-2"><ClipboardCheck className="mb-0.5 size-3.5 text-[hsl(var(--danger))]" /><b className="block">Проверка</b><span className="text-[10px] text-muted-foreground">таймер и рейтинг</span></div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Выберите готовый сценарий и формат прохождения. В тренировке доступны пауза и подсказки, а в проверке решения принимаются на время.</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="size-4 text-[hsl(var(--loyalty))]" /> 2. Действуйте по обстановке</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-32 rounded-lg border bg-muted/35 p-2.5 text-xs">
              <div className="flex gap-1.5 text-[10px]">
                <span className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-md bg-[hsl(var(--danger))]/10 px-2 py-1 text-[hsl(var(--danger))]"><Zap className="size-3 shrink-0" /><span className="truncate">Вагон 6 · срочно</span></span>
                <span className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-primary"><Users className="size-3 shrink-0" /><span className="truncate">Вагон 4 · помощь</span></span>
              </div>
              <div className="mt-2 rounded-md border bg-card p-2 shadow-sm">
                <span className="block text-[10px] text-muted-foreground">Что требует внимания первым?</span>
                <span className="mt-1 flex items-center justify-between gap-2 rounded bg-primary px-2 py-1.5 font-medium text-primary-foreground"><span className="truncate">Устранить риск безопасности</span><span aria-hidden="true">→</span></span>
              </div>
              <div className="mt-1.5 flex gap-1.5 text-[10px]"><span className="rounded bg-[hsl(var(--safety))]/15 px-1.5 py-0.5 text-[hsl(var(--safety))]">безопасность +5</span><span className="rounded bg-[hsl(var(--loyalty))]/15 px-1.5 py-0.5 text-[hsl(var(--loyalty))]">лояльность −2</span></div>
            </div>
            <p className="text-sm text-muted-foreground">Следите за событиями в разных вагонах, общайтесь с пассажирами и расставляйте приоритеты. Решения влияют на безопасность и лояльность.</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="size-4 text-[hsl(var(--safety))]" /> 3. Получите разбор рейса</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-32 rounded-lg border bg-muted/35 p-2.5 text-xs">
              <div className="flex items-center justify-between"><b>Результат рейса</b><span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary">84 / 100</span></div>
              <div className="mt-2 space-y-1.5">
                <div><div className="mb-0.5 flex justify-between text-[10px]"><span>Безопасность</span><b>88%</b></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-[88%] rounded-full bg-[hsl(var(--safety))]" /></div></div>
                <div><div className="mb-0.5 flex justify-between text-[10px]"><span>Лояльность</span><b>76%</b></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-[76%] rounded-full bg-[hsl(var(--loyalty))]" /></div></div>
              </div>
              <div className="mt-2 rounded-md border border-[hsl(var(--danger))]/20 bg-card px-2 py-1.5 text-[10px]"><span className="text-muted-foreground">Укрепить навык:</span> <b>скорость реакции</b></div>
            </div>
            <p className="text-sm text-muted-foreground">После завершения вы увидите последствия решений, ошибки и сильные стороны. Результат сохранится в профиле и подскажет, что улучшить.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function LeaderboardPreview({ board, player }: { board: { name: string; activePoints: number; trainingPoints: number }[] | undefined; player: string }) {
  const top = board?.slice(0, 3) ?? [];
  const podium = [top[1], top[0], top[2]];
  const heights = ["h-14", "h-20", "h-11"];

  return (
    <section className="mx-auto mt-8 w-full max-w-3xl rounded-[28px] border border-border bg-gradient-to-b from-card to-muted/45 p-4 text-card-foreground shadow-sm sm:p-6" aria-labelledby="leaderboard-preview-title" data-testid="card-leaderboard-preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="leaderboard-preview-title" className="flex items-center gap-2 text-lg font-bold"><Trophy className="size-5 text-[hsl(var(--loyalty))]" /> Лидеры практики</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Рейтинг по несгоревшим баллам практики</p>
        </div>
        <Button variant="outline" size="sm" asChild><Link href="/leaderboard">Полный рейтинг →</Link></Button>
      </div>

      {top.length > 0 ? (
        <>
          <div className="mx-auto mt-5 grid max-w-md grid-cols-3 items-end gap-2 px-3 text-center">
            {podium.map((entry, index) => {
              const rank = index === 0 ? 2 : index === 1 ? 1 : 3;
              if (!entry) return <div key={rank} />;
              return (
                <div key={entry.name} className="flex flex-col items-center gap-1">
                  <Avatar name={entry.name} rank={rank} />
                  <span className="max-w-full truncate text-xs font-medium">{entry.name}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">{entry.activePoints}</span>
                  <div className={`grid w-full place-items-center rounded-t-xl bg-primary/15 font-mono text-xl font-bold text-primary ${heights[index]}`}>{rank}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background/45">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
              <span>#</span><span>Проводник</span><span>Практика</span>
            </div>
            {board?.slice(0, 6).map((entry, index) => (
              <div key={entry.name} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 px-3 py-2 last:border-0" data-testid={`row-top-${index}`}>
                <span className="grid size-5 place-items-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">{index + 1}</span>
                <span className="flex min-w-0 items-center gap-2"><Avatar name={entry.name} rank={index + 1} small /><span className={`truncate text-sm ${entry.name === player ? "font-bold" : "font-medium"}`}>{entry.name}</span></span>
                <span className="font-mono text-sm font-semibold tabular text-primary">{entry.activePoints}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Ещё никто не проходил рейс.</div>
      )}
    </section>
  );
}

function Avatar({ name, rank, small = false }: { name: string; rank: number; small?: boolean }) {
  const colors = ["bg-primary/15 text-primary", "bg-[hsl(var(--loyalty))]/15 text-[hsl(var(--loyalty))]", "bg-[hsl(var(--safety))]/15 text-[hsl(var(--safety))]"];
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className={`grid shrink-0 place-items-center rounded-lg font-bold ${small ? "size-6 text-[10px]" : "size-9 text-xs"} ${colors[(rank - 1) % colors.length]}`}>{initials}</span>;
}

export default function Home() {
  const { data: scenarios, isLoading } = useScenarios();
  const { data: board } = useLeaderboard();
  const { player, user } = useApp();

  return (
    <Shell>
      <header className="mb-6 max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Тренажёр рабочих ситуаций</h1>
        <p className="mt-1 text-sm text-muted-foreground">Здесь проводник отрабатывает реальные сценарии в вагоне: от общения с пассажиром до безопасного решения нештатной ситуации.</p>
      </header>
      <HowItWorks />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Выберите смену</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">Тренировка — с паузой на диалогах и подсказками. Проверка — таймер на каждое решение, результат идёт в рейтинг.</p>
        </div>
      </div>

      <div>
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
                  {user?.role === "supervisor" && (
                    <Button asChild variant="outline">
                      <Link href={`/editor/${s.id}`}>Редактировать</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {scenarios && scenarios.length === 0 && (
            <div className="sm:col-span-2 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              Пока нет доступных сценариев.
            </div>
          )}
        </section>
        <LeaderboardPreview board={board} player={player} />
      </div>
    </Shell>
  );
}
