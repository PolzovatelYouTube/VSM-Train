import { Link } from "wouter";
import { Trophy, Medal, GraduationCap, ClipboardCheck, UserRound } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LevelBar, ExpiringNote, Stat } from "@/components/app/widgets";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/player";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeaderboard, useProfile, useStructure } from "@/lib/api";
import type { LeaderboardScope } from "@shared/schema";
import { POINTS_TTL_DAYS } from "@shared/rules";

export default function Leaderboard() {
  const { player } = useApp();
  const { data: profile } = useProfile(player);
  const { data: structure } = useStructure();
  const [scope, setScope] = useState<LeaderboardScope>("team");
  // по умолчанию показываем бригаду и депо текущего проводника; руководитель может выбрать другое подразделение
  const myTeam = structure?.teams.find((t) => t.id === profile?.teamId);
  const [unit, setUnit] = useState<number | undefined>();
  const unitId = scope === "company" ? undefined : (unit ?? (scope === "team" ? myTeam?.id : myTeam?.depotId));
  const { data: board, isLoading } = useLeaderboard(scope, unitId);
  const units = scope === "team" ? structure?.teams : scope === "depot" ? structure?.depots : [];

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Рейтинг проводников</h1>
        <p className="text-sm text-muted-foreground">
          Баллы обучения начисляются за тренировки, баллы практики — только за проверочные рейсы. Место в таблице определяют баллы практики за последние {POINTS_TTL_DAYS} дней: старые баллы сгорают.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-base inline-flex items-center gap-2">
                <Trophy className="size-4 text-[hsl(var(--loyalty))]" /> Таблица лидеров
              </CardTitle>
              <Tabs value={scope} onValueChange={(v) => { setScope(v as LeaderboardScope); setUnit(undefined); }} className="ml-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="team" className="text-xs" data-testid="tab-scope-team">Бригада</TabsTrigger>
                  <TabsTrigger value="depot" className="text-xs" data-testid="tab-scope-depot">Депо</TabsTrigger>
                  <TabsTrigger value="company" className="text-xs" data-testid="tab-scope-company">Компания</TabsTrigger>
                </TabsList>
              </Tabs>
              {!!units?.length && (
                <Select value={unitId ? String(unitId) : undefined} onValueChange={(v) => setUnit(Number(v))}>
                  <SelectTrigger className="h-8 w-56 text-xs" data-testid="select-unit"><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : !board?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">В этом подразделении пока никого нет.</p>
            ) : (
              <Table data-testid="table-leaderboard">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Проводник</TableHead>
                    <TableHead className="text-right">Баллы</TableHead>
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
                          {scope !== "team" && e.team && ` · ${e.team}`}
                          {scope === "company" && e.depot && `, ${e.depot}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular font-semibold">{e.activePoints}</TableCell>
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

        <Card data-testid="card-profile">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{player}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile && <LevelBar level={profile.level} />}
            {profile?.expiring && <ExpiringNote expiring={profile.expiring} />}
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={<ClipboardCheck className="size-4" />} label="Баллы практики" value={profile?.activePoints ?? 0} />
              <Stat icon={<GraduationCap className="size-4" />} label="Обучение" value={profile?.trainingPoints ?? 0} />
            </div>
            <Button size="sm" variant="secondary" className="w-full" asChild>
              <Link href="/profile" data-testid="link-profile">
                <UserRound className="size-4 mr-1" /> Профиль, навыки и достижения
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
