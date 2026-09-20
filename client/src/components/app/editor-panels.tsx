/**
 * Правая панель редактора: инспектор актора, редактор событий, настройки состава.
 * Все изменения идут через mutate(fn) — fn получает копию сценария и мутирует её.
 */
import {
  type ScenarioData,
  type Actor,
  type BehaviorStep,
  type GameEvent,
  type DialogueNode,
  type Target,
  ACTOR_ROLES,
  ACTOR_ROLE_LABEL,
  STEP_LABEL,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABEL,
  CAR_TYPES,
  CAR_TYPE_LABEL,
  buildCar,
  uid,
} from "@shared/scenario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Crosshair, MapPin, Plus, Trash2, Ticket, X } from "lucide-react";
import { ROLE_COLOR } from "./CarMap";
import { CATEGORY_COLOR } from "./widgets";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type Mutate = (fn: (d: ScenarioData) => void) => void;

export type Tool =
  | { kind: "select" }
  | { kind: "addActor" }
  | { kind: "moveSpawn"; actorId: string }
  | { kind: "pickSeat"; actorId: string }
  | { kind: "pickTarget"; actorId: string; stepIndex: number };

const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const NumberInput = ({
  value,
  onChange,
  ...rest
}: { value: number; onChange: (n: number) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) => (
  <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="h-8 font-mono" {...rest} />
);

// ───────────────────────────── Акторы ─────────────────────────────

export function ActorsPanel({
  data,
  mutate,
  selectedId,
  onSelect,
  tool,
  setTool,
  currentCarId,
}: {
  data: ScenarioData;
  mutate: Mutate;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  currentCarId: string;
}) {
  const actor = data.actors.find((a) => a.id === selectedId) ?? null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Акторы · {data.actors.length}</span>
        <Button
          size="sm"
          variant={tool.kind === "addActor" ? "default" : "outline"}
          onClick={() => setTool(tool.kind === "addActor" ? { kind: "select" } : { kind: "addActor" })}
          data-testid="button-add-actor"
        >
          <Plus className="size-4 mr-1" /> Поставить на карту
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {data.actors.map((a) => {
          const car = data.train.cars.find((c) => c.id === a.spawn.carId);
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              data-testid={`button-actor-${a.id}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                a.id === selectedId ? "border-primary bg-primary/10" : "hover:bg-accent",
                a.spawn.carId !== currentCarId && "opacity-60",
              )}
            >
              <span className="size-2.5 rounded-full" style={{ background: a.role === "conductor" ? "hsl(var(--primary))" : ROLE_COLOR[a.role] }} />
              {a.name}
              <span className="text-muted-foreground font-mono">в{car?.number}</span>
            </button>
          );
        })}
      </div>
      <Separator />
      {actor ? (
        <ActorInspector data={data} mutate={mutate} actor={actor} tool={tool} setTool={setTool} onDelete={() => onSelect(null)} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Выберите актора на карте или в списке. Кнопка «Поставить на карту» — затем клик по свободной клетке.
        </p>
      )}
    </div>
  );
}

function ActorInspector({
  data,
  mutate,
  actor,
  tool,
  setTool,
  onDelete,
}: {
  data: ScenarioData;
  mutate: Mutate;
  actor: Actor;
  tool: Tool;
  setTool: (t: Tool) => void;
  onDelete: () => void;
}) {
  const upd = (fn: (a: Actor) => void) => mutate((d) => fn(d.actors.find((x) => x.id === actor.id)!));
  const car = (id: string) => data.train.cars.find((c) => c.id === id);
  const spawnCar = car(actor.spawn.carId);
  const [newStep, setNewStep] = useState<BehaviorStep["type"]>("goto");

  const addStep = () => {
    const firstCar = data.train.cars[0];
    const step: BehaviorStep =
      newStep === "goto"
        ? { type: "goto", target: { kind: "ownSeat" } }
        : newStep === "wait"
          ? { type: "wait", seconds: 5 }
          : newStep === "emit"
            ? { type: "emit", eventId: data.events[0]?.id ?? "" }
            : newStep === "say"
              ? { type: "say", text: "…" }
              : newStep === "mood"
                ? { type: "mood", delta: -10 }
                : { type: "sit" };
    void firstCar;
    upd((a) => a.steps.push(step));
  };

  return (
    <div className="space-y-4" data-testid="panel-actor">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Имя" className="col-span-2">
          <Input value={actor.name} onChange={(e) => upd((a) => (a.name = e.target.value))} className="h-8" data-testid="input-actor-name" />
        </Field>
        <Field label="Роль">
          <Select value={actor.role} onValueChange={(v) => upd((a) => (a.role = v as Actor["role"]))}>
            <SelectTrigger className="h-8" data-testid="select-actor-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTOR_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ACTOR_ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={`Настроение · ${actor.mood}`}>
          <Slider value={[actor.mood]} min={0} max={100} step={5} onValueChange={([v]) => upd((a) => (a.mood = v))} className="pt-2" />
        </Field>
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> Точка появления
          </span>
          <span className="font-mono">
            в{spawnCar?.number} · {actor.spawn.x},{actor.spawn.y}
          </span>
        </div>
        <Button
          size="sm"
          variant={tool.kind === "moveSpawn" ? "default" : "outline"}
          className="w-full"
          onClick={() => setTool(tool.kind === "moveSpawn" ? { kind: "select" } : { kind: "moveSpawn", actorId: actor.id })}
          data-testid="button-move-spawn"
        >
          <Crosshair className="size-4 mr-1" /> {tool.kind === "moveSpawn" ? "Кликните по клетке…" : "Переместить"}
        </Button>
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Ticket className="size-3.5" /> Билет
          </span>
          {actor.ticket ? (
            <span className="font-mono">
              в{car(actor.ticket.carId)?.number} · место {actor.ticket.seat}
            </span>
          ) : (
            <span className="text-muted-foreground">нет</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={tool.kind === "pickSeat" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setTool(tool.kind === "pickSeat" ? { kind: "select" } : { kind: "pickSeat", actorId: actor.id })}
            data-testid="button-pick-seat"
          >
            {tool.kind === "pickSeat" ? "Кликните по креслу…" : "Выбрать кресло на карте"}
          </Button>
          {actor.ticket && (
            <Button size="icon" variant="ghost" className="size-8" onClick={() => upd((a) => (a.ticket = null))} aria-label="Убрать билет">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Модель поведения</div>
        {actor.steps.length === 0 && <p className="text-xs text-muted-foreground">Шагов нет — актор стоит на месте.</p>}
        <ol className="space-y-2">
          {actor.steps.map((s, i) => (
            <li key={i} className="rounded-md border bg-card p-2.5 space-y-2" data-testid={`step-${actor.id}-${i}`}>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-muted-foreground w-5">{i + 1}.</span>
                <span className="text-sm font-medium">{STEP_LABEL[s.type]}</span>
                <div className="ml-auto flex">
                  <Button size="icon" variant="ghost" className="size-7" disabled={i === 0} aria-label="Выше"
                    onClick={() => upd((a) => { [a.steps[i - 1], a.steps[i]] = [a.steps[i], a.steps[i - 1]]; })}>
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" disabled={i === actor.steps.length - 1} aria-label="Ниже"
                    onClick={() => upd((a) => { [a.steps[i + 1], a.steps[i]] = [a.steps[i], a.steps[i + 1]]; })}>
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7 text-muted-foreground" aria-label="Удалить шаг"
                    onClick={() => upd((a) => a.steps.splice(i, 1))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <StepEditor
                data={data}
                step={s}
                onChange={(ns) => upd((a) => (a.steps[i] = ns))}
                picking={tool.kind === "pickTarget" && tool.stepIndex === i}
                onPick={() => setTool({ kind: "pickTarget", actorId: actor.id, stepIndex: i })}
              />
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <Select value={newStep} onValueChange={(v) => setNewStep(v as BehaviorStep["type"])}>
            <SelectTrigger className="h-8" data-testid="select-new-step">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STEP_LABEL) as BehaviorStep["type"][]).map((t) => (
                <SelectItem key={t} value={t}>
                  {STEP_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={addStep} data-testid="button-add-step">
            <Plus className="size-4 mr-1" /> Шаг
          </Button>
        </div>
      </div>

      {actor.role !== "conductor" && (
        <Button variant="ghost" size="sm" className="text-destructive w-full" onClick={() => { mutate((d) => { d.actors = d.actors.filter((a) => a.id !== actor.id); }); onDelete(); }} data-testid="button-delete-actor">
          <Trash2 className="size-4 mr-1" /> Удалить актора
        </Button>
      )}
    </div>
  );
}

function StepEditor({
  data,
  step,
  onChange,
  picking,
  onPick,
}: {
  data: ScenarioData;
  step: BehaviorStep;
  onChange: (s: BehaviorStep) => void;
  picking: boolean;
  onPick: () => void;
}) {
  const carNum = (id: string) => data.train.cars.find((c) => c.id === id)?.number ?? "?";
  switch (step.type) {
    case "goto": {
      const t = step.target;
      const setKind = (kind: Target["kind"]) => {
        const carId = data.train.cars[0].id;
        const nt: Target =
          kind === "ownSeat" ? { kind } : kind === "seat" ? { kind, carId, seat: "1A" } : kind === "zone" ? { kind, carId, zone: "toilet" } : { kind, carId, x: 1, y: 2 };
        onChange({ ...step, target: nt });
      };
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select value={t.kind} onValueChange={(v) => setKind(v as Target["kind"])}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ownSeat">Своё место по билету</SelectItem>
              <SelectItem value="seat">Конкретное кресло</SelectItem>
              <SelectItem value="zone">Зона вагона</SelectItem>
              <SelectItem value="cell">Точка на карте</SelectItem>
            </SelectContent>
          </Select>
          {t.kind === "seat" && (
            <>
              <Input value={t.seat} onChange={(e) => onChange({ ...step, target: { ...t, seat: e.target.value.toUpperCase() } })} className="h-8 font-mono text-xs" placeholder="5C" />
              <CarSelect data={data} value={t.carId} onChange={(carId) => onChange({ ...step, target: { ...t, carId } })} />
              <Button size="sm" variant={picking ? "default" : "outline"} className="h-8 text-xs" onClick={onPick}>
                <Crosshair className="size-3.5 mr-1" /> {picking ? "Кликните…" : "На карте"}
              </Button>
            </>
          )}
          {t.kind === "zone" && (
            <>
              <Select value={t.zone} onValueChange={(v) => onChange({ ...step, target: { ...t, zone: v as typeof t.zone } })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toilet">Санузел</SelectItem>
                  <SelectItem value="bar">Бар (бистро)</SelectItem>
                  <SelectItem value="vestibule">Тамбур</SelectItem>
                </SelectContent>
              </Select>
              <CarSelect data={data} value={t.carId} onChange={(carId) => onChange({ ...step, target: { ...t, carId } })} className="col-span-2" />
            </>
          )}
          {t.kind === "cell" && (
            <Button size="sm" variant={picking ? "default" : "outline"} className="h-8 text-xs" onClick={onPick}>
              <Crosshair className="size-3.5 mr-1" />
              {picking ? "Кликните…" : `в${carNum(t.carId)} · ${t.x},${t.y}`}
            </Button>
          )}
        </div>
      );
    }
    case "wait":
      return (
        <div className="flex items-center gap-2 text-xs">
          <NumberInput value={step.seconds} min={0} onChange={(n) => onChange({ ...step, seconds: n })} className="h-8 w-24 font-mono" /> секунд
        </div>
      );
    case "emit":
      return (
        <Select value={step.eventId} onValueChange={(v) => onChange({ ...step, eventId: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Выберите событие" />
          </SelectTrigger>
          <SelectContent>
            {data.events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "say":
      return <Input value={step.text} onChange={(e) => onChange({ ...step, text: e.target.value })} className="h-8 text-xs" />;
    case "mood":
      return (
        <div className="flex items-center gap-2 text-xs">
          <NumberInput value={step.delta} onChange={(n) => onChange({ ...step, delta: n })} className="h-8 w-24 font-mono" /> к настроению (±)
        </div>
      );
    default:
      return null;
  }
}

function CarSelect({ data, value, onChange, className }: { data: ScenarioData; value: string; onChange: (id: string) => void; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {data.train.cars.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            Вагон {c.number}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ───────────────────────────── События ─────────────────────────────

export function EventsPanel({
  data,
  mutate,
  selectedId,
  onSelect,
}: {
  data: ScenarioData;
  mutate: Mutate;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const ev = data.events.find((e) => e.id === selectedId) ?? null;
  const add = () => {
    const id = uid("ev_");
    const nodeId = uid("n_");
    mutate((d) =>
      d.events.push({
        id,
        title: "Новое событие",
        category: "request",
        actorId: null,
        trigger: { type: "manual" },
        startNode: nodeId,
        nodes: [{ id: nodeId, speaker: "Пассажир", text: "Текст реплики…", timerSec: 15, options: [{ id: uid("o_"), text: "Вариант ответа", next: null, effects: { loyalty: 0, safety: 0 }, correct: true }] }],
      }),
    );
    onSelect(id);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">События · {data.events.length}</span>
        <Button size="sm" variant="outline" onClick={add} data-testid="button-add-event">
          <Plus className="size-4 mr-1" /> Событие
        </Button>
      </div>
      <div className="space-y-1">
        {data.events.map((e) => (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            data-testid={`button-event-${e.id}`}
            className={cn("w-full flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors", e.id === selectedId ? "border-primary bg-primary/10" : "hover:bg-accent")}
          >
            <Badge className={cn("shrink-0 border-0", CATEGORY_COLOR[e.category])}>{EVENT_CATEGORY_LABEL[e.category]}</Badge>
            <span className="truncate">{e.title}</span>
            <span className="ml-auto text-xs text-muted-foreground font-mono shrink-0">
              {e.trigger.type === "time" ? `${e.trigger.atSec}с` : e.trigger.type === "actor" ? "актор" : "вручную"}
            </span>
          </button>
        ))}
      </div>
      {ev && (
        <>
          <Separator />
          <EventEditor data={data} mutate={mutate} ev={ev} onDelete={() => onSelect(null)} />
        </>
      )}
    </div>
  );
}

function EventEditor({ data, mutate, ev, onDelete }: { data: ScenarioData; mutate: Mutate; ev: GameEvent; onDelete: () => void }) {
  const upd = (fn: (e: GameEvent) => void) => mutate((d) => fn(d.events.find((x) => x.id === ev.id)!));
  const addNode = () => upd((e) => e.nodes.push({ id: uid("n_"), speaker: "Пассажир", text: "", timerSec: 15, options: [] }));
  return (
    <div className="space-y-4" data-testid="panel-event">
      <Field label="Название">
        <Input value={ev.title} onChange={(e) => upd((x) => (x.title = e.target.value))} className="h-8" data-testid="input-event-title" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Категория">
          <Select value={ev.category} onValueChange={(v) => upd((x) => (x.category = v as GameEvent["category"]))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{EVENT_CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Связанный актор">
          <Select value={ev.actorId ?? "none"} onValueChange={(v) => upd((x) => (x.actorId = v === "none" ? null : v))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— нет —</SelectItem>
              {data.actors.filter((a) => a.role !== "conductor").map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Триггер">
          <Select
            value={ev.trigger.type}
            onValueChange={(v) => upd((x) => (x.trigger = v === "time" ? { type: "time", atSec: 30 } : v === "actor" ? { type: "actor" } : { type: "manual" }))}
          >
            <SelectTrigger className="h-8" data-testid="select-trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Вручную (кнопка)</SelectItem>
              <SelectItem value="time">По времени рейса</SelectItem>
              <SelectItem value="actor">Из шага актора</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {ev.trigger.type === "time" && (
          <Field label="Секунда рейса">
            <NumberInput value={ev.trigger.atSec} min={0} onChange={(n) => upd((x) => (x.trigger = { type: "time", atSec: n }))} />
          </Field>
        )}
        <Field label="Стартовый узел" className="col-span-2">
          <Select value={ev.startNode} onValueChange={(v) => upd((x) => (x.startNode = v))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ev.nodes.map((n, i) => (
                <SelectItem key={n.id} value={n.id}>Узел {i + 1}: {n.text.slice(0, 30) || "(пусто)"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Узлы диалога · {ev.nodes.length}</span>
        <Button size="sm" variant="outline" onClick={addNode} data-testid="button-add-node">
          <Plus className="size-4 mr-1" /> Узел
        </Button>
      </div>
      <div className="space-y-3">
        {ev.nodes.map((n, i) => (
          <NodeEditor key={n.id} ev={ev} node={n} index={i} upd={upd} />
        ))}
      </div>

      <Button variant="ghost" size="sm" className="text-destructive w-full" onClick={() => { mutate((d) => { d.events = d.events.filter((e) => e.id !== ev.id); }); onDelete(); }} data-testid="button-delete-event">
        <Trash2 className="size-4 mr-1" /> Удалить событие
      </Button>
    </div>
  );
}

function NodeEditor({ ev, node, index, upd }: { ev: GameEvent; node: DialogueNode; index: number; upd: (fn: (e: GameEvent) => void) => void }) {
  const un = (fn: (n: DialogueNode) => void) => upd((e) => fn(e.nodes.find((x) => x.id === node.id)!));
  return (
    <div className="rounded-md border bg-card p-3 space-y-2" data-testid={`node-${node.id}`}>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono">{index + 1}</Badge>
        {ev.startNode === node.id && <Badge variant="secondary">старт</Badge>}
        <Button
          size="icon"
          variant="ghost"
          className="size-7 ml-auto text-muted-foreground"
          aria-label="Удалить узел"
          disabled={ev.nodes.length === 1}
          onClick={() =>
            upd((e) => {
              e.nodes = e.nodes.filter((x) => x.id !== node.id);
              e.nodes.forEach((x) => x.options.forEach((o) => { if (o.next === node.id) o.next = null; }));
              if (e.startNode === node.id) e.startNode = e.nodes[0].id;
            })
          }
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <Input value={node.speaker} onChange={(e) => un((n) => (n.speaker = e.target.value))} className="h-8 text-xs" placeholder="Кто говорит" />
        <div className="flex items-center gap-1 text-xs">
          <NumberInput value={node.timerSec ?? 0} min={0} onChange={(v) => un((n) => (n.timerSec = v || undefined))} className="h-8 font-mono" aria-label="Таймер, сек" />с
        </div>
      </div>
      <Textarea value={node.text} onChange={(e) => un((n) => (n.text = e.target.value))} className="text-sm min-h-16" placeholder="Реплика / описание ситуации" />
      <div className="space-y-2">
        {node.options.map((o, oi) => (
          <div key={o.id} className="rounded border border-dashed p-2 space-y-2" data-testid={`option-${o.id}`}>
            <div className="flex gap-2">
              <Input value={o.text} onChange={(e) => un((n) => (n.options[oi].text = e.target.value))} className="h-8 text-xs" placeholder="Вариант действия проводника" />
              <Button size="icon" variant="ghost" className="size-8 shrink-0 text-muted-foreground" aria-label="Удалить вариант" onClick={() => un((n) => n.options.splice(oi, 1))}>
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-1.5 gap-y-2 text-xs">
              <span className="text-[hsl(var(--loyalty))]">Лояльн.</span>
              <NumberInput value={o.effects.loyalty} onChange={(v) => un((n) => (n.options[oi].effects.loyalty = v))} className="h-7 font-mono" />
              <span className="text-[hsl(var(--safety))]">Безоп.</span>
              <NumberInput value={o.effects.safety} onChange={(v) => un((n) => (n.options[oi].effects.safety = v))} className="h-7 font-mono" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Select value={o.next ?? "end"} onValueChange={(v) => un((n) => (n.options[oi].next = v === "end" ? null : v))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="end">→ конец события</SelectItem>
                  {ev.nodes.filter((x) => x.id !== node.id).map((x, xi) => (
                    <SelectItem key={x.id} value={x.id}>→ узел {ev.nodes.indexOf(x) + 1 || xi}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="inline-flex items-center gap-1.5 shrink-0">
                <Switch checked={!!o.correct} onCheckedChange={(v) => un((n) => (n.options[oi].correct = v))} className="scale-90" /> верный
              </label>
            </div>
            {o.correct && (
              <Input value={o.hint ?? ""} onChange={(e) => un((n) => (n.options[oi].hint = e.target.value))} className="h-7 text-xs" placeholder="Подсказка для режима тренировки" />
            )}
          </div>
        ))}
        <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => un((n) => n.options.push({ id: uid("o_"), text: "", next: null, effects: { loyalty: 0, safety: 0 } }))}>
          <Plus className="size-3.5 mr-1" /> Вариант ответа
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────── Состав и настройки ─────────────────────────────

export function TrainPanel({
  data,
  mutate,
  meta,
  setMeta,
  onSelectCar,
}: {
  data: ScenarioData;
  mutate: Mutate;
  meta: { name: string; description: string; difficulty: number };
  setMeta: (m: { name: string; description: string; difficulty: number }) => void;
  onSelectCar: (id: string) => void;
}) {
  const [type, setType] = useState<(typeof CAR_TYPES)[number]>("second");
  const addCar = () => {
    mutate((d) => {
      const car = buildCar(d.train.cars.length + 1, type, type === "bistro" ? 8 : 12);
      d.train.cars.push(car);
    });
  };
  const removeCar = (id: string) =>
    mutate((d) => {
      if (d.train.cars.length === 1) return;
      d.train.cars = d.train.cars.filter((c) => c.id !== id);
      d.train.cars.forEach((c, i) => (c.number = i + 1));
      const first = d.train.cars[0];
      d.actors.forEach((a) => {
        if (a.spawn.carId === id) a.spawn = { carId: first.id, x: 1, y: first.type === "first" ? 1 : 2 };
        if (a.ticket?.carId === id) a.ticket = null;
      });
    });
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Field label="Название сценария">
          <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} className="h-8" data-testid="input-scenario-name" />
        </Field>
        <Field label="Описание">
          <Textarea value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} className="text-sm min-h-16" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Сложность">
            <Select value={String(meta.difficulty)} onValueChange={(v) => setMeta({ ...meta, difficulty: Number(v) })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Базовый</SelectItem>
                <SelectItem value="2">Средний</SelectItem>
                <SelectItem value="3">Сложный</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Длительность, с">
            <NumberInput value={data.durationSec} min={10} onChange={(n) => mutate((d) => (d.durationSec = Math.max(10, n)))} />
          </Field>
          <Field label="Состав">
            <Input value={data.train.name} onChange={(e) => mutate((d) => (d.train.name = e.target.value))} className="h-8" />
          </Field>
          <Field label="Лояльность (старт)">
            <NumberInput value={data.initial.loyalty} min={0} max={100} onChange={(n) => mutate((d) => (d.initial.loyalty = n))} />
          </Field>
          <Field label="Безопасн. (старт)">
            <NumberInput value={data.initial.safety} min={0} max={100} onChange={(n) => mutate((d) => (d.initial.safety = n))} />
          </Field>
        </div>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Вагоны · {data.train.cars.length}</span>
      </div>
      <div className="space-y-1.5">
        {data.train.cars.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm">
            <button className="flex-1 text-left" onClick={() => onSelectCar(c.id)} data-testid={`button-focus-car-${c.number}`}>
              <span className="font-mono font-semibold mr-2">{c.number}</span>
              {CAR_TYPE_LABEL[c.type]}
              <span className="text-muted-foreground text-xs ml-2">{c.cells.filter((x) => x.kind === "seat").length} мест</span>
            </button>
            <Button size="icon" variant="ghost" className="size-7 text-muted-foreground" disabled={data.train.cars.length === 1} aria-label="Удалить вагон" onClick={() => removeCar(c.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger className="h-8" data-testid="select-car-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CAR_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{CAR_TYPE_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={addCar} data-testid="button-add-car">
          <Plus className="size-4 mr-1" /> Вагон
        </Button>
      </div>
    </div>
  );
}
