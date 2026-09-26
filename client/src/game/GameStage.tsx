import { type ReactNode } from "react";
import type { Car } from "@shared/scenario";
import type { GameSceneModel, SceneCharacter } from "@shared/visual";
import { interiorPreset, LANDSCAPE_ASSETS } from "./assets";
import { WindowLandscape } from "./WindowLandscape";
import { TrainInterior, NearSeats, TrainForeground } from "./TrainInterior";
import { CharacterSprite } from "./CharacterSprite";
import { useElementSize } from "./motion";
import { WORLD_H, WIN_TOP, actorWorldPos, worldWidth } from "./world";
import { cn } from "@/lib/utils";

/**
 * Контейнер игровой сцены. Только отображает GameSceneModel — ничего не считает в очках.
 * Слои: пейзаж → интерьер → персонажи → ближние кресла → эффекты → оверлеи (children).
 * Камера: мир масштабируется по высоте сцены и сдвигается к говорящему; в диалоге — лёгкий наезд.
 */
export function GameStage({
  model,
  car,
  className,
  children,
  static: isStatic = false,
  reserveBottom = 0,
}: {
  model: GameSceneModel;
  car: Car;
  className?: string;
  children?: ReactNode;
  /** Предпросмотр в редакторе: без покачивания */
  static?: boolean;
  /** Сколько пикселей снизу закрыто диалогом (десктоп): камера поднимает сцену выше */
  reserveBottom?: number;
}) {
  const [ref, { w, h }] = useElementSize<HTMLDivElement>();
  const palette = interiorPreset(model.interior);
  const WW = worldWidth(car.length);
  const inDialogue = model.phase === "dialogue" || model.phase === "consequence";
  // общий план в наблюдении, наезд в диалоге
  const zoom = inDialogue ? 1.02 : 0.74;
  const he = Math.max(120, h - reserveBottom);
  const s = h > 0 ? (he / WORLD_H) * zoom : 1;

  const byId = new Map(model.characters.map((c) => [c.id, c]));
  const focus =
    (inDialogue && model.focusedActorId && byId.get(model.focusedActorId)) ||
    model.characters.find((c) => c.role === "conductor") ||
    null;
  const focusX = focus ? actorWorldPos(focus.x, focus.depth, car.length).wx : WW / 2;
  let camX = w / 2 - focusX * s;
  if (WW * s <= w) camX = (w - WW * s) / 2;
  else camX = Math.min(0, Math.max(w - WW * s, camX));
  const camY = he - WORLD_H * s; // пол у нижнего края видимой области; выше — продлённый потолок

  // полоса пейзажа в пикселях сцены (не зависит от горизонтальной камеры → естественный параллакс)
  const landTop = camY + (WIN_TOP - 30) * s;
  const landH = 260 * s;
  const sorted = [...model.characters].sort((a, b) => a.depth - b.depth);

  return (
    <div
      ref={ref}
      className={cn("relative overflow-clip rounded-xl border bg-slate-900 select-none", className)}
      data-testid="game-stage"
      data-phase={model.phase}
    >
      <WindowLandscape landscape={model.landscape} top={landTop} height={landH} />
      {h > 0 && (
        <div className="g-camera absolute left-0 top-0" style={{ width: WW, height: WORLD_H, transform: `translate3d(${camX}px, ${camY}px, 0) scale(${s})` }}>
          <div key={model.carId} className={cn("absolute inset-0 g-fade-in", !isStatic && "g-sway")}>
            <TrainInterior car={car} palette={palette} />
            {focus && inDialogue && <Spotlight c={focus} carLength={car.length} />}
            {sorted.map((c) => (
              <Actor key={c.id} c={c} carLength={car.length} speaking={c.id === model.speakerId} focused={c.id === model.focusedActorId && inDialogue} />
            ))}
            <NearSeats car={car} palette={palette} />
          </div>
        </div>
      )}
      <TrainForeground />
      {/* тон освещения по времени суток */}
      <div className="pointer-events-none absolute inset-0" style={{ background: LANDSCAPE_ASSETS[model.landscape].tint }} />
      {/* виньетка фокуса в диалоге */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ opacity: inDialogue ? 1 : 0, background: "radial-gradient(ellipse at 50% 55%, transparent 45%, rgba(0,0,0,.35))" }}
      />
      <div className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white" data-testid="text-scene-car">
        Вагон {model.carNumber} · {palette.label}
      </div>
      {children}
    </div>
  );
}

function Spotlight({ c, carLength }: { c: SceneCharacter; carLength: number }) {
  const { wx, baseline } = actorWorldPos(c.x, c.depth, carLength);
  return (
    <div
      className="g-spot absolute rounded-[50%]"
      style={{ left: wx - 110, top: baseline - 22, width: 220, height: 44, background: "radial-gradient(closest-side, rgba(255,236,170,.55), transparent)" }}
    />
  );
}

function Actor({ c, carLength, speaking, focused }: { c: SceneCharacter; carLength: number; speaking: boolean; focused: boolean }) {
  const { wx, baseline, scale } = actorWorldPos(c.x, c.depth, carLength);
  const mark = c.state === "positive" ? "positive" : c.state === "negative" ? "negative" : null;
  return (
    <div
      className="g-actor"
      style={{
        transform: `translate3d(${wx - 50}px, ${baseline - 250}px, 0) scale(${scale})`,
        opacity: c.dimmed ? 0.42 : 1,
        zIndex: Math.round(c.depth * 10),
      }}
      data-testid={`sprite-${c.id}`}
      data-state={c.state}
      data-emotion={c.emotion}
    >
      <CharacterSprite preset={c.preset} accent={c.accent} state={c.state} emotion={c.emotion} facing={c.facing} seated={c.seated} />
      {(speaking || focused) && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-0.5 text-[15px] font-semibold text-slate-900 shadow">
          {c.name}
        </div>
      )}
      {c.bubble && !speaking && !c.dimmed && (
        <div className="g-rise absolute left-1/2 -translate-x-1/2 -top-12 max-w-[220px] rounded-xl bg-white px-3 py-1.5 text-center text-[15px] leading-tight text-slate-900 shadow-md">
          {c.bubble}
        </div>
      )}
      {mark && (
        <div
          className={cn(
            "g-mark absolute left-1/2 -translate-x-1/2 -top-14 grid size-11 place-items-center rounded-full text-2xl font-bold text-white shadow-lg",
            mark === "positive" ? "bg-emerald-500" : "bg-red-500",
          )}
        >
          {mark === "positive" ? "✓" : "!"}
        </div>
      )}
    </div>
  );
}
