/**
 * 2D-карта вагона (вид сверху) на SVG.
 * Используется и в редакторе (клики по клеткам/акторам), и в режиме прогона (анимация движения).
 */
import { memo } from "react";
import { aisleRow, type Car, type Cell, type ActorRole } from "@shared/scenario";

export const CELL = 40;
const PAD = 22;

export interface MapActor {
  id: string;
  name: string;
  role: ActorRole;
  carId: string;
  x: number;
  y: number;
  seated?: boolean;
  wrongSeat?: boolean;
  mood?: number;
  bubble?: string | null;
  selected?: boolean;
  alert?: boolean; // связан с активным событием
}

export type SeatMark = "ticket" | "target" | "occupied";

interface Props {
  car: Car;
  actors: MapActor[];
  seatMarks?: Record<string, SeatMark>;
  cellMarks?: Record<string, "target">; // ключ "x,y"
  onCellClick?: (cell: Cell) => void;
  onActorClick?: (id: string) => void;
  cursor?: "default" | "crosshair" | "pointer";
  className?: string;
  /** Компактный режим (мини-карта игры): без минимальной ширины */
  compact?: boolean;
}

export const ROLE_COLOR: Record<ActorRole, string> = {
  passenger: "#3b82f6",
  vip: "#8b5cf6",
  elderly: "#0d9488",
  child: "#f59e0b",
  troublemaker: "#ef4444",
  conductor: "#1e293b",
};

const v = (name: string) => `hsl(var(--${name}))`;

export const CarMap = memo(function CarMap({
  car,
  actors,
  seatMarks = {},
  cellMarks = {},
  onCellClick,
  onActorClick,
  cursor = "default",
  className,
  compact = false,
}: Props) {
  const W = car.length * CELL + PAD * 2;
  const H = car.width * CELL + PAD * 2;
  const hatch = `hatch-${car.id}`;
  const inCar = actors.filter((a) => a.carId === car.id);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ width: "100%", minWidth: compact ? 0 : Math.min(W, 640), height: "auto", cursor, display: "block" }}
      role="img"
      aria-label={`Вагон ${car.number}`}
      data-testid={`map-car-${car.number}`}
    >
      <defs>
        <pattern id={hatch} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={v("border")} strokeWidth="2" />
        </pattern>
      </defs>

      {/* Корпус вагона */}
      <rect
        x={PAD - 12}
        y={PAD - 12}
        width={W - (PAD - 12) * 2}
        height={H - (PAD - 12) * 2}
        rx={18}
        style={{ fill: v("card"), stroke: v("border"), strokeWidth: 2 }}
      />
      {/* Окна по бортам */}
      {Array.from({ length: car.length - 2 }, (_, i) => i + 1).map((x) => (
        <g key={x}>
          <rect x={x * CELL + PAD + 6} y={PAD - 10} width={CELL - 12} height={5} rx={2} style={{ fill: v("primary"), opacity: 0.25 }} />
          <rect x={x * CELL + PAD + 6} y={H - PAD + 5} width={CELL - 12} height={5} rx={2} style={{ fill: v("primary"), opacity: 0.25 }} />
        </g>
      ))}

      {/* Клетки */}
      {car.cells.map((c) => (
        <CellView
          key={`${c.x},${c.y}`}
          cell={c}
          carType={car.type}
          hatch={hatch}
          mark={c.seat ? seatMarks[c.seat] : undefined}
          cellMark={cellMarks[`${c.x},${c.y}`]}
          onClick={onCellClick ? () => onCellClick(c) : undefined}
        />
      ))}

      {/* Акторы */}
      {inCar.map((a) => (
        <ActorView key={a.id} actor={a} onClick={onActorClick ? () => onActorClick(a.id) : undefined} />
      ))}

      {/* Пузыри реплик — поверх всего */}
      {inCar
        .filter((a) => a.bubble)
        .map((a) => (
          <Bubble key={`b-${a.id}`} actor={a} width={W} />
        ))}
    </svg>
  );
});

