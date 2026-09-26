import React from "react";
import { TRAIN_NAVMESH_REGISTRY, Vector2D, CarNavMesh } from "./all_cars_navmesh";
import { CHARACTER_SPRITES, CharacterAction, SpriteFrame } from "./character_sprites";
import { Actor, BehaviorStep, CarType } from "./scenario";

interface RuntimeActorState {
  actor: Actor;
  currentStepIndex: number;
  // Вычисленные динамические параметры
  screenPos: Vector2D;
  action: CharacterAction;
  targetSeatId?: string;
  isTalking?: boolean;
}

/**
 * Чистая функция: определяет, где находится персонаж и какую позу он принимает
 * на основе текущего шага сценария (steps[i]).
 */
export function resolveActorPlacement(
  actor: Actor,
  stepIndex: number,
  mesh: CarNavMesh
): { screenPos: Vector2D; action: CharacterAction; zIndex: number; targetSeatId?: string } {
  const step: BehaviorStep | undefined = actor.steps[stepIndex];

  // 1. Поведение: "Сесть" (sit)
  if (step?.type === "sit" && actor.ticket?.seat) {
    const seat = mesh.seats[actor.ticket.seat];
    if (seat) {
      return {
        screenPos: seat.seatPos,
        action: "sit",
        // Глубина кресла + 1, чтобы персонаж сидел В кресле, но ПЕРЕД спинкой
        zIndex: seat.depth + 1,
        targetSeatId: actor.ticket.seat,
      };
    }
  }

  // 2. Поведение: "Идти к..." (goto)
  if (step?.type === "goto") {
    // 2.1 Идет к конкретному креслу (goto -> seat)
    if (step.target.kind === "seat") {
      const seat = mesh.seats[step.target.seat];
      if (seat) {
        return {
          screenPos: seat.approachPos, // идет в проход к этому ряду
          action: actor.role === "elderly" && actor.id.includes("wheelchair") ? "wheelchair" : "walk",
          zIndex: Math.round(seat.approachPos.y),
          targetSeatId: step.target.seat,
        };
      }
    }

    // 2.2 Идет в зону (детская комната, бар, тамбур)
    if (step.target.kind === "zone" && mesh.specialZones) {
      const zoneKey = step.target.zone === "bar" ? "barCounter" : "kidsPlayroom";
      const zone = mesh.specialZones[zoneKey] || Object.values(mesh.specialZones)[0];
      if (zone) {
        return {
          screenPos: zone.approachPos,
          action: "walk",
          zIndex: Math.round(zone.approachPos.y),
        };
      }
    }
  }

  // 3. Поведение: "Сказать" (say) или "Ждать" (wait)
  if (step?.type === "say" || step?.type === "wait") {
    // Если у актера уже есть билет и он сидит
    if (actor.ticket?.seat && mesh.seats[actor.ticket.seat]) {
      const seat = mesh.seats[actor.ticket.seat];
      return {
        screenPos: seat.seatPos,
        action: "sit",
        zIndex: seat.depth + 1,
        targetSeatId: actor.ticket.seat,
      };
    }
  }

  // 4. По умолчанию: стоит в тамбуре или в точке спавна
  return {
    screenPos: mesh.doorWest,
    action: "stand",
    zIndex: Math.round(mesh.doorWest.y),
  };
}

interface SceneProps {
  carType: CarType;
  actors: Actor[];
  actorStepIndices: Record<string, number>; // id актера -> индекс текущего шага в steps[]
  onSeatClick?: (seatId: string) => void;
}

export const TrainCarSceneView: React.FC<SceneProps> = ({
  carType,
  actors,
  actorStepIndices,
  onSeatClick,
}) => {
  const mesh = TRAIN_NAVMESH_REGISTRY[carType] || TRAIN_NAVMESH_REGISTRY.business;
  const bgImageSrc = `/cars/${carType}.jpg`; // Картинка вагона без плашек

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 1440,
        aspectRatio: "1440 / 1080",
        margin: "0 auto",
        overflow: "hidden",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
        backgroundColor: "#111827",
      }}
    >
      {/* 1. ФОН: Рендер вагона ВСМ */}
      <img
        src={bgImageSrc}
        alt={mesh.name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {/* 2. ИНТЕРАКТИВНЫЕ КРЕСЛА (Подсветка мест) */}
      {Object.values(mesh.seats).map((seat) => (
        <div
          key={seat.id}
          onClick={() => onSeatClick && onSeatClick(seat.id)}
          style={{
            position: "absolute",
            left: `${seat.seatPos.x}%`,
            top: `${seat.seatPos.y}%`,
            transform: "translate(-50%, -50%)",
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "1.5px dashed rgba(255,255,255,0.4)",
            cursor: onSeatClick ? "pointer" : "default",
            zIndex: seat.depth,
          }}
        />
      ))}

      {/* 3. НАЛОЖЕНИЕ СПРАЙТОВ ПЕРСОНАЖЕЙ */}
      {actors.map((actor) => {
        const stepIdx = actorStepIndices[actor.id] || 0;
        const currentStep = actor.steps[stepIdx];
        const { screenPos, action, zIndex, targetSeatId } = resolveActorPlacement(actor, stepIdx, mesh);

        // Ищем спрайт для роли и действия
        const roleConfig =
          actor.role === "elderly" && actor.id.includes("prm")
            ? CHARACTER_SPRITES.prm
            : CHARACTER_SPRITES[actor.role] || CHARACTER_SPRITES.passenger;

        const frame: SpriteFrame = roleConfig[action] || roleConfig.stand!;

        return (
          <div
            key={actor.id}
            style={{
              position: "absolute",
              left: `${screenPos.x}%`,
              top: `${screenPos.y}%`,
              // Точка привязки: смещаем так, чтобы ноги стояли на полу или таз попадал в кресло
              transform: `translate(-${frame.anchorX * 100}%, -${frame.anchorY * 100}%)`,
              // Плавный переход при изменении left/top (перемещение по проходу к креслу)
              transition: "left 1.2s cubic-bezier(0.2, 0.8, 0.4, 1), top 1.2s cubic-bezier(0.2, 0.8, 0.4, 1)",
              zIndex,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            {/* Реплика персонажа при шаге "say" */}
            {currentStep?.type === "say" && (
              <div
                style={{
                  background: "rgba(17, 24, 39, 0.9)",
                  color: "#fff",
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 6,
                  marginBottom: 6,
                  maxWidth: 160,
                  textAlign: "center",
                  border: "1px solid rgba(255,255,255,0.2)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}
              >
                💬 {currentStep.text}
              </div>
            )}

            {/* Сам PNG-спрайт персонажа */}
            <img
              src={frame.src}
              alt={actor.name}
              style={{
                width: frame.width * frame.scale,
                height: frame.height * frame.scale,
                objectFit: "contain",
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.45))",
                userSelect: "none",
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
