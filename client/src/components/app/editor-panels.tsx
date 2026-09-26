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
  type DialogueOption,
  type Target,
  type Condition,
  type FlagValue,
  ROLE_STEPS,
  ROLE_STEP_LABEL,
  ACTOR_ROLES,
  ACTOR_ROLE_LABEL,
  STEP_LABEL,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABEL,
  CAR_TYPES,
  CAR_TYPE_LABEL,
  DEFAULT_ROWS,
  ACCESSIBILITY_NEEDS,
  SERVICE_ENTITLEMENTS,
  aisleRow,
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

const ACCESSIBILITY_NEED_LABEL = { hearing: "Слух", vision: "Зрение", wheelchair: "Коляска", mobility: "Мобильность" } as const;
const CAPABILITY_LABEL = {
  accessibleToilet: "Доступный санузел", wheelchairStorage: "Место для коляски", writtenCommunication: "Письменный канал",
  visualInformation: "Визуальная информация", quietArea: "Тихая зона", babyCareSpace: "Место для ухода",
} as const;
const ENTITLEMENT_LABEL = {
  mealDelivery: "Доставка питания", mobilityAssistance: "Помощь с перемещением", writtenCommunication: "Письменный канал",
  verbalOrientation: "Устная ориентация", quietArea: "Тихая зона", babyCareAlternative: "Альтернатива для ухода",
} as const;

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

      {actor.role !== "conductor" && (
        <Field label="Потребности в доступности">
          <div className="flex flex-wrap gap-1.5">
            {ACCESSIBILITY_NEEDS.map((need) => {
              const selected = actor.accessibilityNeeds?.includes(need) ?? false;
              return <Button key={need} size="sm" type="button" variant={selected ? "default" : "outline"} className="h-7 text-xs"
                onClick={() => upd((a) => {
                  const current = a.accessibilityNeeds ?? [];
                  a.accessibilityNeeds = selected ? current.filter((x) => x !== need) : [...current, need];
                  if (!a.accessibilityNeeds.length) delete a.accessibilityNeeds;
                })}>{ACCESSIBILITY_NEED_LABEL[need]}</Button>;
            })}
          </div>
        </Field>
      )}

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
              {e.trigger.type === "time" ? `${e.trigger.atSec}с` : e.trigger.type === "actor" ? "актор" : e.trigger.type === "condition" ? "условие" : "вручную"}
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
        <Field label="Срочность (для оценки)">
          <Select value={ev.urgency ?? "routine"} onValueChange={(v) => upd((x) => { x.urgency = v as GameEvent["urgency"]; })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="routine">Обычная</SelectItem><SelectItem value="urgent">Срочная</SelectItem><SelectItem value="critical">Критическая</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Окно ответа, сек">
          <NumberInput value={ev.responseWindowSec ?? 0} min={0} onChange={(v) => upd((x) => { x.responseWindowSec = v > 0 ? v : undefined; })} />
        </Field>
      </div>
      <Field label="Исходная тяжесть, 0–5 (для оценки)">
        <NumberInput value={ev.severity ?? 1} min={0} max={5} onChange={(v) => upd((x) => { x.severity = Math.max(0, Math.min(5, v)); })} />
      </Field>
      <details className="text-xs">
        <summary className="cursor-pointer">Изменения риска по времени и контексту</summary>
        <p className="mt-2 text-muted-foreground">Срабатывает первое подходящее правило; специфичные условия ставьте выше. Время — от появления ситуации.</p>
        <div className="mt-2 space-y-3">
          {(ev.priorityRules ?? []).map((rule, i) => <div key={i} className="rounded border p-2 space-y-2">
            <Field label="Через сколько секунд"><NumberInput value={rule.afterSec ?? 0} min={0} onChange={(v) => upd((x) => { x.priorityRules![i].afterSec = Math.max(0, v); })} /></Field>
            <ConditionEditor value={rule.if} onChange={(c) => upd((x) => { x.priorityRules![i].if = c; })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Тяжесть, 0–5"><NumberInput value={rule.severity} min={0} max={5} onChange={(v) => upd((x) => { x.priorityRules![i].severity = Math.max(0, Math.min(5, v)); })} /></Field>
              <Field label="Окно ответа, сек"><NumberInput value={rule.responseWindowSec} min={1} onChange={(v) => upd((x) => { x.priorityRules![i].responseWindowSec = Math.max(1, v); })} /></Field>
            </div>
            <Select value={rule.urgency} onValueChange={(v) => upd((x) => { x.priorityRules![i].urgency = v as typeof rule.urgency; })}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="routine">Обычная</SelectItem><SelectItem value="urgent">Срочная</SelectItem><SelectItem value="critical">Критическая</SelectItem></SelectContent>
            </Select>
            <Textarea value={rule.text} placeholder="Наблюдаемые признаки" onChange={(e) => upd((x) => { x.priorityRules![i].text = e.target.value; })} />
            <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => upd((x) => { const rules = x.priorityRules!; [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]]; })}>Выше</Button>
            <Button size="sm" variant="ghost" onClick={() => upd((x) => { x.priorityRules!.splice(i, 1); })}>Удалить стадию</Button>
          </div>)}
          <Button size="sm" variant="outline" onClick={() => upd((x) => { (x.priorityRules ??= []).push({ afterSec: 10, severity: 3, urgency: "urgent", responseWindowSec: 10, text: "" }); })}>Добавить стадию</Button>
        </div>
      </details>
      <Field label="Вагон ситуации">
        <p className="text-xs text-muted-foreground">Игрок видит признаки и время ожидания; срочность и тяжесть используются для оценки.</p>
        <Select value={ev.location?.carId ?? "actor"} onValueChange={(v) => upd((x) => { x.location = v === "actor" ? undefined : { carId: v }; })}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="actor">По положению пассажира / рация</SelectItem>{data.train.cars.map((c) => <SelectItem key={c.id} value={c.id}>Вагон {c.number}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <details className="text-xs">
        <summary className="cursor-pointer">Эскалация ситуации</summary>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2"><Switch checked={!!ev.escalation} onCheckedChange={(v) => upd((x) => { x.escalation = v ? { afterSec: 30, effects: { loyalty: -3, safety: 0 } } : undefined; })} />Ухудшение, если ситуация не решена</label>
          {ev.escalation && <>
            <Field label="Через сколько секунд от появления"><NumberInput value={ev.escalation.afterSec} min={1} onChange={(v) => upd((x) => { x.escalation!.afterSec = Math.max(1, v); })} /></Field>
            <Input value={ev.escalation.text ?? ""} placeholder="Наблюдаемые признаки ухудшения" onChange={(e) => upd((x) => { x.escalation!.text = e.target.value; })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Лояльность"><NumberInput value={ev.escalation.effects?.loyalty ?? 0} onChange={(v) => upd((x) => { x.escalation!.effects = { loyalty: v, safety: x.escalation!.effects?.safety ?? 0 }; })} /></Field>
              <Field label="Безопасность"><NumberInput value={ev.escalation.effects?.safety ?? 0} onChange={(v) => upd((x) => { x.escalation!.effects = { loyalty: x.escalation!.effects?.loyalty ?? 0, safety: v }; })} /></Field>
            </div>
            <Select value={ev.escalation.nextEvent ?? "stay"} onValueChange={(v) => upd((x) => { x.escalation!.nextEvent = v === "stay" ? undefined : v; })}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stay">Оставить обращение открытым</SelectItem>{data.events.filter((e) => e.id !== ev.id).map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
            </Select>
          </>}
        </div>
      </details>
      <Field label="Материал, требующий подтверждения">
        <Textarea value={ev.contentTodo ?? ""} onChange={(e) => upd((x) => { x.contentTodo = e.target.value || undefined; })} className="text-xs" placeholder="TODO по методике (не нормативное правило)" />
      </Field>
      <details className="text-xs">
        <summary className="cursor-pointer">Контекст для разбора</summary>
        <div className="mt-2 space-y-2">
          {(ev.context ?? []).map((c, i) => <div key={i} className="flex flex-wrap gap-1">
            <Input value={c.flag} aria-label="Флаг контекста" className="h-7 flex-1 min-w-24" onChange={(e) => upd((x) => { x.context![i].flag = e.target.value; })} />
            <Input value={c.label} aria-label="Описание контекста" className="h-7 flex-1 min-w-24" onChange={(e) => upd((x) => { x.context![i].label = e.target.value; })} />
            <Button size="icon" variant="ghost" className="size-7" aria-label="Удалить контекст" onClick={() => upd((x) => { x.context!.splice(i, 1); })}><X className="size-3.5" /></Button>
          </div>)}
          <Button size="sm" variant="ghost" onClick={() => upd((x) => { x.context = [...(x.context ?? []), { flag: "context_known", label: "Контекст уточнён" }]; })}>Добавить контекст</Button>
        </div>
      </details>
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
            onValueChange={(v) =>
              upd((x) => (x.trigger =
                v === "time" ? { type: "time", atSec: 30 }
                : v === "actor" ? { type: "actor" }
                : v === "condition" ? { type: "condition", if: { loyalty: { lt: 30 } } }
                : { type: "manual" }))
            }
          >
            <SelectTrigger className="h-8" data-testid="select-trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Вручную (кнопка)</SelectItem>
              <SelectItem value="time">По времени рейса</SelectItem>
              <SelectItem value="actor">Из шага актора</SelectItem>
              <SelectItem value="condition">По условию (шкала / флаг)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {ev.trigger.type === "condition" && (
          <Field label="Запустить, когда" className="col-span-2">
            <ConditionEditor value={ev.trigger.if} onChange={(c) => upd((x) => (x.trigger = { type: "condition", if: c ?? { loyalty: { lt: 30 } } }))} allowEmpty={false} />
          </Field>
        )}
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
              e.nodes.forEach((x) => {
                if (x.next === node.id) x.next = null;
                if (x.onTimeout?.next === node.id) x.onTimeout.next = null;
                x.options.forEach((o) => {
                  if (o.next === node.id) o.next = null;
                  o.nextIf?.forEach((branch) => { if (branch.next === node.id) branch.next = null; });
                });
              });
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
      <Select value={node.kind ?? "decision"} onValueChange={(v) => un((n) => {
        n.kind = v as DialogueNode["kind"];
        if (v === "information") { n.next = n.options[0]?.next ?? null; n.set = n.options[0]?.set; n.options = []; delete n.timerSec; delete n.onTimeout; }
      })}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="decision">Решение</SelectItem><SelectItem value="information">Информация (не оценивается)</SelectItem></SelectContent>
      </Select>
      {node.kind === "information" ? (
        <NodeSelect ev={ev} value={node.next ?? null} exclude={node.id} onChange={(v) => un((n) => { n.next = v; })} />
      ) : <div className="space-y-2">
        {node.options.length < 2 && <p className="text-xs text-amber-600">Нужны минимум два содержательных действия. При одном доступном варианте игрок увидит «Продолжить» без оценки.</p>}
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
            <Textarea
              value={o.feedback ?? ""}
              onChange={(e) => un((n) => { if (e.target.value) n.options[oi].feedback = e.target.value; else delete n.options[oi].feedback; })}
              className="text-xs min-h-12"
              placeholder="Пояснение для разбора: почему этот выбор так влияет на шкалы"
            />
            <OptionLogic ev={ev} node={node} option={o} onChange={(fn) => un((n) => fn(n.options[oi]))} />
          </div>
        ))}
        <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => un((n) => n.options.push({ id: uid("o_"), text: "", next: null, effects: { loyalty: 0, safety: 0 } }))}>
          <Plus className="size-3.5 mr-1" /> Вариант ответа
        </Button>
      </div>}
      {node.kind !== "information" && <TimeoutEditor ev={ev} node={node} un={un} />}
    </div>
  );
}