function CellView({
  cell,
  carType,
  hatch,
  mark,
  cellMark,
  onClick,
}: {
  cell: Cell;
  carType: Car["type"];
  hatch: string;
  mark?: SeatMark;
  cellMark?: "target";
  onClick?: () => void;
}) {
  const px = cell.x * CELL + PAD;
  const py = cell.y * CELL + PAD;
  const common = { onClick, style: onClick ? { cursor: "pointer" } : undefined };
  const base = <rect x={px} y={py} width={CELL} height={CELL} fill="transparent" {...common} />;

  switch (cell.kind) {
    case "seat": {
      const fill =
        mark === "ticket" ? v("primary") : mark === "target" ? v("loyalty") : mark === "occupied" ? v("muted") : v("accent");
      const opacity = mark ? 0.35 : 1;
      const isTop = cell.y < aisleRow(carType); // спинка со стороны окна
      return (
        <g {...common} data-testid={`cell-seat-${cell.seat}`}>
          {base}
          <rect x={px + 5} y={py + 5} width={CELL - 10} height={CELL - 10} rx={7} style={{ fill, opacity, stroke: v("border"), strokeWidth: 1 }} />
          <rect
            x={px + 5}
            y={isTop ? py + 5 : py + CELL - 12}
            width={CELL - 10}
            height={7}
            rx={3}
            style={{ fill: mark === "ticket" ? v("primary") : v("muted-foreground"), opacity: mark === "ticket" ? 0.9 : 0.35 }}
          />
          <text
            x={px + CELL / 2}
            y={isTop ? py + CELL - 10 : py + 20}
            textAnchor="middle"
            className="font-mono"
            style={{ fontSize: 10, fill: v("muted-foreground"), fontWeight: 600, pointerEvents: "none" }}
          >
            {cell.seat}
          </text>
          {(carType === "first" || carType === "business") && (
            <circle cx={px + CELL - 9} cy={isTop ? py + CELL - 9 : py + 9} r={2} style={{ fill: v("chart-5"), opacity: 0.8 }} />
          )}
        </g>
      );
    }
    case "aisle":
      return (
        <g {...common}>
          <rect x={px} y={py} width={CELL} height={CELL} style={{ fill: v("background"), opacity: 0.6 }} />
          {cellMark && <rect x={px + 8} y={py + 8} width={CELL - 16} height={CELL - 16} rx={6} style={{ fill: v("loyalty"), opacity: 0.4 }} />}
        </g>
      );
    case "vestibule":
      return (
        <g {...common}>
          <rect x={px} y={py} width={CELL} height={CELL} style={{ fill: v("muted") }} />
          <rect x={px} y={py} width={CELL} height={CELL} fill={`url(#${hatch})`} opacity={0.5} />
          {cellMark && <rect x={px + 8} y={py + 8} width={CELL - 16} height={CELL - 16} rx={6} style={{ fill: v("loyalty"), opacity: 0.4 }} />}
        </g>
      );
    case "door":
      return (
        <g {...common}>
          <rect x={px} y={py} width={CELL} height={CELL} style={{ fill: v("muted") }} />
          <rect x={px + 4} y={py + 6} width={CELL - 8} height={CELL - 12} rx={4} style={{ fill: v("foreground"), opacity: 0.75 }} />
          <rect x={px + CELL / 2 - 1} y={py + 8} width={2} height={CELL - 16} style={{ fill: v("card") }} />
        </g>
      );
    case "toilet":
      return (
        <g {...common}>
          <rect x={px + 2} y={py + 2} width={CELL - 4} height={CELL - 4} rx={4} style={{ fill: v("secondary"), stroke: v("border") }} />
          {cell.kind === "toilet" && (
            <text x={px + CELL / 2} y={py + CELL / 2 + 4} textAnchor="middle" className="font-mono" style={{ fontSize: 10, fill: v("muted-foreground"), fontWeight: 600 }}>
              WC
            </text>
          )}
        </g>
      );
    case "luggage":
      return (
        <g {...common}>
          <rect x={px + 2} y={py + 2} width={CELL - 4} height={CELL - 4} rx={4} style={{ fill: v("secondary"), stroke: v("border") }} />
          <rect x={px + 2} y={py + 2} width={CELL - 4} height={CELL - 4} rx={4} fill={`url(#${hatch})`} opacity={0.6} />
        </g>
      );
    case "table":
      return (
        <g {...common}>
          <rect x={px} y={py} width={CELL} height={CELL} style={{ fill: v("background"), opacity: 0.6 }} />
          <circle cx={px + CELL / 2} cy={py + CELL / 2} r={13} style={{ fill: v("secondary"), stroke: v("border"), strokeWidth: 1.5 }} />
        </g>
      );
    case "bar":
      return (
        <g {...common}>
          <rect x={px} y={py + 4} width={CELL} height={CELL - 8} style={{ fill: v("chart-2"), opacity: 0.35 }} />
          {cell.x === 2 && (
            <text x={px + 6} y={py + CELL / 2 + 4} className="font-mono" style={{ fontSize: 10, fill: v("foreground"), fontWeight: 600 }}>
              БАР
            </text>
          )}
        </g>
      );
    default:
      return <g {...common}>{base}</g>;
  }
}

