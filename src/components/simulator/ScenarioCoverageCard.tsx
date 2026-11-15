import { ScanLine } from "lucide-react";
import type { ScenarioCoverage } from "../../core/si-engine/scenario-coverage";

function gap(value: number | null, unit: string) {
  if (value === null) return "—";
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} ${unit}`;
}

export function ScenarioCoverageCard({ coverage }: { coverage: ScenarioCoverage }) {
  const { status, withinTolerance, closest, scenarioGravity } = coverage;
  return <section className="search-reason" aria-label="Cobertura del escenario" aria-live="polite">
    <h4><ScanLine size={13} aria-hidden className="inline" /> Cobertura del escenario</h4>
    <p>{status === "ninguna" ? "Sin evidencia directa para este escenario"
      : status === "parcial" ? "Cobertura parcial. Sin evidencia directa para este escenario" : "Cobertura directa"}
      {" · "}{withinTolerance} dentro de las tolerancias heurísticas.</p>
    {closest && <>
      <p>Corrida más cercana · {closest.label}</p>
      <p>Brecha corrida − escenario · O₂ {gap(closest.gap.oxygen_pp, "pp")} · Presión {gap(closest.gap.pressure_kpa, "kPa")}
        {" · "}Flujo {gap(closest.gap.flow_cm_s, "cm/s")} · Gravedad {closest.gap.gravity ?? "—"} / {scenarioGravity}</p>
      <a href={closest.source.url} target="_blank" rel="noreferrer">{closest.source.label}</a>
    </>}
  </section>;
}
