import { ArrowLeftRight, ExternalLink } from "lucide-react";
import { compareRuns } from "../../core/si-engine/git-diff";
import { investigationsById, psiDataset, runsById } from "../../data/psi";
import { useAetherStore } from "../../store/useAetherStore";

function formatValue(value: number | string | undefined, decimals = 0, unit = "") {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return `${value.toFixed(decimals)} ${unit}`;
}

export function ExperimentGitDiff() {
  const comparison = useAetherStore((state) => state.comparison);
  const mode = useAetherStore((state) => state.mode);
  const selectRun = useAetherStore((state) => state.selectRun);
  const a = runsById.get(comparison.a);
  const b = runsById.get(comparison.b);
  if (!a || !b) return null;
  const rows = compareRuns(a, b, investigationsById).filter(({ valueA, valueB }) => valueA !== undefined || valueB !== undefined);

  return (
    <section className="panel comparison" aria-labelledby="comparison-title">
      <div className="panel-heading">
        <h2 id="comparison-title"><ArrowLeftRight size={17} aria-hidden /> {mode === "engineer" ? "Git-Diff experimental" : "Comparar experimentos"}</h2>
      </div>
      <div className="panel-content comparison-content">
        <div className="comparison-selects">
          {(["a", "b"] as const).map((side) => (
            <label key={side}>
              <span className={`side side-${side}`}>{side.toUpperCase()}</span>
              <span className="sr-only">Corrida {side.toUpperCase()}</span>
              <select value={comparison[side]} onChange={(event) => selectRun(side, event.target.value)}>
                {psiDataset.runs.map((run) => <option value={run.id} key={run.id}>{run.label}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="comparison-scroll">
          <table>
            <thead><tr><th scope="col">Variable</th><th scope="col">Corrida A</th><th scope="col">Corrida B</th><th scope="col">{mode === "engineer" ? "Δ B − A" : "Diferencia"}</th></tr></thead>
            <tbody>
              {rows.map(({ field, valueA, valueB, status, delta, relativeDelta_pct }) => {
                const { decimals, unit } = "unit" in field ? field : { decimals: undefined, unit: undefined };
                const deltaUnit = "deltaUnit" in field ? field.deltaUnit : unit;
                return <tr key={field.id} data-status={status}>
                  <th scope="row">{field.label}</th>
                  <td>{formatValue(valueA, decimals, unit)}</td>
                  <td>{formatValue(valueB, decimals, unit)}</td>
                  <td>
                    {delta === undefined ? { equal: "Igual", missing: "Sin dato", changed: "Cambió" }[status] : (
                      <>{delta > 0 ? "+" : ""}{formatValue(delta, decimals, deltaUnit)}
                        {mode === "engineer" && relativeDelta_pct !== undefined && <small>{relativeDelta_pct > 0 ? "+" : ""}{relativeDelta_pct.toFixed(1)}% relativo</small>}
                      </>
                    )}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="comparison-sources">
          {[a, b].map((run, index) => (
            <a key={index} href={run.source.url} target="_blank" rel="noreferrer"><strong>Fuente {index === 0 ? "A" : "B"}</strong> {run.source.label} <ExternalLink size={11} aria-hidden /></a>
          ))}
        </div>
      </div>
    </section>
  );
}
