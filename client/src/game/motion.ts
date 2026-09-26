import { useEffect, useState } from "react";

/** prefers-reduced-motion: в этом режиме анимации заменяются короткими crossfade */
export function useReducedMotion() {
  const q = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Размер элемента через ResizeObserver */
export function useElementSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size] as const;
}

/** matchMedia как состояние */
export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mm = window.matchMedia?.(q);
    if (!mm) return;
    const on = () => setM(mm.matches);
    on();
    mm.addEventListener("change", on);
    return () => mm.removeEventListener("change", on);
  }, [q]);
  return m;
}

/** Условие раскладки, при которой диалог лежит поверх нижней части сцены (см. .game-dialogue в index.css) */
export const OVERLAY_DIALOGUE_QUERY = "(min-width: 1024px) and (min-height: 541px)";
