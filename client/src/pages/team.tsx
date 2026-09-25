import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_COLOR } from "@/components/app/widgets";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/player";
import { useProfile, useStructure, useTeamAnalytics } from "@/lib/api";
import { SKILL_KEYS, SKILL_LABEL, type Skill } from "@shared/analytics";
import { CRITICAL_SKILLS, SKILL_THRESHOLDS, SKILL_WINDOW } from "@shared/rules";
import { EVENT_CATEGORY_LABEL } from "@shared/scenario";

/** Страница руководителя: навыки бригады, готовность к работе и частые ошибки */
export default function TeamPage() {
  const { player } = useApp();
  const { data: profile } = useProfile(player);
  const { data: structure } = useStructure();
  const [picked, setPicked] = useState<number | undefined>();
  const teamId = picked ?? profile?.teamId ?? structure?.teams[0]?.id;
  const { data, isLoading } = useTeamAnalytics(teamId);
  const ready = data?.members.filter((m) => m.ready).length ?? 0;

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Бригада</h1>
          <p className="text-sm text-muted-foreground">
            Навыки — среднее по последним {SKILL_WINDOW} рейсам. Готов к работе — все критичные навыки ({CRITICAL_SKILLS.map((k) => SKILL_LABEL[k].toLowerCase()).join(", ")}) выше порога.
          </p>
        </div>
        {!!structure?.teams.length && (
          <Select value={teamId ? String(teamId) : undefined} onValueChange={(v) => setPicked(Number(v))}>
            <SelectTrigger className="ml-auto h-9 w-72" data-testid="select-team"><SelectValue placeholder="Бригада" /></SelectTrigger>
            <SelectContent>
              {structure.teams.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name} · {structure.depots.find((d) => d.id === t.depotId)?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="space-y-6">
          <Card data-testid="card-team-matrix">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {data.team.name}
                {data.depot && <span className="text-muted-foreground font-normal"> · {data.depot.name}</span>}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Готовы к самостоятельной работе: {ready} из {data.members.length}</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Проводник</TableHead>
                    {SKILL_KEYS.map((k) => (
                      <TableHead key={k} className="text-center text-xs">
                        {SKILL_LABEL[k]}
                        <div className="font-normal text-muted-foreground">порог {SKILL_THRESHOLDS[k]}</div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Рейсов</TableHead>
                    <TableHead className="text-center">Готовность</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((m) => (
                    <TableRow key={m.name} data-testid={`row-member-${m.name}`}>
                      <TableCell className={cn("font-medium", m.name === player && "text-[hsl(var(--safety))]")}>{m.name}</TableCell>
                      {m.skills.map((s) => (
                        <SkillCell key={s.key} skill={s} />
                      ))}
                      <TableCell className="text-center font-mono tabular">{m.attempts}</TableCell>
                      <TableCell className="text-center">
                        {m.ready ? (
                          <CheckCircle2 className="size-4 inline text-[hsl(var(--safety))]" aria-label="готов" />
                        ) : (
                          <XCircle className="size-4 inline text-muted-foreground" aria-label="не готов" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card data-testid="card-team-mistakes">
            <CardHeader className="pb-2">
              <CardTitle className="text-base inline-flex items-center gap-2">
                <AlertTriangle className="size-4 text-[hsl(var(--danger))]" /> Частые ошибки бригады
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data.mistakes.length && <p className="text-sm text-muted-foreground">Ошибок пока нет.</p>}
              {data.mistakes.map((m, i) => (
                <div key={i} className="rounded-md border p-3 text-sm space-y-1.5" data-testid={`mistake-${i}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                    <Badge className={cn("border-0", CATEGORY_COLOR[m.category])}>{EVENT_CATEGORY_LABEL[m.category]}</Badge>
                    <span className="font-medium">{m.eventTitle}</span>
                    <span className="ml-auto font-mono text-xs tabular">{m.count} раз</span>
                  </div>
                  <p className="flex items-start gap-1.5">
                    <XCircle className="size-4 shrink-0 mt-0.5 text-[hsl(var(--danger))]" /> {m.text}
                  </p>
                  {m.better && (
                    <p className="flex items-start gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-[hsl(var(--safety))]" /> {m.better}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </Shell>
  );
}

function SkillCell({ skill: s }: { skill: Skill }) {
  return (
    <TableCell className="text-center p-1.5">
      <span
        className={cn(
          "inline-block min-w-10 rounded px-1.5 py-1 font-mono tabular text-xs",
          s.status === "mastered" && "bg-[hsl(var(--safety))]/15 text-[hsl(var(--safety))]",
          s.status === "weak" && "bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]",
          s.status === "none" && "text-muted-foreground",
        )}
      >
        {s.value ?? "—"}
      </span>
    </TableCell>
  );
}
