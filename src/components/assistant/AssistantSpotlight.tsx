"use client";

import { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

export interface SpotlightRequest {
  selector: string;
  fallback?: string;
  label: string;
  focus: boolean;
}

export function AssistantSpotlight({ request }: { request: SpotlightRequest | null }) {
  const [marker, setMarker] = useState<{ request: SpotlightRequest; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!request) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target: HTMLElement | undefined;
    let frame = 0;
    let timeout = 0;
    const updateMarker = () => {
      if (!target?.isConnected || getComputedStyle(target).visibility === "hidden") {
        setMarker(null);
        return;
      }
      const { left, right, top, bottom } = target.getBoundingClientRect();
      const clip = target.closest(".panel-content")?.getBoundingClientRect();
      const minY = Math.max(0, clip?.top ?? 0);
      const maxY = Math.min(window.innerHeight, clip?.bottom ?? window.innerHeight);
      if (bottom <= minY || top >= maxY) {
        setMarker(null);
        return;
      }
      const x = right + 32 < window.innerWidth ? right - 4 : Math.max(left, right - 26);
      const y = Math.max(minY + 2, Math.min(top + 2, maxY - 30));
      setMarker((previous) => previous?.request === request && previous.x === x && previous.y === y
        ? previous : { request, x, y });
    };

    frame = requestAnimationFrame(() => {
      target = document.querySelector<HTMLElement>(request.selector) ??
        (request.fallback ? document.querySelector<HTMLElement>(request.fallback) ?? undefined : undefined);
      if (!target || getComputedStyle(target).visibility === "hidden") return;
      target.dataset.assistantHighlighted = "true";
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion ? "instant" : "smooth" });
      if (request.focus) target.focus({ preventScroll: true });
      updateMarker();
      window.addEventListener("scroll", updateMarker, true);
      window.addEventListener("resize", updateMarker);
      timeout = window.setTimeout(() => {
        delete target?.dataset.assistantHighlighted;
        window.removeEventListener("scroll", updateMarker, true);
        window.removeEventListener("resize", updateMarker);
        setMarker(null);
      }, 8000);
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      window.removeEventListener("scroll", updateMarker, true);
      window.removeEventListener("resize", updateMarker);
      delete target?.dataset.assistantHighlighted;
    };
  }, [request]);

  if (!marker || marker.request !== request) return null;
  return <div className="assistant-spotlight" data-assistant-pointer={marker.request.label} aria-hidden="true"
    style={{ left: marker.x, top: marker.y }}><MousePointer2 size={18} /></div>;
}
