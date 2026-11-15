import { useCallback, useEffect, useRef, useState } from "react";

const fadeDistance_px = 168;

type ScrollPosition = { top_px: number; limit_px: number };

export function useComparisonScroll() {
  const layoutRef = useRef<HTMLElement>(null);
  const frame = useRef(0);
  const positions = useRef(new WeakMap<HTMLElement, ScrollPosition>());
  const distance_px = useRef(0);
  const travel_px = useRef(0);
  const [folded, setFolded] = useState(false);
  const isFolded = useRef(false);

  const changeFolded = useCallback((next: boolean) => {
    if (next === isFolded.current) return;
    isFolded.current = next;
    setFolded(next);
  }, []);

  const reset = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    distance_px.current = 0;
    travel_px.current = 0;
    const layout = layoutRef.current;
    if (layout) {
      layout.removeAttribute("data-scroll-linked");
      layout.style.setProperty("--comparison-scroll-progress", "0");
    }
    changeFolded(false);
  }, [changeFolded]);

  const follow = useCallback((scroller: HTMLElement) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const layout = layoutRef.current;
      if (!layout || !scroller.isConnected) return;

      const top_px = Math.max(0, scroller.scrollTop);
      const limit_px = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const previous = positions.current.get(scroller);
      positions.current.set(scroller, { top_px, limit_px });
      const delta_px = top_px - (previous?.top_px ?? 0);
      if (delta_px === 0) return;

      // Al ganar espacio, el navegador puede ajustar el scroll al nuevo fondo sin que el usuario haya subido.
      const clampedByResize = previous && limit_px < previous.limit_px &&
        previous.top_px > limit_px && top_px >= limit_px - 1;
      if (clampedByResize) return;

      if (distance_px.current === 0 && delta_px > 0) {
        travel_px.current = Math.min(fadeDistance_px, limit_px);
        const graph = layout.querySelector<HTMLElement>(".nexus");
        const heading = graph?.querySelector<HTMLElement>(".graph-heading");
        const expandable_px = graph && heading ? graph.clientHeight - heading.offsetHeight : 0;
        // Solo cede el espacio que permita completar el desplazamiento real de la tabla.
        const safeSpace_px = Math.max(0, limit_px - travel_px.current - 4);
        const spaceFactor = expandable_px > 0 ? Math.min(1, safeSpace_px / expandable_px) : 0;
        layout.style.setProperty("--comparison-scroll-space-limit", spaceFactor.toFixed(4));
      }
      if (travel_px.current <= 0) return;
      distance_px.current = Math.min(travel_px.current, Math.max(0, distance_px.current + delta_px));
      const progress = distance_px.current / travel_px.current;
      if (delta_px < 0 && top_px <= 0.5 && progress > 0) {
        reset();
        return;
      }

      layout.setAttribute("data-scroll-linked", "");
      layout.style.setProperty("--comparison-scroll-progress", progress.toFixed(4));
      changeFolded(progress >= 1);
    });
  }, [reset, changeFolded]);

  const restoreAtTop = useCallback((scroller: HTMLElement, scrollingUp: boolean) => {
    if (scrollingUp && scroller.scrollTop <= 0.5 && distance_px.current > 0) reset();
  }, [reset]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return { layoutRef, folded, follow, reset, restoreAtTop };
}
