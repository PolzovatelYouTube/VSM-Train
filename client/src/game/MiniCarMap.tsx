import { useState } from "react";
import { ChevronDown, Map as MapIcon } from "lucide-react";
import type { Car } from "@shared/scenario";
import { CarMap, type MapActor } from "@/components/app/CarMap";
import { TrainStrip } from "@/components/app/widgets";
import { cn } from "@/lib/utils";

/** Вспомогательная карта: переключение вагонов и вид сверху. На мобильном свёрнута по умолчанию. */
export function MiniCarMap({
  cars,
  car,
  actors,
  badges,
  onSelect,
}: {
  cars: Car[];
  car: Car;
  actors: MapActor[];
  badges: Record<string, number>;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches);
  return (
    <div className="rounded-xl border bg-card" data-testid="mini-map">
      <button
        className="flex min-h-11 w-full items-center gap-2 px-3 text-sm font-semibold"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="button-toggle-map"
      >
        <MapIcon className="size-4 text-muted-foreground" /> Схема вагона {car.number}
        <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div className="px-3 pb-2">
        <TrainStrip cars={cars} selectedId={car.id} onSelect={onSelect} badges={badges} />
      </div>
      {open && (
        <div className="overflow-x-auto border-t p-2">
          <CarMap car={car} actors={actors} compact />
        </div>
      )}
    </div>
  );
}
