import { memo, useId } from "react";
import { aisleRow, type Car } from "@shared/scenario";
import { type InteriorPreset } from "./assets";
import { COL, WORLD_H, FLOOR_FAR, WIN_TOP, WIN_BOTTOM, worldWidth } from "./world";

/**
 * Векторный интерьер вагона, вид сбоку на дальний борт.
 * Слои: потолок и свет → стена с вырезами окон (сквозь них виден WindowLandscape) → полки → кресла/стойка → пол.
 * Ближний ряд кресел рисуется отдельно (TrainForeground) поверх персонажей — так появляется глубина.
 */
/** Кресло в профиль (смотрит вправо, к голове поезда): одна фигура спинка+сиденье, k — масштаб по глубине */
function Seat({ cx, base, k, p }: { cx: number; base: number; k: number; p: InteriorPreset }) {
  const X = (dx: number) => cx + dx * k;
  const Y = (dy: number) => base - dy * k;
  const body = `M${X(-42)},${Y(8)} L${X(-38)},${Y(118)} Q${X(-36)},${Y(132)} ${X(-24)},${Y(130)} L${X(-16)},${Y(126)} Q${X(-10)},${Y(122)} ${X(-12)},${Y(110)} L${X(-18)},${Y(40)} L${X(30)},${Y(40)} Q${X(40)},${Y(38)} ${X(38)},${Y(26)} L${X(36)},${Y(18)} L${X(-30)},${Y(12)} Z`;
  return (
    <g>
      <path d={body} fill={p.seat} />
      <path d={`M${X(-38)},${Y(118)} Q${X(-36)},${Y(132)} ${X(-24)},${Y(130)} L${X(-16)},${Y(126)} Q${X(-10)},${Y(122)} ${X(-12)},${Y(110)} L${X(-13)},${Y(96)} L${X(-39)},${Y(100)} Z`} fill={p.seatShade} />
      <rect x={X(-22)} y={Y(66)} width={36 * k} height={6 * k} rx={3 * k} fill={p.seatShade} />
      <rect x={X(-4)} y={Y(12)} width={9 * k} height={12 * k} fill="#6b7280" />
    </g>
  );
}

