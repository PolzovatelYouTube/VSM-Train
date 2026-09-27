import { memo } from "react";
import type { CharacterState, Emotion } from "@shared/visual";
import { spriteStyle, SPRITE_STYLES, FALLBACK_SPRITE, type SpriteStyle } from "./assets";
import { cn } from "@/lib/utils";

/**
 * Векторный персонаж 100×250 (ноги внизу), нарисован в 3/4 профиль лицом вправо; влево — зеркально.
 * Состояния idle/walk/sit/talk/listen/positive/negative — CSS-классы g-st-*, эмоция — брови и рот.
 * Неизвестный пресет → нейтральный силуэт (AssetFallback).
 */
/** Осветлить/затемнить #rrggbb без CSS-фильтров (фильтры на каждом кадре дороже) */
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
};

const BROWS: Record<Emotion, string> = {
  neutral: "M55,31 L65,31",
  happy: "M55,31 Q60,28 65,31",
  worried: "M55,33 L65,29",
  angry: "M55,29 L65,34",
};

function Mouth({ emotion }: { emotion: Emotion }) {
  const common = { stroke: "#7a3b2e", strokeWidth: 2.4, fill: "none", strokeLinecap: "round" as const };
  switch (emotion) {
    case "happy":
      return <path className="g-mouth" d="M57,48 Q62,54 67,48" {...common} />;
    case "worried":
      return <ellipse className="g-mouth" cx={62} cy={50} rx={2.6} ry={3} fill="#7a3b2e" />;
    case "angry":
      return <path className="g-mouth" d="M57,52 Q62,46 67,52" {...common} />;
    default:
      return <path className="g-mouth" d="M57,50 L66,50" {...common} />;
  }
}

function Hair({ s }: { s: SpriteStyle }) {
  switch (s.hairStyle) {
    case "long":
      return <path d="M31,40 Q30,16 52,16 Q74,16 72,36 L66,30 Q54,26 44,30 L42,76 Q30,70 31,40 Z" fill={s.hair} />;
    case "bun":
      return (
        <g fill={s.hair}>
          <circle cx={40} cy={20} r={9} />
          <path d="M32,40 Q31,18 52,18 Q72,18 72,34 Q60,26 44,30 Q38,34 36,46 Z" />
        </g>
      );
    case "bald":
      return <path d="M33,44 Q32,34 36,30 L40,48 Z M36,30 Q48,22 60,24" fill={s.hair} stroke={s.hair} strokeWidth={3} />;
    case "kid":
      return <path d="M32,40 Q30,16 52,16 Q74,16 73,36 Q66,24 56,28 Q48,22 40,30 Q36,34 35,46 Z" fill={s.hair} />;
    case "cap":
      return <path d="M33,40 Q32,26 40,24 L40,44 Z" fill={s.hair} />;
    default:
      return <path d="M32,40 Q30,17 52,17 Q72,17 72,32 Q62,24 46,28 Q38,32 36,44 Z" fill={s.hair} />;
  }
}

export interface CharacterSpriteProps {
  preset: string;
  accent?: string;
  state: CharacterState;
  emotion: Emotion;
  facing: "left" | "right";
  seated: boolean;
  className?: string;
}

