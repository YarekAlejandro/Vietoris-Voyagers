import { ArrowDownRight, ArrowUpRight, Circle, CircleDashed, Diamond, ExternalLink, Minus, X } from "lucide-react";
import type { Atmosphere, ExperimentalRun } from "../../types/psi";
import type { compareRuns, comparisonAvailability } from "../../core/si-engine/git-diff";

export type ComparisonVisualRow = ReturnType<typeof compareRuns>[number] & {
  availabilityA: ReturnType<typeof comparisonAvailability>;
  availabilityB: ReturnType<typeof comparisonAvailability>;
};

interface VisualProps {
  rows: readonly ComparisonVisualRow[];
  onInspect: (fieldId: ComparisonVisualRow["field"]["id"]) => void;
  a: ExperimentalRun;
  b: ExperimentalRun;
}

const cellStates = {
  documented: { label: "Documentado", Icon: Circle },
  estimated: { label: "Estimación publicada", Icon: Diamond },
  nominal: { label: "Nominal", Icon: CircleDashed },
  "psi-profile": { label: "Perfil PSI", Icon: CircleDashed },
  missing: { label: "Sin dato", Icon: X },
  "not-applicable": { label: "No aplica", Icon: Minus },
};

function cellState(row: ComparisonVisualRow, side: "A" | "B", run: ExperimentalRun): keyof typeof cellStates {
  const availability = side === "A" ? row.availabilityA : row.availabilityB;
  if (availability !== "present") return availability;
  if (run.psiProfile) return "psi-profile";
  if (side === "A" ? row.nominalA : row.nominalB) return "nominal";
  return row.field.id === "cabin_heat_added_kj" ? "estimated" : "documented";
}

function axisTarget(field: string, scenario: Atmosphere): number | undefined {
  switch (field) {
    case "gravity_g": return scenario.gravity_g;
    case "oxygen_pct": return scenario.oxygen_pct;
    case "pressure_psia": return scenario.pressure_psia;
    case "flow_velocity_cm_s": return scenario.flow_velocity_cm_s;
    default: return undefined;
  }
}

function formatQuantity(value: number, unit: string, decimals: number) {
  return `${value.toFixed(decimals)} ${unit}`;
}

