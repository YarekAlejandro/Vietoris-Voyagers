import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef } from "react";

export interface PanelSizeProps {
  expanded: boolean;
  onToggleSize: () => void;
}

export function PanelSizeButton({ expanded, onToggleSize, name }: PanelSizeProps & { name: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const label = `${expanded ? "Restaurar" : "Ampliar"} ${name}`;
  const Icon = expanded ? Minimize2 : Maximize2;

  useEffect(() => {
    if (!expanded) return;
    function restore(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onToggleSize();
      button.current?.focus();
    }
    window.addEventListener("keydown", restore);
    return () => window.removeEventListener("keydown", restore);
  }, [expanded, onToggleSize]);

  return <button ref={button} type="button" className="icon-button panel-size-button"
    aria-label={label} title={label} onClick={onToggleSize}><Icon size={16} aria-hidden /></button>;
}