export const TrainInterior = memo(function TrainInterior({ car, palette: p }: { car: Car; palette: InteriorPreset }) {
  const maskId = useId().replace(/:/g, "");
  const W = worldWidth(car.length);
  const last = car.length - 1;
  const aisle = aisleRow(car.type);
  const bistro = car.type === "bistro";

  // окна: по одному широкому окну на каждые две колонки салона
  const windows: { x: number; w: number }[] = [];
  for (let x = 2; x <= last - 2; x += 2) {
    const span = Math.min(2, last - 1 - x);
    windows.push({ x: x * COL + 12, w: span * COL - 24 });
  }
  const seatCols = car.cells.filter((c) => c.kind === "seat" && c.y < aisle).map((c) => c.x);
  const farSeats = Array.from(new Set(seatCols));
  const bar = car.cells.filter((c) => c.kind === "bar").map((c) => c.x);
  const tables = Array.from(new Set(car.cells.filter((c) => c.kind === "table" && c.y < aisle).map((c) => c.x)));

  return (
    <svg viewBox={`0 0 ${W} ${WORLD_H}`} width={W} height={WORLD_H} className="absolute inset-0 overflow-visible" aria-hidden>
      <defs>
        <mask id={maskId}>
          <rect width={W} height={WORLD_H} fill="white" />
          {windows.map((w, i) => (
            <rect key={i} x={w.x} y={WIN_TOP} width={w.w} height={WIN_BOTTOM - WIN_TOP} rx={22} fill="black" />
          ))}
        </mask>
        <linearGradient id={`${maskId}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.floor} stopOpacity=".85" />
          <stop offset="1" stopColor={p.floor} />
        </linearGradient>
        <linearGradient id={`${maskId}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".4" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* стена с окнами */}
      <g mask={`url(#${maskId})`}>
        <rect width={W} height={FLOOR_FAR} fill={p.wall} />
        <rect y={WIN_BOTTOM + 8} width={W} height={FLOOR_FAR - WIN_BOTTOM - 8} fill={p.panel} />
        <rect y={WIN_BOTTOM + 4} width={W} height={4} fill={p.accent} opacity=".7" />
      </g>
      {windows.map((w, i) => (
        <g key={i}>
          <rect x={w.x} y={WIN_TOP} width={w.w} height={WIN_BOTTOM - WIN_TOP} rx={22} fill={`url(#${maskId}-glass)`} />
          <rect x={w.x} y={WIN_TOP} width={w.w} height={WIN_BOTTOM - WIN_TOP} rx={22} fill="none" stroke="#9aa3ad" strokeWidth={6} />
          <rect x={w.x - 4} y={WIN_TOP - 10} width={w.w + 8} height={8} rx={4} fill={p.panel} opacity=".9" />
        </g>
      ))}

      {/* потолок (продлён вверх для общего плана камеры), световая линия, багажные полки */}
      <rect y={-400} width={W} height={434} fill={p.ceiling} />
      <rect y={-60} width={W} height={6} fill="#fffbe8" opacity=".8" />
      <rect y={26} width={W} height={5} fill="#fffbe8" opacity=".95" />
      <rect x={2 * COL} y={42} width={(last - 3) * COL} height={14} rx={4} fill="#5b6570" opacity=".35" />
      <rect x={2 * COL} y={54} width={(last - 3) * COL} height={3} fill="#3b4450" opacity=".5" />

      {/* тамбуры: двери с остеклением на торцах */}
      {[0, last].map((x) => (
        <g key={x}>
          <rect x={x * COL + 18} y={48} width={COL - 36} height={FLOOR_FAR - 48} rx={8} fill="#c7cdd4" stroke="#9aa3ad" strokeWidth={3} />
          <rect x={x * COL + 36} y={78} width={COL - 72} height={110} rx={8} fill="#8ea2b5" opacity=".55" />
          <rect x={x * COL + COL / 2 - 2} y={48} width={4} height={FLOOR_FAR - 48} fill="#9aa3ad" />
        </g>
      ))}
      {/* санузел и багажная стойка */}
      <g>
        <rect x={COL + 10} y={60} width={COL - 20} height={FLOOR_FAR - 60} rx={6} fill={p.panel} />
        <text x={COL * 1.5} y={150} textAnchor="middle" fontSize={24} fontWeight={700} fill="#6b7280" fontFamily="sans-serif">WC</text>
      </g>
      <g>
        <rect x={(last - 1) * COL + 10} y={70} width={COL - 20} height={FLOOR_FAR - 70} rx={4} fill="none" stroke="#9aa3ad" strokeWidth={5} />
        {[140, 210].map((y) => (
          <rect key={y} x={(last - 1) * COL + 10} y={y} width={COL - 20} height={6} fill="#9aa3ad" />
        ))}
        <rect x={(last - 1) * COL + 24} y={170} width={46} height={38} rx={6} fill="#4b6584" />
        <rect x={(last - 1) * COL + 30} y={236} width={64} height={62} rx={8} fill="#a0522d" opacity=".85" />
      </g>

      {/* пол (продлён вниз, чтобы при движении камеры не было просветов) */}
      <rect y={FLOOR_FAR} width={W} height={WORLD_H - FLOOR_FAR} fill={`url(#${maskId}-floor)`} />
      <rect y={WORLD_H} width={W} height={400} fill={p.floor} />
      <rect y={FLOOR_FAR + 30} width={W} height={42} fill={p.carpet} opacity=".6" />

      {/* бистро: стойка и столики */}
      {bistro && bar.length > 0 && (
        <g>
          <rect x={Math.min(...bar) * COL} y={190} width={(Math.max(...bar) - Math.min(...bar) + 1) * COL} height={FLOOR_FAR - 190} rx={6} fill={p.seat} />
          <rect x={Math.min(...bar) * COL - 6} y={184} width={(Math.max(...bar) - Math.min(...bar) + 1) * COL + 12} height={12} rx={4} fill={p.seatShade} />
          <rect x={Math.min(...bar) * COL + 30} y={140} width={30} height={44} rx={4} fill="#e5e7eb" />
          <rect x={Math.min(...bar) * COL + 80} y={156} width={16} height={28} rx={3} fill={p.accent} />
        </g>
      )}
      {tables.map((x) => (
        <g key={x}>
          <rect x={x * COL + 20} y={236} width={COL - 40} height={10} rx={4} fill={p.seatShade} />
          <rect x={x * COL + COL / 2 - 4} y={246} width={8} height={FLOOR_FAR - 246} fill="#6b7280" />
        </g>
      ))}

      {/* кресла дальнего ряда: профиль, смотрят к голове поезда */}
      {!bistro &&
        farSeats.map((x) => {
          const cx = x * COL + COL / 2;
          return <Seat key={x} cx={cx} base={FLOOR_FAR + 6} k={1} p={p} />;
        })}
    </svg>
  );
});

/**
 * Ближний ряд кресел (места по другую сторону прохода). Слой z=6: перед стоящими в проходе,
 * но за сидящими в ближнем ряду — так появляется глубина без 3D.
 */
export const NearSeats = memo(function NearSeats({ car, palette: p }: { car: Car; palette: InteriorPreset }) {
  const W = worldWidth(car.length);
  const aisle = aisleRow(car.type);
  const cols = Array.from(new Set(car.cells.filter((c) => c.kind === "seat" && c.y > aisle).map((c) => c.x)));
  const tables = Array.from(new Set(car.cells.filter((c) => c.kind === "table" && c.y > aisle).map((c) => c.x)));
  const b = 382; // линия пола ближнего ряда
  return (
    <svg viewBox={`0 0 ${W} ${WORLD_H}`} width={W} height={WORLD_H} className="pointer-events-none absolute inset-0 overflow-visible" style={{ zIndex: 6 }} aria-hidden>
      {cols.map((x) => {
        const cx = x * COL + COL / 2;
        return <Seat key={x} cx={cx} base={b} k={1.22} p={p} />;
      })}
      {tables.map((x) => (
        <g key={x}>
          <rect x={x * COL + 14} y={b - 92} width={COL - 28} height={12} rx={5} fill={p.seatShade} />
          <rect x={x * COL + COL / 2 - 5} y={b - 80} width={10} height={80} fill="#6b7280" />
        </g>
      ))}
    </svg>
  );
});

/** Затенение нижнего края кадра */
export function TrainForeground() {
  return <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/20 to-transparent" style={{ zIndex: 20 }} />;
}
