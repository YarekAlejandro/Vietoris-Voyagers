import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { nextSplitHeight, splitPercent } from "../../lib/ui/split";

// Divisor horizontal arrastrable entre dos paneles apilados.
// El padre mide los paneles (`measure`) y aplica el alto del superior (`onResize`).

interface SplitHandleProps {
  label: string;
  /** Alto actual del panel superior y suma de ambos paneles, o null si no se pueden medir. */
  measure: () => { top: number; total: number } | null;
  onResize: (top: number) => void;
  /** Vuelve al reparto por defecto (mitades). */
  onReset: () => void;
  minTop: number;
  minBottom: number;
  keyboardStep?: number;
}

export function SplitHandle({ label, measure, onResize, onReset, minTop, minBottom, keyboardStep = 24 }: SplitHandleProps) {
  const drag = useRef<{ startY: number; top: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [percent, setPercent] = useState(50);

  function apply(top: number, total: number) {
    onResize(top);
    setPercent(splitPercent(top, total));
  }

  function reset() {
    onReset();
    setPercent(50);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    delete document.body.dataset.resizing;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const size = measure();
    if (!size) return;
    event.preventDefault();
    drag.current = { startY: event.clientY, ...size };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    // Mantiene el cursor de redimensionar aunque el puntero salga del divisor.
    document.body.dataset.resizing = "row";
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current) return;
    apply(nextSplitHeight(current.top, event.clientY - current.startY, current.total, minTop, minBottom), current.total);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      reset();
      return;
    }
    const size = measure();
    if (!size) return;
    const { top, total } = size;
    const moves: Record<string, number> = {
      ArrowUp: -keyboardStep,
      ArrowDown: keyboardStep,
      Home: -total,
      End: total,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    apply(nextSplitHeight(top, moves[event.key], total, minTop, minBottom), total);
  }

  return (
    <div
      className="split-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      title="Arrastra para ajustar · doble clic para restablecer"
      tabIndex={0}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
    >
      <span className="split-handle-grip" aria-hidden />
    </div>
  );
}
