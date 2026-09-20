import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Play, Save, Check, MousePointer2 } from "lucide-react";
import { Shell } from "@/components/app/Shell";
import { CarMap, Legend, type MapActor, type SeatMark } from "@/components/app/CarMap";
import { TrainStrip } from "@/components/app/widgets";
import { ActorsPanel, EventsPanel, TrainPanel, type Tool } from "@/components/app/editor-panels";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useScenario, useSaveScenario } from "@/lib/api";
import { type ScenarioData, type Cell, WALKABLE, uid, ACTOR_ROLE_LABEL } from "@shared/scenario";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const sid = Number(id);
  const { data: row, isLoading } = useScenario(sid);
  const save = useSaveScenario();
  const { toast } = useToast();

  const [data, setData] = useState<ScenarioData | null>(null);
  const [meta, setMeta] = useState({ name: "", description: "", difficulty: 1 });
  const [dirty, setDirty] = useState(false);
  const [carId, setCarId] = useState<string>("");
  const [actorId, setActorId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [tab, setTab] = useState("actors");
  const [tool, setTool] = useState<Tool>({ kind: "select" });

  // Загружаем сценарий в локальное состояние один раз
  useEffect(() => {
    if (row && !data) {
      setData(row.data);
      setMeta({ name: row.name, description: row.description, difficulty: row.difficulty });
      setCarId(row.data.train.cars[0]?.id ?? "");
    }
  }, [row, data]);

  const mutate = (fn: (d: ScenarioData) => void) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };
  const updMeta = (m: typeof meta) => {
    setMeta(m);
    setDirty(true);
  };

  const car = data?.train.cars.find((c) => c.id === carId) ?? data?.train.cars[0];
  useEffect(() => {
    if (data && !data.train.cars.some((c) => c.id === carId)) setCarId(data.train.cars[0]?.id ?? "");
  }, [data, carId]);

  const selectedActor = data?.actors.find((a) => a.id === actorId);
  const selectActor = (id: string | null) => {
    setActorId(id);
    const a = data?.actors.find((x) => x.id === id);
    if (a) setCarId(a.spawn.carId);
  };

  // Акторы на карте — в точках появления
  const mapActors: MapActor[] = useMemo(
    () =>
      (data?.actors ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        carId: a.spawn.carId,
        x: a.spawn.x,
        y: a.spawn.y,
        mood: a.mood,
        selected: a.id === actorId,
      })),
    [data, actorId],
  );

  // Подсветка кресел: билет выбранного актора и цели его шагов; занятые билеты остальных
  const seatMarks: Record<string, SeatMark> = useMemo(() => {
    const m: Record<string, SeatMark> = {};
    if (!data || !car) return m;
    for (const a of data.actors) if (a.ticket && a.ticket.carId === car.id) m[a.ticket.seat] = "occupied";
    if (selectedActor) {
      for (const s of selectedActor.steps)
        if (s.type === "goto" && s.target.kind === "seat" && s.target.carId === car.id) m[s.target.seat] = "target";
      if (selectedActor.ticket && selectedActor.ticket.carId === car.id) m[selectedActor.ticket.seat] = "ticket";
    }
    return m;
  }, [data, car, selectedActor]);

  const cellMarks = useMemo(() => {
    const m: Record<string, "target"> = {};
    if (!selectedActor || !car) return m;
    for (const s of selectedActor.steps)
      if (s.type === "goto" && s.target.kind === "cell" && s.target.carId === car.id) m[`${s.target.x},${s.target.y}`] = "target";
    return m;
  }, [selectedActor, car]);

  const onCellClick = (cell: Cell) => {
    if (!car) return;
    const walkable = WALKABLE.has(cell.kind);
    switch (tool.kind) {
      case "addActor": {
        if (!walkable) return toast({ title: "Сюда нельзя поставить актора", description: "Выберите проход, кресло или тамбур." });
        const id = uid("a_");
        mutate((d) =>
          d.actors.push({
            id,
            name: `Пассажир ${d.actors.length}`,
            role: "passenger",
            ticket: cell.seat ? { carId: car.id, seat: cell.seat } : null,
            spawn: { carId: car.id, x: cell.x, y: cell.y },
            mood: 80,
            steps: cell.seat ? [{ type: "sit" }] : [],
          }),
        );
        setActorId(id);
        setTool({ kind: "select" });
        setTab("actors");
        break;
      }
      case "moveSpawn":
        if (!walkable) return;
        mutate((d) => (d.actors.find((a) => a.id === tool.actorId)!.spawn = { carId: car.id, x: cell.x, y: cell.y }));
        setTool({ kind: "select" });
        break;
      case "pickSeat":
        if (!cell.seat) return toast({ title: "Это не кресло", description: "Кликните по креслу с номером." });
        mutate((d) => (d.actors.find((a) => a.id === tool.actorId)!.ticket = { carId: car.id, seat: cell.seat! }));
        setTool({ kind: "select" });
        break;
      case "pickTarget":
        if (!walkable) return;
        mutate((d) => {
          const step = d.actors.find((a) => a.id === tool.actorId)!.steps[tool.stepIndex];
          if (step.type === "goto")
            step.target = cell.seat ? { kind: "seat", carId: car.id, seat: cell.seat } : { kind: "cell", carId: car.id, x: cell.x, y: cell.y };
        });
        setTool({ kind: "select" });
        break;
      default:
        setActorId(null);
    }
  };

  const onActorClick = (id: string) => {
    if (tool.kind !== "select") return;
    selectActor(id);
    setTab("actors");
  };

  const doSave = async () => {
    if (!data) return;
    try {
      await save.mutateAsync({ id: sid, body: { ...meta, data } });
      setDirty(false);
      toast({ title: "Сценарий сохранён" });
    } catch (e) {
      toast({ title: "Ошибка сохранения", description: String((e as Error).message), variant: "destructive" });
    }
  };

  const toolHint: Record<Tool["kind"], string> = {
    select: "Клик по актору — выбрать. Клик по пустой клетке — снять выделение.",
    addActor: "Кликните по клетке, где появится новый актор.",
    moveSpawn: "Кликните по клетке — новая точка появления.",
    pickSeat: "Кликните по креслу — оно станет местом по билету.",
    pickTarget: "Кликните по клетке или креслу — цель шага «Идти к…».",
  };

  if (isLoading || !data || !car) {
    return (
      <Shell wide>
        <Skeleton className="h-10 w-72 mb-4" />
        <Skeleton className="h-72 w-full" />
      </Shell>
    );
  }

  const badges: Record<string, number> = {};
  for (const a of data.actors) badges[a.spawn.carId] = (badges[a.spawn.carId] ?? 0) + 1;

  return (
    <Shell wide>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/" data-testid="link-back">
            <ArrowLeft className="size-4 mr-1" /> Сценарии
          </Link>
        </Button>
        <h1 className="text-lg font-bold tracking-tight truncate" data-testid="text-scenario-name">
          {meta.name || "Без названия"}
        </h1>
        <span className="text-xs text-muted-foreground hidden md:inline">{data.train.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant={dirty ? "default" : "outline"} onClick={doSave} disabled={save.isPending} data-testid="button-save">
            {dirty ? <Save className="size-4 mr-1" /> : <Check className="size-4 mr-1" />}
            {dirty ? "Сохранить" : "Сохранено"}
          </Button>
          <Button size="sm" variant="secondary" asChild data-testid="button-run">
            <Link href={`/play/${sid}/training`}>
              <Play className="size-4 mr-1" /> Запустить
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <section className="space-y-3 min-w-0">
          <TrainStrip cars={data.train.cars} selectedId={car.id} onSelect={setCarId} badges={badges} />
          <div className="rounded-lg border bg-card/50 p-3 sm:p-4 overflow-x-auto">
            <CarMap
              car={car}
              actors={mapActors}
              seatMarks={seatMarks}
              cellMarks={cellMarks}
              onCellClick={onCellClick}
              onActorClick={onActorClick}
              cursor={tool.kind === "select" ? "default" : "crosshair"}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5" data-testid="text-tool-hint">
              <MousePointer2 className="size-3.5" /> {toolHint[tool.kind]}
              {tool.kind !== "select" && (
                <button className="underline ml-1" onClick={() => setTool({ kind: "select" })}>
                  отмена
                </button>
              )}
            </span>
            <Legend />
          </div>
          {selectedActor && (
            <p className="text-xs text-muted-foreground">
              Выбран: <b className="text-foreground">{selectedActor.name}</b> · {ACTOR_ROLE_LABEL[selectedActor.role]}
              {selectedActor.ticket && ` · билет ${selectedActor.ticket.seat}`}
            </p>
          )}
        </section>

        <aside className="rounded-lg border bg-card p-4 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="actors" data-testid="tab-actors">Акторы</TabsTrigger>
              <TabsTrigger value="events" data-testid="tab-events">События</TabsTrigger>
              <TabsTrigger value="train" data-testid="tab-train">Состав</TabsTrigger>
            </TabsList>
            <TabsContent value="actors" className="pt-4">
              <ActorsPanel data={data} mutate={mutate} selectedId={actorId} onSelect={selectActor} tool={tool} setTool={setTool} currentCarId={car.id} />
            </TabsContent>
            <TabsContent value="events" className="pt-4">
              <EventsPanel data={data} mutate={mutate} selectedId={eventId} onSelect={setEventId} />
            </TabsContent>
            <TabsContent value="train" className="pt-4">
              <TrainPanel data={data} mutate={mutate} meta={meta} setMeta={updMeta} onSelectCar={setCarId} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </Shell>
  );
}
