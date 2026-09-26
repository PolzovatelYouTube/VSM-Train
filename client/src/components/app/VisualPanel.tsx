import { lazy, Suspense } from "react";
import { Eye } from "lucide-react";
import { LANDSCAPES, LANDSCAPE_LABEL, ACTOR_ROLE_LABEL, type ScenarioData } from "@shared/scenario";
import { SPRITE_PRESETS, SPRITE_PRESET_LABEL, defaultPreset, resolveLandscape } from "@shared/visual";
import { INTERIOR_PRESETS } from "@/game/assets";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ScenePreview = lazy(() => import("@/game/ScenePreview"));

const selectCls = "h-9 w-full rounded-md border bg-background px-2 text-sm";

/**
 * Блок «Визуальная сцена» редактора. Пишет только необязательные поля data.visual и actor.visual;
 * пустое значение удаляет поле — сценарий остаётся совместимым со старым форматом.
 */
export function VisualPanel({
  data,
  mutate,
  carId,
  onPreview,
  previewBusy,
}: {
  data: ScenarioData;
  mutate: (fn: (d: ScenarioData) => void) => void;
  carId: string;
  onPreview: () => void;
  previewBusy?: boolean;
}) {
  const landscape = resolveLandscape(data);
  const setVisual = (key: "landscape" | "interior", value: string | undefined) =>
    mutate((d) => {
      const v = { ...(d.visual ?? {}) } as Record<string, string | undefined>;
      if (value) v[key] = value;
      else delete v[key];
      d.visual = Object.keys(v).length ? (v as ScenarioData["visual"]) : undefined;
    });

  return (
    <div className="space-y-5" data-testid="panel-visual">
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <ScenePreview data={data} carId={carId} />
      </Suspense>
      <Button className="min-h-11 w-full" onClick={onPreview} disabled={previewBusy} data-testid="button-preview-game">
        <Eye className="mr-1.5 size-4" /> Предпросмотр игры
      </Button>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Пейзаж за окнами</Label>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Пейзаж">
          {LANDSCAPES.map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={landscape === l}
              onClick={() => setVisual("landscape", l === "day" ? undefined : l)}
              className={cn("min-h-11 rounded-md border text-sm", landscape === l ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
              data-testid={`button-landscape-${l}`}
            >
              {LANDSCAPE_LABEL[l]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">По умолчанию — день.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sel-interior" className="text-xs text-muted-foreground">Интерьер салона</Label>
        <select
          id="sel-interior"
          className={selectCls}
          value={data.visual?.interior ?? ""}
          onChange={(e) => setVisual("interior", e.target.value || undefined)}
          data-testid="select-interior"
        >
          <option value="">Авто — по классу вагона</option>
          {Object.entries(INTERIOR_PRESETS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Внешность персонажей</Label>
        {data.actors.map((a) => (
          <div key={a.id} className="grid grid-cols-[1fr_auto] items-center gap-2" data-testid={`row-visual-${a.id}`}>
            <div className="min-w-0">
              <div className="truncate text-sm">{a.name}</div>
              <div className="text-xs text-muted-foreground">{ACTOR_ROLE_LABEL[a.role]}</div>
            </div>
            <input
              type="color"
              aria-label={`Цвет одежды: ${a.name}`}
              className="h-9 w-11 cursor-pointer rounded border bg-background"
              value={a.visual?.accent ?? "#888888"}
              onChange={(e) =>
                mutate((d) => {
                  const x = d.actors.find((y) => y.id === a.id)!;
                  x.visual = { ...(x.visual ?? {}), accent: e.target.value };
                })
              }
            />
            <select
              className={cn(selectCls, "col-span-2")}
              aria-label={`Пресет: ${a.name}`}
              value={a.visual?.preset ?? ""}
              onChange={(e) =>
                mutate((d) => {
                  const x = d.actors.find((y) => y.id === a.id)!;
                  const v = { ...(x.visual ?? {}), preset: e.target.value || undefined };
                  if (!v.preset) delete v.preset;
                  x.visual = Object.keys(v).length ? v : undefined;
                })
              }
            >
              <option value="">Авто — {SPRITE_PRESET_LABEL[defaultPreset(a.role, a.id)]}</option>
              {SPRITE_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {SPRITE_PRESET_LABEL[p]}
                </option>
              ))}
            </select>
            {a.visual?.accent && (
              <button
                className="col-span-2 justify-self-start text-xs text-muted-foreground underline"
                onClick={() =>
                  mutate((d) => {
                    const x = d.actors.find((y) => y.id === a.id)!;
                    const v = { ...(x.visual ?? {}) };
                    delete v.accent;
                    x.visual = Object.keys(v).length ? v : undefined;
                  })
                }
              >
                сбросить цвет
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
