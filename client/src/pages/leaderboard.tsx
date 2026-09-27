import { Link } from "wouter";
import { ArrowUpRight, ClipboardCheck, Crown, GraduationCap, Medal, Trophy, UserRound } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const scopeLabels: Record<LeaderboardScope, string> = { team: "бригада", depot: "депо", company: "компания" };

export default function Leaderboard() {
  const { player } = useApp();
  const { data: profile } = useProfile(player);
  const { data: structure } = useStructure();
  const [scope, setScope] = useState<LeaderboardScope>("team");
  const myTeam = structure?.teams.find((team) => team.id === profile?.teamId);
  const [unit, setUnit] = useState<number | undefined>();
  const unitId = scope === "company" ? undefined : (unit ?? (scope === "team" ? myTeam?.id : myTeam?.depotId));
  const { data: board, isLoading } = useLeaderboard(scope, unitId);
  const units = scope === "team" ? structure?.teams : scope === "depot" ? structure?.depots : [];
  const leader = board?.[0];

  return (
    <Shell>
      <header className="rzd-leaderboard-hero">
        <div>
          <span className="rzd-kicker">табло практики</span>
          <h1>Рейтинг проводников</h1>
          <p>Место в таблице определяют баллы проверочных рейсов за последние {POINTS_TTL_DAYS} дней.</p>
        </div>
        <div className="rzd-leaderboard-hero__note"><span>активный контур</span><strong>{scopeLabels[scope]}</strong></div>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="rzd-leaderboard-board" aria-labelledby="leaderboard-title">
          <div className="rzd-leaderboard-board__top">
            <div><span className="rzd-kicker">итоги смены</span><h2 id="leaderboard-title"><Trophy className="size-5" /> Таблица лидеров</h2></div>
            <div className="rzd-leaderboard-controls">
              <Tabs value={scope} onValueChange={(value) => { setScope(value as LeaderboardScope); setUnit(undefined); }}>
                <TabsList className="rzd-scope-tabs h-9">
                  <TabsTrigger value="team" data-testid="tab-scope-team">Бригада</TabsTrigger>
                  <TabsTrigger value="depot" data-testid="tab-scope-depot">Депо</TabsTrigger>
                  <TabsTrigger value="company" data-testid="tab-scope-company">Компания</TabsTrigger>
                </TabsList>
              </Tabs>
              {!!units?.length && <Select value={unitId ? String(unitId) : undefined} onValueChange={(value) => setUnit(Number(value))}>
                <SelectTrigger className="rzd-unit-select h-9 w-52" data-testid="select-unit"><SelectValue placeholder="Выберите подразделение" /></SelectTrigger>
                <SelectContent>{units.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
              </Select>}
            </div>
          </div>

          {leader && !isLoading && <div className="rzd-leader-card">
            <span className="rzd-leader-card__place"><Crown className="size-5" /> 01</span>
            <div className="min-w-0"><span className="text-xs font-bold uppercase tracking-[.08em] text-white/65">лидер текущего периода</span><strong className="block truncate text-xl">{leader.name}</strong><span className="text-sm text-white/75">Ур. {leader.level} · {leader.levelTitle}</span></div>
            <div className="ml-auto text-right"><span className="block text-xs font-bold uppercase tracking-[.08em] text-white/65">баллы</span><strong className="font-mono text-3xl font-black tabular">{leader.activePoints}</strong></div>
          </div>}

          <div className="rzd-leaderboard-table">
            {isLoading ? <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-14 w-full" />)}</div> : !board?.length ? <p className="p-10 text-center text-sm text-muted-foreground">В этом подразделении пока нет результатов.</p> : <Table data-testid="table-leaderboard">
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-16">место</TableHead><TableHead>проводник</TableHead><TableHead className="text-right">баллы</TableHead><TableHead className="hidden text-right sm:table-cell">обучение</TableHead><TableHead className="hidden text-right md:table-cell">рейсы</TableHead><TableHead className="hidden text-right md:table-cell">лучший</TableHead></TableRow></TableHeader>
              <TableBody>{board.map((entry, index) => <TableRow key={entry.name} className={cn("rzd-leaderboard-row", entry.name === player && "rzd-leaderboard-row--current")} data-testid={`row-leader-${index}`}>
                <TableCell>{index < 3 ? <span className={cn("rzd-rank", index === 0 && "rzd-rank--first")}><Medal className="size-4" /></span> : <span className="rzd-rank">{String(index + 1).padStart(2, "0")}</span>}</TableCell>
                <TableCell className="min-w-48 font-medium"><span className="inline-flex items-center gap-2">{entry.name}{entry.name === player && <span className="rzd-you-mark">вы</span>}</span><div className="mt-0.5 text-xs font-normal text-muted-foreground">Ур. {entry.level} · {entry.levelTitle}{scope !== "team" && entry.team && ` · ${entry.team}`}{scope === "company" && entry.depot && `, ${entry.depot}`}</div></TableCell>
                <TableCell className="text-right font-mono text-base font-black tabular text-[hsl(var(--danger))]">{entry.activePoints}</TableCell><TableCell className="hidden text-right font-mono tabular sm:table-cell">{entry.trainingPoints}</TableCell><TableCell className="hidden text-right font-mono tabular md:table-cell">{entry.attempts}</TableCell><TableCell className="hidden text-right font-mono tabular md:table-cell">{entry.bestScore}</TableCell>
              </TableRow>)}</TableBody>
            </Table>}
          </div>
        </section>

        <aside className="space-y-4">
          <Card className="rzd-profile-card" data-testid="card-profile"><CardContent className="p-5">
            <span className="rzd-kicker text-white/70">ваша смена</span>
            <div className="mt-3 flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-black">{player}</h2><p className="text-sm text-white/65">Личный прогресс</p></div><span className="grid size-10 shrink-0 place-items-center rounded-md bg-[hsl(var(--danger))] text-white"><UserRound className="size-5" /></span></div>
            <div className="mt-5 [&_.text-muted-foreground]:text-white/60 [&_.bg-muted]:bg-white/15">{profile && <LevelBar level={profile.level} />}</div>
            {profile?.expiring && <div className="mt-4 [&_*]:border-white/20 [&_*]:bg-white/10 [&_*]:text-white"><ExpiringNote expiring={profile.expiring} /></div>}
            <div className="mt-5 grid grid-cols-2 gap-2 [&_svg]:text-[hsl(var(--danger))] [&_[class*=border]]:border-white/15 [&_[class*=rounded]]:bg-white/5 [&_[class*=rounded]]:text-white [&_[class*=rounded]]:shadow-none"><Stat icon={<ClipboardCheck className="size-4" />} label="Практика" value={profile?.activePoints ?? 0} /><Stat icon={<GraduationCap className="size-4" />} label="Обучение" value={profile?.trainingPoints ?? 0} /></div>
            <Button size="sm" className="mt-5 w-full bg-white text-foreground hover:bg-white/90" asChild><Link href="/profile" data-testid="link-profile">Открыть профиль <ArrowUpRight className="size-4" /></Link></Button>
          </CardContent></Card>
          <div className="rzd-panel rzd-panel--red"><span className="text-xs font-black uppercase tracking-[.08em] text-white/75">правило табло</span><p className="text-sm font-medium leading-relaxed">Баллы обучения показывают практику. В рейтинг попадают результаты проверочных рейсов.</p></div>
        </aside>
      </div>
    </Shell>
  );
}
