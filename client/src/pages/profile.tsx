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
              <p className="text-xs text-muted-foreground">Среднее по последним {SKILL_WINDOW} рейсам. В каждом лепестке — текущая оценка; рядом указан порог «освоено».</p>
            </CardHeader>
            <CardContent>
              <SkillPetalChart skills={profile.skills} />
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

const PETAL_COLORS = ["#9c8cf2", "#a99cf5", "#ffad5d", "#43c8e5", "#38b9dc"];
const PETAL_CENTER = { x: 280, y: 205 };
const PETAL_RADIUS = 122;
const LABEL_RADIUS = 174;
const PETAL_GAP = 5;

function petalPoint(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: PETAL_CENTER.x + Math.cos(radians) * radius,
    y: PETAL_CENTER.y + Math.sin(radians) * radius,
  };
}

function petalPath(index: number, total: number, radius: number) {
  const segment = 360 / total;
  const angle = -90 + index * segment;
  const halfSegment = segment / 2;
  const start = petalPoint(angle - halfSegment + PETAL_GAP, 10);
  const outerStart = petalPoint(angle - halfSegment + PETAL_GAP, radius);
  const outerEnd = petalPoint(angle + halfSegment - PETAL_GAP, radius);
  const end = petalPoint(angle + halfSegment - PETAL_GAP, 10);
  const tip = petalPoint(angle, radius + 8);

  return `M ${start.x} ${start.y} L ${outerStart.x} ${outerStart.y} Q ${tip.x} ${tip.y} ${outerEnd.x} ${outerEnd.y} L ${end.x} ${end.y} Q ${PETAL_CENTER.x} ${PETAL_CENTER.y} ${start.x} ${start.y} Z`;
}

function SkillPetalChart({ skills }: { skills: Skill[] }) {
  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 560 420"
        className="mx-auto block w-full max-w-[560px] overflow-visible"
        role="img"
        aria-label="Диаграмма навыков. Длина лепестка соответствует текущей оценке навыка от нуля до ста."
      >
        <title>Навыки</title>
        {skills.map((skill, index) => {
          const value = skill.value ?? 0;
          const angle = -90 + index * (360 / skills.length);
          const label = petalPoint(angle, LABEL_RADIUS);
          const score = petalPoint(angle, Math.max(48, (PETAL_RADIUS * value * 0.62) / 100));
          const horizontal = Math.cos((angle * Math.PI) / 180);
          const color = PETAL_COLORS[index % PETAL_COLORS.length];

          return (
            <g key={skill.key} data-testid={`skill-${skill.key}`}>
              <path d={petalPath(index, skills.length, PETAL_RADIUS)} fill={color} opacity="0.13" />
              {skill.value !== null && <path d={petalPath(index, skills.length, Math.max(18, (PETAL_RADIUS * value) / 100))} fill={color} />}
              <text
                x={label.x}
                y={label.y}
                textAnchor={horizontal < -0.2 ? "end" : horizontal > 0.2 ? "start" : "middle"}
                dominantBaseline="middle"
                className="fill-muted-foreground text-[12px] font-medium"
              >
                {skill.label}
              </text>
              {skill.value !== null && (
                <text x={score.x} y={score.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-800 text-[13px] font-bold dark:fill-slate-950">
                  {value}%
                </text>
              )}
            </g>
          );
        })}
        <circle cx={PETAL_CENTER.x} cy={PETAL_CENTER.y} r="7" className="fill-card stroke-card-border" strokeWidth="2" />
      </svg>

      <div className="grid gap-2 sm:grid-cols-2" aria-label="Подробности навыков">
        {skills.map((s) => {
          const threshold = SKILL_THRESHOLDS[s.key];
          return (
            <div key={s.key} className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/45 px-2.5 py-2 text-xs">
              <span className="truncate font-medium">{s.label}</span>
              {s.status !== "none" && (
                <Badge variant="outline" className={cn("ml-auto shrink-0 text-[10px] px-1.5", s.status === "mastered" ? "border-[hsl(var(--safety))]/50 text-[hsl(var(--safety))]" : "border-[hsl(var(--danger))]/50 text-[hsl(var(--danger))]") }>
                  {s.status === "mastered" ? "освоено" : "проседает"}
                </Badge>
              )}
              {s.trend !== null && s.trend !== 0 && (
                <span className={cn("inline-flex shrink-0 items-center gap-0.5 font-mono", s.trend > 0 ? "text-[hsl(var(--safety))]" : "text-[hsl(var(--danger))]") }>
                  {s.trend > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {s.trend > 0 ? `+${s.trend}` : s.trend}
                </span>
              )}
              <span className="shrink-0 font-mono tabular text-muted-foreground">{s.value ?? "—"}/<span className="text-[10px]">{threshold}</span></span>
            </div>
          );
        })}
      </div>
    </div>
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
