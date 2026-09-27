import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  GraduationCap,
  MessageCircle,
  MousePointerClick,
  ShieldAlert,
  TrainFront,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useScenarios, useLeaderboard } from "@/lib/api";
import { useApp } from "@/lib/player";
import { HOME_HERO_TRAIN_ASSET } from "@/game/assets";

function AccentBlocks() {
  return (
    <section className="mb-8 grid gap-3 md:grid-cols-4" aria-label="Ключевые акценты тренажера">
      <div className="rzd-sign-card md:col-span-1">
        <span className="text-xs font-bold uppercase text-muted-foreground">Обучение:</span>
        <strong className="font-mono text-6xl leading-none">9</strong>
        <span className="font-mono text-xl font-bold">практик с различными сценариями трех уровней сложности</span>
      </div>
      <div className="rzd-sign-card rzd-sign-card--red md:col-span-2">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white">
            <img 
              src=".\public\leaderboard.png" 
              alt="Alert Icon" 
              className="size-7 object-contain" 
            />
          </span>
          <div>
            <span className="block text-xs font-bold uppercase opacity-80">Рейтинг и геймификация</span>
            <strong className="block text-2xl leading-tight">Сравнивай свои результаты с коллегами и отслеживайте прогресс в разделе "Рейтинг"</strong>
          </div>
        </div>

      </div>
      <div className="rzd-sign-card rzd-sign-card--dark">
        <span className="text-xs font-bold uppercase opacity-70">рейс</span>
        <strong className="text-3xl leading-none">ВСМ</strong>
        <span className="text-sm opacity-80">симуляция салона</span>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: MousePointerClick,
      title: "Выберите ситуацию",
      text: "Сценарии собраны как рабочие смены: вагон, пассажиры, события и уровень сложности видны до запуска.",
      meta: "сценарий / режим",
    },
    {
      icon: MessageCircle,
      title: "Действуйте в рейсе",
      text: "Диалоги, перемещения и инциденты идут параллельно. В проверке каждое решение ограничено временем.",
      meta: "диалог / таймер",
    },
    {
      icon: ClipboardCheck,
      title: "Получите разбор",
      text: "После рейса тренажер показывает результат по безопасности, лояльности, компетенциям и ошибкам.",
      meta: "оценка / навыки",
    },
  ];

  return (
    <section className="mb-8" aria-labelledby="how-it-works-title" data-testid="section-how-it-works">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="rzd-kicker">маршрут обучения</span>
          <h2 id="how-it-works-title" className="mt-1 text-2xl font-bold tracking-tight">Как проходит тренировка</h2>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
          ситуация → действие → обратная связь
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {steps.map((step, index) => (
          <Card key={step.title} className="rzd-accent-card overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-md bg-[hsl(var(--danger))] text-white">
                  <step.icon className="size-5" />
                </span>
                <span className="font-mono text-4xl font-black text-muted">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <CardTitle className="text-lg">{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{step.text}</p>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs font-bold uppercase text-muted-foreground">{step.meta}</span>
                <ArrowRight className="size-4 text-[hsl(var(--danger))]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function LeaderboardPreview({ board, player }: { board: { name: string; activePoints: number; trainingPoints: number }[] | undefined; player: string }) {
  const top = board?.slice(0, 3) ?? [];

  return (
    <section className="rzd-panel" aria-labelledby="leaderboard-preview-title" data-testid="card-leaderboard-preview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="rzd-kicker">табло практики</span>
          <h2 id="leaderboard-preview-title" className="mt-1 flex items-center gap-2 text-xl font-bold">
            <Trophy className="size-5 text-[hsl(var(--danger))]" /> Лидеры рейсов
          </h2>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/leaderboard">Рейтинг <ArrowRight className="size-3.5" /></Link>
        </Button>
      </div>

      {top.length > 0 ? (
        <div className="mt-5 space-y-2">
          {board?.slice(0, 6).map((entry, index) => (
            <div key={entry.name} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-background px-3 py-2" data-testid={`row-top-${index}`}>
              <span className={index === 0 ? "rzd-rank rzd-rank--first" : "rzd-rank"}>{index + 1}</span>
              <span className="min-w-0">
                <span className={`block truncate text-sm ${entry.name === player ? "font-bold" : "font-medium"}`}>{entry.name}</span>
                <span className="text-xs text-muted-foreground">тренировка {entry.trainingPoints}</span>
              </span>
              <span className="font-mono text-lg font-black tabular text-[hsl(var(--danger))]">{entry.activePoints}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Еще никто не проходил рейс.</div>
      )}
    </section>
  );
}

export default function Home() {
  const { data: scenarios, isLoading } = useScenarios();
  const { data: board } = useLeaderboard();
  const { player } = useApp();

  return (
    <Shell>
      <header className="rzd-hero mb-8 overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="rzd-kicker">ВСМ-400</span>
          <h1 className="mt-4 text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl">
            Симулятор профессиональных компетенций проводника 
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Отрабатывайте реальные сценарии на рейсах -  сервис, безопасность, нестандартные ситуации и коммуникацию с пассажирами. Практикуйте нелинейные сценарии с таймером на решение, где каждый выбор отдельно влияет на лояльность пассажира и на рейтинг безопасности.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <a href="#scenarios"><GraduationCap className="size-4" /> Начать смену</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/leaderboard"><Trophy className="size-4" /> Смотреть рейтинг</Link>
            </Button>
          </div>
        </div>
        <div className="rzd-hero__media" aria-hidden="true">
          <img src={HOME_HERO_TRAIN_ASSET} alt="" />
        </div>
      </header>

      <AccentBlocks />
      <HowItWorks />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div id="scenarios">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="rzd-kicker">сценарии</span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Выберите смену</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Тренировка дает паузу и подсказки. Проверочный рейс включает таймер, а результат идет в рейтинг.
              </p>
            </div>
          </div>

          <section className="grid content-start gap-4 sm:grid-cols-2">
            {isLoading &&
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-md" />)}
            {scenarios?.map((s) => (
              <Card key={s.id} data-testid={`card-scenario-${s.id}`} className="rzd-scenario-card flex flex-col overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
                    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      <TrainFront className="size-4 text-[hsl(var(--danger))]" /> вагонная смена
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {["", "Базовый", "Средний", "Сложный"][s.difficulty] ?? "Базовый"}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl leading-tight">{s.name}</CardTitle>
                  {s.description && <p className="line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                </CardHeader>
                <CardContent className="mt-auto space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span className="rzd-mini-stat"><TrainFront className="size-3.5" /> {s.data.train.cars.length} ваг.</span>
                    <span className="rzd-mini-stat"><Users className="size-3.5" /> {s.data.actors.length}</span>
                    <span className="rzd-mini-stat"><Zap className="size-3.5" /> {s.data.events.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="min-h-11 flex-1" asChild data-testid={`button-train-${s.id}`}>
                      <Link href={`/play/${s.id}/training`}>
                        <GraduationCap className="mr-1 size-4" /> Тренировка
                      </Link>
                    </Button>
                    <Button className="min-h-11 flex-1" variant="secondary" asChild data-testid={`button-check-${s.id}`}>
                      <Link href={`/play/${s.id}/check`}>
                        <ClipboardCheck className="mr-1 size-4" /> Проверка
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {scenarios && scenarios.length === 0 && (
              <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground sm:col-span-2">
                Пока нет доступных сценариев.
              </div>
            )}
          </section>
        </div>
        <div className="space-y-4">
          <div className="rzd-panel rzd-panel--dark">
            <span className="rzd-kicker text-white/60">контрольные метрики</span>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-white/60">безопасность</span>
                <strong className="block font-mono text-4xl">88%</strong>
              </div>
              <div>
                <span className="text-xs text-white/60">лояльность</span>
                <strong className="block font-mono text-4xl">76%</strong>
              </div>
            </div>
            <p className="mt-4 border-t border-white/15 pt-3 text-sm text-white/70">
              Разбор показывает сильные решения и навыки, которые нужно усилить перед следующей сменой.
            </p>
          </div>
          <div className="rzd-panel rzd-panel--red">
            <BadgeCheck className="size-8" />
            <strong className="text-xl">Отрабатывайте действия в нестандартных ситуациях и развивайте навыки многозадачности на новых сценариях</strong>
            <span className="text-sm opacity-85">Сценарий меняется в зависимости от класса обслуживания и особых потребностей пассажира</span>
          </div>
          <LeaderboardPreview board={board} player={player} />
        </div>
      </div>
    </Shell>
  );
}