const initials = (name: string) =>
  name
    .replace(/\(.*\)/, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function ActorView({ actor, onClick }: { actor: MapActor; onClick?: () => void }) {
  const cx = actor.x * CELL + PAD + CELL / 2;
  const cy = actor.y * CELL + PAD + CELL / 2;
  const color = ROLE_COLOR[actor.role];
  const r = actor.seated ? 12 : 14;
  const mood = actor.mood ?? 100;
  const moodColor = mood > 66 ? v("safety") : mood > 33 ? v("loyalty") : v("danger");
  const circ = 2 * Math.PI * (r + 4);

  return (
    <g
      transform={`translate(${cx} ${cy})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{ cursor: onClick ? "pointer" : "default" }}
      data-testid={`actor-${actor.id}`}
    >
      {actor.alert && <circle r={r + 6} className="pulse-ring" style={{ fill: "none", stroke: v("danger"), strokeWidth: 3 }} />}
      {actor.selected && <circle r={r + 8} style={{ fill: "none", stroke: v("primary"), strokeWidth: 2.5 }} />}
      {actor.wrongSeat && <circle r={r + 5} style={{ fill: "none", stroke: v("danger"), strokeWidth: 2, strokeDasharray: "4 3" }} />}
      {/* дуга настроения */}
      {actor.role !== "conductor" && (
        <circle
          r={r + 4}
          transform="rotate(-90)"
          style={{ fill: "none", stroke: moodColor, strokeWidth: 2.5, strokeDasharray: `${(circ * mood) / 100} ${circ}`, opacity: 0.9 }}
        />
      )}
      {actor.role === "conductor" ? (
        <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={6} style={{ fill: v("primary"), stroke: v("card"), strokeWidth: 2 }} />
      ) : (
        <circle r={r} style={{ fill: color, stroke: v("card"), strokeWidth: 2 }} />
      )}
      <text textAnchor="middle" y={4} style={{ fontSize: 11, fontWeight: 700, fill: "#fff", pointerEvents: "none" }}>
        {actor.role === "conductor" ? "П" : initials(actor.name)}
      </text>
    </g>
  );
}

function Bubble({ actor, width }: { actor: MapActor; width: number }) {
  const text = actor.bubble!.length > 28 ? actor.bubble!.slice(0, 27) + "…" : actor.bubble!;
  const w = Math.min(width - 20, text.length * 6.6 + 18);
  let cx = actor.x * CELL + PAD + CELL / 2;
  cx = Math.max(w / 2 + 6, Math.min(width - w / 2 - 6, cx));
  const cy = actor.y * CELL + PAD - 6;
  return (
    <g transform={`translate(${cx} ${cy})`} style={{ pointerEvents: "none" }}>
      <rect x={-w / 2} y={-24} width={w} height={22} rx={7} style={{ fill: v("foreground"), opacity: 0.92 }} />
      <path d="M-4 -3 L0 3 L4 -3 Z" style={{ fill: v("foreground"), opacity: 0.92 }} />
      <text textAnchor="middle" y={-9} style={{ fontSize: 11, fill: v("background"), fontWeight: 500 }}>
        {text}
      </text>
    </g>
  );
}

export function Legend() {
  const items: { role: ActorRole; label: string }[] = [
    { role: "conductor", label: "Проводник" },
    { role: "passenger", label: "Пассажир" },
    { role: "vip", label: "VIP" },
    { role: "elderly", label: "Пожилой" },
    { role: "child", label: "Ребёнок" },
    { role: "troublemaker", label: "Конфликтный" },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.role} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: i.role === "conductor" ? "hsl(var(--primary))" : ROLE_COLOR[i.role] }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
