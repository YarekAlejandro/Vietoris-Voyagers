import { ScanLine } from "lucide-react";
import type { ScenarioCoverage } from "../../core/si-engine/scenario-coverage";

function gap(value: number | null, unit: string) {
  if (value === null) return "—";
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} ${unit}`;
}

export function ScenarioCoverageCard({ coverage }: { coverage: ScenarioCoverage }) {
  const { status, withinTolerance, closest, scenarioGravity } = coverage;
  return <section id="assistant-coverage" tabIndex={-1} className="coverage-card" aria-label="Cobertura del escenario" aria-live="polite">
    <div className="coverage-card-heading">
      <h4><ScanLine size={14} aria-hidden /> Cobertura del escenario</h4>
      <span className="coverage-state" data-state={status}>
        {status === "ninguna" ? "Sin evidencia directa" : status === "parcial" ? "Parcial" : "Directa"}
      </span>
    </div>
    <p>{withinTolerance} {withinTolerance === 1 ? "corrida" : "corridas"} dentro de las tolerancias heurísticas.</p>
    {closest && <>
      <div className="coverage-nearest"><span>Corrida más cercana</span><strong>{closest.label}</strong></div>
      <p>Brecha entre la corrida y el escenario</p>
      <dl className="coverage-readouts">
        <div><dt>O₂</dt><dd>{gap(closest.gap.oxygen_pp, "pp")}</dd></div>
        <div><dt>Presión</dt><dd>{gap(closest.gap.pressure_kpa, "kPa")}</dd></div>
        <div><dt>Flujo</dt><dd>{gap(closest.gap.flow_cm_s, "cm/s")}</dd></div>
        <div><dt>Gravedad {closest.gap.gravity === scenarioGravity && "· misma clase"}</dt><dd>{closest.gap.gravity === scenarioGravity ? scenarioGravity
          : `${closest.gap.gravity ?? "Sin dato"} / ${scenarioGravity}`}</dd></div>
      </dl>
      <a href={closest.source.url} target="_blank" rel="noreferrer">{closest.source.label}</a>
    </>}
  </section>;
}
