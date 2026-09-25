import { Trophy, Medal, Lock, GraduationCap, ClipboardCheck } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/player";
import { useLeaderboard, useProfile, useAttempts, useScenarios } from "@/lib/api";
import type { LevelInfo } from "@shared/gamification";

export default function Leaderboard() {
  const { player } = useApp();
  const { data: board, isLoading } = useLeaderboard();
  const { data: profile } = useProfile(player);
  const { data: attempts } = useAttempts(player);
  const { data: scenarios } = useScenarios();

  const scenarioName = (id: number) => scenarios?.find((s) => s.id === id)?.name ?? `Сценарий #${id}`;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Рейтинг проводников</h1>
        <p className="text-sm text-muted-foreground">
          Баллы обучения начисляются за тренировки, баллы практики — только за проверочные рейсы. Место в таблице определяют баллы практики.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base inline-flex items-center gap-2">
              <Trophy className="size-4 text-[hsl(var(--loyalty))]" /> Таблица лидеров
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : !board?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Пока нет ни одного рейса. Пройдите сценарий — и вы будете первым.</p>
            ) : (
              <Table data-testid="table-leaderboard">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Проводник</TableHead>
                    <TableHead className="text-right">Практика</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Обучение</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Рейсов</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Лучший</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.map((e, i) => (
                    <TableRow key={e.name} className={cn(e.name === player && "bg-primary/5")} data-testid={`row-leader-${i}`}>
                      <TableCell className="font-mono tabular">
                        {i < 3 ? <Medal className={cn("size-4", i === 0 && "text-amber-500", i === 1 && "text-slate-400", i === 2 && "text-orange-700")} /> : i + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {e.name} {e.name === player && <span className="text-xs text-muted-foreground">(вы)</span>}
                        <div className="text-xs text-muted-foreground font-normal">
                          Ур. {e.level} · {e.levelTitle}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular font-semibold">{e.practicePoints}</TableCell>
                      <TableCell className="text-right font-mono tabular hidden sm:table-cell">{e.trainingPoints}</TableCell>
                      <TableCell className="text-right font-mono tabular hidden md:table-cell">{e.attempts}</TableCell>
                      <TableCell className="text-right font-mono tabular hidden md:table-cell">{e.bestScore}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card data-testid="card-profile">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Профиль: {player}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile && <LevelBar level={profile.level} />}
              <div className="grid grid-cols-2 gap-3">
                <Stat icon={<ClipboardCheck className="size-4" />} label="Практика" value={profile?.practicePoints ?? 0} />
                <Stat icon={<GraduationCap className="size-4" />} label="Обучение" value={profile?.trainingPoints ?? 0} />
                <Stat label="Рейсов" value={profile?.attempts ?? 0} />
                <Stat label="Лучший балл" value={profile?.bestScore ?? 0} />
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">Достижения</div>
                <ul className="space-y-1.5">
                  {(profile?.achievements ?? []).map((a) => (
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
              </div>
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

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/60 p-2.5">
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">{icon}{label}</div>
      <div className="font-mono text-xl font-bold tabular leading-tight">{value}</div>
    </div>
  );
}

export function LevelBar({ level }: { level: LevelInfo }) {
  return (
    <div data-testid="level-bar">
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="font-semibold">
          Уровень {level.level} · {level.title}
        </span>
        <span className="font-mono text-xs tabular text-muted-foreground">
          {level.nextLevelXp === null ? `${level.xp} XP · максимум` : `${level.xp} / ${level.nextLevelXp} XP`}
        </span>
      </div>
      <Progress value={level.progress * 100} className="h-1.5" />
    </div>
  );
}
