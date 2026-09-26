import { useState } from "react";
import { ChevronDown, Map as MapIcon } from "lucide-react";
import type { Car } from "@shared/scenario";
import { CarMap, type MapActor } from "@/components/app/CarMap";
import { cn } from "@/lib/utils";

/** Вспомогательная карта: переключение вагонов и вид сверху. На мобильном свёрнута по умолчанию. */
export function MiniCarMap({
  cars,
  car,
  actors,
}: {
  cars: Car[];
  car: Car;
  actors: MapActor[];
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
      {open && (
        <div className="overflow-x-auto border-t p-2">
          <CarMap car={car} actors={actors} compact />
        </div>
      )}
    </div>
  );
}