// ── Логика варианта: шаг ролевой модели, флаги, условие показа, условные переходы ──

function NodeSelect({ ev, value, onChange, exclude }: { ev: GameEvent; value: string | null; onChange: (v: string | null) => void; exclude?: string }) {
  return (
    <Select value={value ?? "end"} onValueChange={(v) => onChange(v === "end" ? null : v)}>
      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="end">→ конец события</SelectItem>
        {ev.nodes.filter((x) => x.id !== exclude).map((x) => (
          <SelectItem key={x.id} value={x.id}>→ узел {ev.nodes.indexOf(x) + 1}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function OptionLogic({ ev, node, option: o, onChange }: { ev: GameEvent; node: DialogueNode; option: DialogueOption; onChange: (fn: (o: DialogueOption) => void) => void }) {
  const flags = Object.entries(o.set ?? {});
  const count = (o.step ? 1 : 0) + flags.length + (o.if ? 1 : 0) + (o.nextIf?.length ?? 0) + (o.outcomes?.length ?? 0);
  return (
    <details className="text-xs" data-testid={`logic-${o.id}`}>
      <summary className="cursor-pointer text-muted-foreground select-none">Логика варианта{count ? ` · ${count}` : ""}</summary>
      <div className="mt-2 space-y-2.5">
        <Field label="Стоимость действия, секунд бюджета решения (0 — без стоимости)">
          <NumberInput value={o.timeCostSec ?? 0} min={0} onChange={(v) => onChange((x) => { x.timeCostSec = v > 0 ? v : undefined; })} className="h-7" />
        </Field>
        <Field label="Контекстные результаты (первый сработавший, иначе базовая оценка)">
          <div className="space-y-2">
            {(o.outcomes ?? []).map((outcome, i) => <div key={i} className="border rounded p-2 space-y-2">
              <ConditionEditor value={outcome.if} allowEmpty={false} onChange={(c) => onChange((x) => { if (c) x.outcomes![i].if = c; })} />
              <label className="flex items-center gap-2"><Switch checked={outcome.correct} onCheckedChange={(v) => onChange((x) => { x.outcomes![i].correct = v; })} /> Обоснован в этом контексте</label>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Лояльность"><NumberInput value={outcome.effects.loyalty} onChange={(v) => onChange((x) => { x.outcomes![i].effects.loyalty = v; })} className="h-7" /></Field>
                <Field label="Безопасность"><NumberInput value={outcome.effects.safety} onChange={(v) => onChange((x) => { x.outcomes![i].effects.safety = v; })} className="h-7" /></Field>
              </div>
              <Textarea value={outcome.feedback} aria-label="Пояснение контекстного результата" onChange={(e) => onChange((x) => { x.outcomes![i].feedback = e.target.value; })} className="text-xs" />
              <Button size="sm" variant="ghost" onClick={() => onChange((x) => { x.outcomes!.splice(i, 1); if (!x.outcomes!.length) delete x.outcomes; })}>Удалить результат</Button>
            </div>)}
            <Button size="sm" variant="ghost" onClick={() => onChange((x) => { x.outcomes = [...(x.outcomes ?? []), { if: { flag: "context_known" }, correct: false, effects: { ...x.effects }, feedback: "" }]; })}>Добавить контекстный результат</Button>
          </div>
        </Field>
        <Field label="Шаг модели">
          <Select value={o.step ?? "none"} onValueChange={(v) => onChange((x) => { if (v === "none") delete x.step; else x.step = v as DialogueOption["step"]; })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— не размечено —</SelectItem>
              {ROLE_STEPS.map((s) => (
                <SelectItem key={s} value={s}>{ROLE_STEP_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Выставляет флаги">
          <div className="space-y-1.5">
            {flags.map(([name, value], i) => (
              <div key={i} className="flex gap-1.5">
                <Input value={name} placeholder="имя флага" className="h-7 text-xs font-mono"
                  onChange={(e) => onChange((x) => { x.set = renameKey(x.set!, name, e.target.value); })} />
                <Select value={typeof value === "number" ? "number" : String(value)}
                  onValueChange={(v) => onChange((x) => { x.set![name] = v === "number" ? 1 : v === "true"; })}>
                  <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">= да</SelectItem>
                    <SelectItem value="false">= нет</SelectItem>
                    <SelectItem value="number">= число</SelectItem>
                  </SelectContent>
                </Select>
                {typeof value === "number" && (
                  <NumberInput value={value} onChange={(n) => onChange((x) => { x.set![name] = n; })} className="h-7 w-14 font-mono" />
                )}
                <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label="Удалить флаг"
                  onClick={() => onChange((x) => { delete x.set![name]; if (!Object.keys(x.set!).length) delete x.set; })}>
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange((x) => { x.set = { ...x.set, [freeFlagName(x.set)]: true }; })}>
              <Plus className="size-3.5 mr-1" /> Флаг
            </Button>
          </div>
        </Field>

        <Field label="Показывать, если">
          <ConditionEditor value={o.if} onChange={(c) => onChange((x) => { if (c) x.if = c; else delete x.if; })} />
        </Field>

        <Field label="Условные переходы (первый сработавший, иначе основной)">
          <div className="space-y-1.5">
            {(o.nextIf ?? []).map((b, i) => (
              <div key={i} className="rounded border p-1.5 space-y-1.5">
                <ConditionEditor value={b.if} allowEmpty={false} onChange={(c) => onChange((x) => { if (c) x.nextIf![i].if = c; })} />
                <div className="flex gap-1.5">
                  <NodeSelect ev={ev} value={b.next} exclude={node.id} onChange={(v) => onChange((x) => { x.nextIf![i].next = v; })} />
                  <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label="Удалить переход"
                    onClick={() => onChange((x) => { x.nextIf!.splice(i, 1); if (!x.nextIf!.length) delete x.nextIf; })}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => onChange((x) => { x.nextIf = [...(x.nextIf ?? []), { if: { loyalty: { lt: 30 } }, next: null }]; })}>
              <Plus className="size-3.5 mr-1" /> Переход по условию
            </Button>
          </div>
        </Field>
      </div>
    </details>
  );
}

function TimeoutEditor({ ev, node, un }: { ev: GameEvent; node: DialogueNode; un: (fn: (n: DialogueNode) => void) => void }) {
  const t = node.onTimeout;
  if (!node.timerSec) return null;
  return (
    <div className="rounded border border-dashed border-[hsl(var(--danger))]/40 p-2 space-y-2 text-xs" data-testid={`timeout-${node.id}`}>
      <label className="flex items-center gap-1.5">
        <Switch checked={!!t} className="scale-90"
          onCheckedChange={(v) => un((n) => { if (v) n.onTimeout = { next: null, effects: { loyalty: -15, safety: 0 }, text: "пассажир ушёл жаловаться" }; else delete n.onTimeout; })} />
        Своя ветка на таймаут
        {!t && <span className="text-muted-foreground">(иначе стандартный штраф)</span>}
      </label>
      {t && (
        <>
          <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-1.5">
            <span className="text-[hsl(var(--loyalty))]">Лояльн.</span>
            <NumberInput value={t.effects.loyalty} onChange={(v) => un((n) => (n.onTimeout!.effects.loyalty = v))} className="h-7 font-mono" />
            <span className="text-[hsl(var(--safety))]">Безоп.</span>
            <NumberInput value={t.effects.safety} onChange={(v) => un((n) => (n.onTimeout!.effects.safety = v))} className="h-7 font-mono" />
          </div>
          <NodeSelect ev={ev} value={t.next} exclude={node.id} onChange={(v) => un((n) => (n.onTimeout!.next = v))} />
          <Input value={t.text ?? ""} onChange={(e) => un((n) => (n.onTimeout!.text = e.target.value))} className="h-7 text-xs" placeholder="Запись в журнал: что произошло" />
        </>
      )}
    </div>
  );
}

// ── Простая форма условия: флаг / лояльность / безопасность + число. Составные (all/any) — только из JSON ──

function ConditionEditor({ value, onChange, allowEmpty = true }: { value: Condition | undefined; onChange: (c: Condition | undefined) => void; allowEmpty?: boolean }) {
  const kind = !value ? "none" : "flag" in value ? "flag" : "loyalty" in value ? "loyalty" : "safety" in value ? "safety" : "complex";
  const setKind = (k: string) =>
    onChange(k === "none" ? undefined : k === "flag" ? { flag: "" } : k === "loyalty" ? { loyalty: { lt: 30 } } : { safety: { lt: 40 } });
  return (
    <div className="flex flex-wrap gap-1.5">
      <Select value={kind} onValueChange={setKind}>
        <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value="none">всегда</SelectItem>}
          <SelectItem value="flag">флаг</SelectItem>
          <SelectItem value="loyalty">лояльность</SelectItem>
          <SelectItem value="safety">безопасность</SelectItem>
          {kind === "complex" && <SelectItem value="complex">составное (JSON)</SelectItem>}
        </SelectContent>
      </Select>
      {value && "flag" in value && (
        <>
          <Input value={value.flag} placeholder="имя флага" className="h-7 text-xs font-mono flex-1 min-w-24" onChange={(e) => onChange({ ...value, flag: e.target.value })} />
          <Select value={value.eq === false ? "unset" : "set"} onValueChange={(v) => onChange(v === "set" ? { flag: value.flag } : { flag: value.flag, eq: false })}>
            <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="set">выставлен</SelectItem>
              <SelectItem value="unset">не выставлен</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
      {value && ("loyalty" in value || "safety" in value) && (() => {
        const key = "loyalty" in value ? "loyalty" : "safety";
        const range = "loyalty" in value ? value.loyalty : value.safety;
        const op = range.lt !== undefined ? "lt" : "gte";
        const num = range.lt ?? range.gte ?? 0;
        const make = (o: string, n: number) => ({ [key]: o === "lt" ? { lt: n } : { gte: n } }) as Condition;
        return (
          <>
            <Select value={op} onValueChange={(o) => onChange(make(o, num))}>
              <SelectTrigger className="h-7 text-xs w-16"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lt">&lt;</SelectItem>
                <SelectItem value="gte">≥</SelectItem>
              </SelectContent>
            </Select>
            <NumberInput value={num} min={0} max={100} onChange={(n) => onChange(make(op, n))} className="h-7 w-16 font-mono" />
          </>
        );
      })()}
      {kind === "complex" && <span className="text-muted-foreground self-center">задано в JSON сценария</span>}
    </div>
  );
}

const freeFlagName = (set: Record<string, FlagValue> | undefined) => {
  let i = 1;
  while (set && `flag${i}` in set) i++;
  return `flag${i}`;
};

/** Переименование ключа с сохранением порядка */
const renameKey = (obj: Record<string, FlagValue>, from: string, to: string) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]));

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
  const [type, setType] = useState<(typeof CAR_TYPES)[number]>("comfort");
  const addCar = () => {
    mutate((d) => {
      const car = buildCar(d.train.cars.length + 1, type, DEFAULT_ROWS[type]);
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
        if (a.spawn.carId === id) a.spawn = { carId: first.id, x: 1, y: aisleRow(first.type) };
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
        <Field label="Развитие ситуаций">
          <Select value={data.gameplay ?? "concurrent"} onValueChange={(v) => mutate((d) => { d.gameplay = v as ScenarioData["gameplay"]; })}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="concurrent">Одновременно, время идёт</SelectItem><SelectItem value="sequential">По очереди (прежний режим)</SelectItem></SelectContent>
          </Select>
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
      <details className="rounded-md border p-3 text-xs">
        <summary className="cursor-pointer font-medium">Доступные сервисы рейса</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SERVICE_ENTITLEMENTS.map((item) => {
            const selected = data.serviceEntitlements?.[item] ?? false;
            return <Button key={item} size="sm" type="button" variant={selected ? "default" : "outline"} className="h-7 text-xs"
              onClick={() => mutate((d) => {
                d.serviceEntitlements = { ...d.serviceEntitlements, [item]: !selected };
                if (!d.serviceEntitlements[item]) delete d.serviceEntitlements[item];
                if (!Object.keys(d.serviceEntitlements).length) delete d.serviceEntitlements;
              })}>{ENTITLEMENT_LABEL[item]}</Button>;
          })}
        </div>
      </details>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Вагоны · {data.train.cars.length}</span>
      </div>
      <div className="space-y-1.5">
        {data.train.cars.map((c) => <div key={c.id} className="rounded-md border px-2.5 py-2 text-sm">
          <div className="flex items-center gap-2">
            <button className="flex-1 text-left" onClick={() => onSelectCar(c.id)} data-testid={`button-focus-car-${c.number}`}>
              <span className="font-mono font-semibold mr-2">{c.number}</span>{CAR_TYPE_LABEL[c.type]}
              <span className="text-muted-foreground text-xs ml-2">{c.cells.filter((x) => x.kind === "seat").length} мест</span>
            </button>
            <Button size="icon" variant="ghost" className="size-7 text-muted-foreground" disabled={data.train.cars.length === 1} aria-label="Удалить вагон" onClick={() => removeCar(c.id)}><Trash2 className="size-3.5" /></Button>
          </div>
          <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted-foreground">Ресурсы вагона</summary>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Field label="Свободные места"><NumberInput value={c.availableSeats ?? 0} min={0} onChange={(n) => mutate((d) => { d.train.cars.find((x) => x.id === c.id)!.availableSeats = n; })} /></Field>
              <div className="col-span-2 flex flex-wrap gap-1.5">{(Object.keys(CAPABILITY_LABEL) as (keyof typeof CAPABILITY_LABEL)[]).map((item) => {
                const selected = c.capabilities?.[item] ?? false;
                return <Button key={item} size="sm" type="button" variant={selected ? "default" : "outline"} className="h-7 text-xs" onClick={() => mutate((d) => {
                  const target = d.train.cars.find((x) => x.id === c.id)!;
                  target.capabilities = { ...target.capabilities, [item]: !selected };
                  if (!target.capabilities[item]) delete target.capabilities[item];
                  if (!Object.keys(target.capabilities).length) delete target.capabilities;
                })}>{CAPABILITY_LABEL[item]}</Button>;
              })}</div>
            </div>
          </details>
        </div>)}
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