export function ComparisonPlots({ rows, onInspect, scenario, a, b }: VisualProps & { scenario: Atmosphere }) {
  const quantitativeRows = rows.filter(({ field, valueA, valueB, nominalA, nominalB }) =>
    "unit" in field && ((!nominalA && typeof valueA === "number") || (!nominalB && typeof valueB === "number")));
  if (!quantitativeRows.length) return <p className="comparison-visual-empty">
    No hay valores numéricos documentados para graficar en esta pareja. La matriz muestra el estado de cada dato.
  </p>;

  return <section className="comparison-visuals" aria-label="Gráficos de valores documentados A/B">
    <div className="comparison-visual-intro">
      <p>Cada variable tiene su propia escala. El marcador del escenario aparece en las variables de atmósfera.</p>
      <div className="plot-legend">
        <span><i className="plot-symbol plot-symbol-a" aria-hidden /> Corrida A</span>
        <span><i className="plot-symbol plot-symbol-b" aria-hidden /> Corrida B</span>
        <span><i className="plot-symbol plot-symbol-scenario" aria-hidden /> Escenario</span>
      </div>
    </div>
    <ul className="metric-plots">
      {quantitativeRows.map((row) => {
        const { field, valueA, valueB, nominalA, nominalB, delta } = row;
        if (!("unit" in field)) return null;
        const { unit, decimals } = field;
        const valueOfA = typeof valueA === "number" && !nominalA ? valueA : undefined;
        const valueOfB = typeof valueB === "number" && !nominalB ? valueB : undefined;
        const target = axisTarget(field.id, scenario);
        const values = [0, ...[valueOfA, valueOfB, target].filter((value): value is number => value !== undefined)];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const position = (value: number) => max === min ? 0 : 100 * (value - min) / (max - min);
        const deltaUnit = "deltaUnit" in field ? field.deltaUnit : unit;
        const equal = valueOfA !== undefined && valueOfA === valueOfB;
        const estimated = field.id === "cabin_heat_added_kj";
        return <li className="metric-plot" key={field.id}>
          <div className="metric-plot-heading">
            <button type="button" className="metric-row-link" onClick={() => onInspect(field.id)} title={`Ver ${field.label} en la tabla`}>
              {field.label}<ArrowUpRight size={13} aria-hidden />
            </button>
            {delta !== undefined ? <span className="metric-delta">
              <ArrowDownRight size={13} aria-hidden style={{ transform: delta > 0 ? "rotate(-90deg)" : undefined }} />
              <span>Δ {delta > 0 ? "+" : ""}{formatQuantity(delta, deltaUnit, decimals)}</span>
            </span> : equal ? <span className="metric-equal">Igual</span> : <span className="metric-equal">No comparable</span>}
          </div>
          <div className="metric-track" aria-hidden="true">
            {valueOfA !== undefined && valueOfB !== undefined && !equal &&
              <i className="metric-connector" style={{ left: `${position(Math.min(valueOfA, valueOfB))}%`, width: `${Math.abs(position(valueOfB) - position(valueOfA))}%` }} />}
            {target !== undefined && <i className="plot-symbol plot-symbol-scenario" style={{ left: `${position(target)}%` }} />}
            {valueOfA !== undefined && <i className="plot-symbol plot-symbol-a" style={{ left: `${position(valueOfA)}%` }} />}
            {valueOfB !== undefined && <i className="plot-symbol plot-symbol-b" style={{ left: `${position(valueOfB)}%` }} />}
          </div>
          <div className="metric-scale" aria-hidden="true">
            <span>{formatQuantity(min, unit, decimals)}</span>
            {max !== min && <span>{formatQuantity(max, unit, decimals)}</span>}
          </div>
          <div className="metric-values">
            {([{ side: "A", run: a, value: valueOfA }, { side: "B", run: b, value: valueOfB }] as const).map(({ side, run, value }) => (
              <span key={side} data-side={side}>
                <strong>{side}</strong> {value === undefined ? cellStates[cellState(row, side, run)].label :
                  <a href={run.source.url} target="_blank" rel="noreferrer" title={run.source.label}
                    aria-label={`${side}, ${formatQuantity(value, unit, decimals)}. Fuente: ${run.source.label}`}>
                    {formatQuantity(value, unit, decimals)} <ExternalLink size={10} aria-hidden />
                  </a>}
              </span>
            ))}
            {target !== undefined && <span>Escenario <strong>{formatQuantity(target, unit, decimals)}</strong></span>}
            {estimated && <span>Estimación publicada</span>}
          </div>
        </li>;
      })}
    </ul>
  </section>;
}

export function ComparisonMatrix({ rows, onInspect, a, b }: VisualProps) {
  const sides = [{ key: "A", run: a }, { key: "B", run: b }] as const;
  const evidenceSummary = (side: "A" | "B", run: ExperimentalRun) => {
    const cells = rows.map((row) => cellState(row, side, run));
    const count = cells.filter((state) => state === "documented" || state === "estimated").length;
    return `${count} de ${cells.filter((state) => state !== "not-applicable").length} con dato publicado`;
  };

  return <div className="comparison-visuals">
    <p className="matrix-help">La cobertura cuenta los datos documentados o estimados en la fuente. Selecciona una variable para consultar su fila.</p>
    <table className="comparison-matrix">
      <caption className="sr-only">Disponibilidad de evidencia en las corridas A y B</caption>
      <thead><tr>
        <th scope="col">Variable</th>
        {sides.map(({ key, run }) => <th scope="col" key={key}>
          <span className={`side side-${key.toLowerCase()}`}>{key}</span><small>{evidenceSummary(key, run)}</small>
        </th>)}
      </tr></thead>
      {([["Condiciones del ensayo", false], ["Resultados del ensayo", true]] as const).map(([group, outcome]) => (
        <tbody key={group}>
          <tr className="matrix-group"><th scope="rowgroup" colSpan={3}>{group}</th></tr>
          {rows.filter((row) => row.outcome === outcome).map((row) => (
            <tr key={row.field.id}>
              <th scope="row"><button className="metric-row-link" type="button" onClick={() => onInspect(row.field.id)}>
                {row.field.label} <ArrowUpRight size={13} aria-hidden />
              </button></th>
              {sides.map(({ key, run }) => {
                const state = cellState(row, key, run);
                const { Icon, label } = cellStates[state];
                return <td key={key}><span className="matrix-cell" data-state={state}>
                  <Icon size={13} aria-hidden /> {label}
                </span></td>;
              })}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  </div>;
}