export const CharacterSprite = memo(function CharacterSprite({ preset, accent, state, emotion, facing, seated, className }: CharacterSpriteProps) {
  const base = spriteStyle(preset);
  const unknown = !(preset in SPRITE_STYLES);
  const s: SpriteStyle = accent && /^#[0-9a-f]{6}$/i.test(accent) ? { ...base, top: accent } : base;
  const scale = s.scale ?? 1;
  const up = seated ? 44 : 0; // сидя верх тела ниже

  return (
    <div className={cn(`g-st-${state}`, className)} style={{ width: 100, height: 250}}>
      <div
        className="g-facing"
        style={{
          width: 100,
          height: 250,
          transform: `scaleX(${facing === "left" ? -1 : 1})`,
        }}
      >
      <div
        className="g-proportions"
        style={{
          width: 100,
          height: 250,
          transform: `scale(${scale})`,
        }}
      >
        <svg
          viewBox="0 0 100 250"
          width={100}
          height={250}
          className="g-body overflow-visible"
          aria-hidden
        >
        {/* тень */}
        <ellipse cx={50} cy={247} rx={30} ry={5} fill="#000" opacity=".16" />
        {/* ноги */}
        {seated ? (
          <g fill={s.bottom}>
            <rect x={34} y={188} width={50} height={16} rx={7} />
            <rect x={72} y={192} width={13} height={52} rx={5} />
            <ellipse cx={82} cy={245} rx={11} ry={5} fill={s.shoes} />
          </g>
        ) : (
          <g>
            <g className="g-leg-b">
              <rect x={36} y={150} width={12} height={92} rx={5} fill={s.bottom} />
              <ellipse cx={45} cy={244} rx={10} ry={5} fill={s.shoes} />
            </g>
            <g className="g-leg-a">
              <rect x={52} y={150} width={12} height={92} rx={5} fill={shade(s.bottom, 1.08)} />
              <ellipse cx={61} cy={244} rx={10} ry={5} fill={s.shoes} />
            </g>
          </g>
        )}
        <g transform={`translate(0 ${up})`}>
          {s.extra === "hood" && <path d="M30,52 Q24,28 44,22 L40,66 Z" fill={shade(s.top, .8)} />}
          {/* дальняя рука */}
          <rect x={27} y={76} width={11} height={68} rx={5.5} fill={shade(s.top, .82)} />
          {/* корпус */}
          <path d="M30,82 Q30,68 42,67 L60,67 Q71,68 71,82 L73,160 L28,160 Z" fill={s.top} />
          {s.extra === "conductor" && (
            <g>
              <path d="M44,67 L51,84 L58,67 Z" fill="#e5e7eb" />
              <path d="M45,68 L51,80 L57,68 L54,90 L48,90 Z" fill="#dc2626" />
              <rect x={60} y={96} width={8} height={10} rx={1.5} fill="#fbbf24" />
              <rect x={28} y={120} width={45} height={4} fill="#dc2626" opacity=".8" />
            </g>
          )}
          {s.extra === "tie" && (
            <g>
              <path d="M44,67 L51,82 L58,67 Z" fill="#f3f4f6" />
              <path d="M49,70 L53,70 L55,104 L51,110 L47,104 Z" fill="#b91c1c" />
            </g>
          )}
          {/* шея и голова */}
          <rect x={45} y={54} width={11} height={16} rx={4} fill={s.skin} />
          <circle cx={52} cy={38} r={21} fill={s.skin} />
          <circle cx={42} cy={42} r={4} fill={shade(s.skin, .92)} />
          <Hair s={s} />
          {s.extra === "conductor" && (
            <g>
              <path d="M31,26 Q32,12 52,12 Q70,12 72,24 L72,28 L31,28 Z" fill="#1f3a68" />
              <rect x={31} y={24} width={41} height={5} fill="#dc2626" />
              <path d="M60,28 L82,30 L80,33 L58,32 Z" fill="#0f1e3a" />
              <circle cx={52} cy={20} r={3} fill="#fbbf24" />
            </g>
          )}
          {/* лицо */}
          <path d={BROWS[emotion]} stroke="#3b2a20" strokeWidth={2.6} strokeLinecap="round" fill="none" />
          <circle cx={61} cy={38} r={2.4} fill="#1f2937" />
          {s.extra === "glasses" && <rect x={55} y={33} width={13} height={10} rx={3} fill="none" stroke="#374151" strokeWidth={1.6} />}
          <path d="M70,40 Q74,44 70,46" stroke={shade(s.skin, 0.9)} strokeWidth={3} fill="none" />
          <Mouth emotion={emotion} />
          {/* ближняя рука */}
          <g className="g-arm-front">
            <rect x={56} y={76} width={12} height={68} rx={6} fill={shade(s.top, 1.06)} />
            <circle cx={62} cy={146} r={6} fill={s.skin} />
          </g>
        </g>
        {unknown && <text x={50} y={140} textAnchor="middle" fontSize={40} fill="#fff" opacity=".9">?</text>}
      </svg>
      </div>
      </div>
    </div>
  );
});

/** Заглушка на случай отсутствующего пресета — нейтральный силуэт того же размера */
export function AssetFallback({ label }: { label?: string }) {
  return (
    <div title={label ?? "Ассет не найден"}>
      <CharacterSprite preset="__fallback" state="idle" emotion="neutral" facing="right" seated={false} />
    </div>
  );
}

export { FALLBACK_SPRITE };
