"use client";

import { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

export interface SpotlightRequest {
  selector: string;
  fallback?: string;
  label: string;
  focus: boolean;
}

interface Marker {
  label: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  pointerX: number;
  pointerY: number;
}

export function AssistantSpotlight({ request }: { request: SpotlightRequest | null }) {
  const [marker, setMarker] = useState<Marker | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target: HTMLElement | null = null;
    let frame = 0;
    let timeout = 0;
    let observer: ResizeObserver | undefined;
    const hide = () => setMarker((previous) => previous?.visible ? { ...previous, visible: false } : previous);

    const updateMarker = () => {
      if (!request || !target?.isConnected || getComputedStyle(target).visibility === "hidden") return hide();
      const { left, right, top, bottom } = target.getBoundingClientRect();
      const clip = target.closest(".panel-content, .react-flow")?.getBoundingClientRect();
      const x = Math.max(2, clip?.left ?? 2, left - 3);
      const y = Math.max(2, clip?.top ?? 2, top - 3);
      const endX = Math.min(window.innerWidth - 2, clip?.right ?? right + 3, right + 3);
      const endY = Math.min(window.innerHeight - 2, clip?.bottom ?? bottom + 3, bottom + 3);
      if (endX <= x || endY <= y) return hide();

      const next: Marker = {
        label: request.label, visible: true, x, y, width: endX - x, height: endY - y,
        pointerX: Math.min(window.innerWidth - 33, endX - 9), pointerY: Math.min(window.innerHeight - 33, y + 3),
      };
      setMarker((previous) => previous?.visible && previous.label === next.label && previous.x === x && previous.y === y &&
        previous.width === next.width && previous.height === next.height ? previous : next);
    };

    frame = requestAnimationFrame(() => {
      if (!request) return hide();
      target = document.querySelector<HTMLElement>(request.selector) ??
        (request.fallback ? document.querySelector<HTMLElement>(request.fallback) : null);
      if (!target || getComputedStyle(target).visibility === "hidden") return hide();
      target.dataset.assistantHighlighted = "true";
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion ? "instant" : "smooth" });
      if (request.focus) target.focus({ preventScroll: true });
      updateMarker();
      window.addEventListener("scroll", updateMarker, true);
      window.addEventListener("resize", updateMarker);
      observer = new ResizeObserver(updateMarker);
      observer.observe(target);
      timeout = window.setTimeout(() => {
        delete target?.dataset.assistantHighlighted;
        window.removeEventListener("scroll", updateMarker, true);
        window.removeEventListener("resize", updateMarker);
        observer?.disconnect();
        hide();
      }, 8000);
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      window.removeEventListener("scroll", updateMarker, true);
      window.removeEventListener("resize", updateMarker);
      observer?.disconnect();
      delete target?.dataset.assistantHighlighted;
    };
  }, [request]);

  if (!marker) return null;
  return <div className="assistant-indication" data-visible={marker.visible} aria-hidden="true">
    <div className="assistant-target-frame" style={{
      transform: `translate3d(${marker.x}px, ${marker.y}px, 0)`, width: marker.width, height: marker.height,
    }} />
    <div className="assistant-spotlight" data-assistant-pointer={marker.visible ? marker.label : undefined}
      style={{ transform: `translate3d(${marker.pointerX}px, ${marker.pointerY}px, 0)` }}><MousePointer2 size={15} strokeWidth={1.75} /></div>
  </div>;
}
