import { Trophy, Lock, GraduationCap, ClipboardCheck, Target, TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { LevelBar, ExpiringNote, Stat } from "@/components/app/widgets";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/player";
import { useProfile, useAttempts, useScenarios, useStructure } from "@/lib/api";
import { SKILL_THRESHOLDS, SKILL_WINDOW } from "@shared/rules";
import type { Skill } from "@shared/analytics";

export default function Profile() {
  const { player } = useApp();
  const { data: profile, isLoading } = useProfile(player);
  const { data: attempts } = useAttempts(player);
  const { data: scenarios } = useScenarios();
  const { data: structure } = useStructure();
  const team = structure?.teams.find((t) => t.id === profile?.teamId);
  const depot = structure?.depots.find((d) => d.id === team?.depotId);
  const scenarioName = (id: number) => scenarios?.find((s) => s.id === id)?.name ?? `Сценарий #${id}`;

  if (isLoading || !profile)
    return (
      <Shell>
        <Skeleton className="h-10 w-72 mb-4" />
        <Skeleton className="h-72 w-full" />
      </Shell>
    );

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">{player}</h1>
        <p className="text-sm text-muted-foreground">{team && depot ? `${team.name} · ${depot.name}` : "Бригада не назначена"}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <LevelBar level={profile.level} />
              {profile.expiring && <ExpiringNote expiring={profile.expiring} />}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat icon={<ClipboardCheck className="size-4" />} label="Баллы практики" value={profile.activePoints} />
                <Stat icon={<GraduationCap className="size-4" />} label="Обучение" value={profile.trainingPoints} />
                <Stat label="Рейсов" value={profile.attempts} />
                <Stat label="Лучший балл" value={profile.bestScore} />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-skills">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Навыки</CardTitle>
              <p className="text-xs text-muted-foreground">Среднее по последним {SKILL_WINDOW} рейсам. Отметка на шкале — порог «освоено».</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.skills.map((s) => (
                <SkillRow key={s.key} skill={s} />
              ))}
            </CardContent>
          </Card>

          <Card data-testid="card-insights">
            <CardHeader className="pb-2">
              <CardTitle className="text-base inline-flex items-center gap-2">
                <Lightbulb className="size-4 text-[hsl(var(--loyalty))]" /> Выводы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm list-disc pl-4">
                {profile.insights.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!!profile.challenges.length && (
            <Card data-testid="card-challenges">
              <CardHeader className="pb-2">
                <CardTitle className="text-base inline-flex items-center gap-2">
                  <Target className="size-4 text-[hsl(var(--safety))]" /> Челленджи
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.challenges.map((c) => (
                  <div key={c.id} data-testid={`challenge-${c.id}`}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{c.title}</span>
                      <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">+{c.rewardXp} XP</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {c.description} · до {new Date(c.endsAt).toLocaleDateString("ru-RU")}
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={(c.current / c.target) * 100} className="h-1.5 flex-1" />
                      <span className="font-mono text-xs tabular">{c.done ? "готово" : `${c.current}/${c.target}`}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Достижения</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {profile.achievements.map((a) => (
                  <li key={a.id} className={cn("flex items-start gap-2.5 rounded-md border p-2.5", a.unlocked ? "border-[hsl(var(--safety))]/40 bg-[hsl(var(--safety))]/5" : "opacity-60")} data-testid={`achievement-${a.id}`}>
                    <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", a.unlocked ? "bg-[hsl(var(--safety))] text-white" : "bg-muted")}>
                      {a.unlocked ? <Trophy className="size-3.5" /> : <Lock className="size-3" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.description}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Последние рейсы</CardTitle>
            </CardHeader>
            <CardContent>
              {!attempts?.length ? (
                <p className="text-sm text-muted-foreground">История пуста.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {attempts.slice(0, 8).map((a) => (
                    <li key={a.id} className="flex items-center gap-2" data-testid={`row-attempt-${a.id}`}>
                      <Badge variant={a.mode === "check" ? "default" : "secondary"} className="text-[10px] px-1.5">
                        {a.mode === "check" ? "Проверка" : "Тренировка"}
                      </Badge>
                      <span className="truncate">{scenarioName(a.scenarioId)}</span>
                      <span className="ml-auto font-mono tabular font-semibold">{a.score}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function SkillRow({ skill: s }: { skill: Skill }) {
  const threshold = SKILL_THRESHOLDS[s.key];
  return (
    <div data-testid={`skill-${s.key}`}>
      <div className="flex items-center gap-2 text-sm mb-1">
        <span>{s.label}</span>
        {s.status !== "none" && (
          <Badge variant="outline" className={cn("text-[10px] px-1.5", s.status === "mastered" ? "border-[hsl(var(--safety))]/50 text-[hsl(var(--safety))]" : "border-[hsl(var(--danger))]/50 text-[hsl(var(--danger))]")}>
            {s.status === "mastered" ? "освоено" : "проседает"}
          </Badge>
        )}
        {s.trend !== null && s.trend !== 0 && (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-mono", s.trend > 0 ? "text-[hsl(var(--safety))]" : "text-[hsl(var(--danger))]")}>
            {s.trend > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {s.trend > 0 ? `+${s.trend}` : s.trend}
          </span>
        )}
        <span className="ml-auto font-mono tabular text-xs">{s.value ?? "—"}</span>
      </div>
      <div className="relative">
        <Progress value={s.value ?? 0} className="h-1.5" />
        <span className="absolute -top-0.5 h-2.5 w-0.5 bg-foreground/60" style={{ left: `${threshold}%` }} aria-hidden />
      </div>
    </div>
  );
}
