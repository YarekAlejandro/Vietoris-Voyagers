"use client";

import { useLayoutEffect, useState } from "react";

interface AnnotationRequest {
  selectors: readonly string[];
  active: string;
}

interface Trace {
  selector: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function NarratedAnnotations({ request }: { request: AnnotationRequest | null }) {
  const [traces, setTraces] = useState<Trace[]>([]);
  useLayoutEffect(() => {
    if (!request) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const resize = new ResizeObserver(schedule);
    function measure() {
      const next = request?.selectors.flatMap((selector) => {
        const target = document.querySelector<HTMLElement>(selector);
        if (!target || getComputedStyle(target).visibility === "hidden") return [];
        const bounds = target.getBoundingClientRect();
        const clip = target.closest(".comparison-scroll")?.getBoundingClientRect();
        const x = Math.max(2, clip?.left ?? 2, bounds.left - 2);
        const y = Math.max(2, clip?.top ?? 2, bounds.top - 2);
        const right = Math.min(innerWidth - 2, clip?.right ?? innerWidth, bounds.right + 2);
        const bottom = Math.min(innerHeight - 2, clip?.bottom ?? innerHeight, bounds.bottom + 2);
        return right - x > 5 && bottom - y > 5 ? [{ selector, x, y, width: right - x, height: bottom - y }] : [];
      }) ?? [];
      setTraces(next);
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const active = document.querySelector(request.active);
    active?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "instant" : "smooth" });
    for (const selector of request.selectors) {
      const target = document.querySelector(selector);
      if (target) resize.observe(target);
    }
    schedule();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [request]);

  if (!request) return null;
  return <svg className="assistant-trace-layer" aria-hidden="true">
    {traces.filter(({ selector }) => request.selectors.includes(selector)).map(({ selector, x, y, width, height }) =>
      <rect key={selector} data-trace={selector} data-active={selector === request.active}
        x={x + 1} y={y + 1} width={width - 2} height={height - 2} rx={7} pathLength={1} />)}
  </svg>;
}
