import { ListOrdered, Plus } from "lucide-react";
import { rankRuns } from "../../core/si-engine/fsrs-ranker";
import { investigationsById, psiDataset } from "../../data/psi";
import { useAetherStore } from "../../store/useAetherStore";

const filters = [{ id: "all", label: "Todas" }, { id: "MSG", label: "MSG" }, { id: "CYGNUS", label: "Cygnus" }, { id: "CIR", label: "CIR" }] as const;

export function RankedDatasetList() {
  const profile = useAetherStore((state) => state.profile);
  const atmosphere = useAetherStore((state) => state.atmosphere);
  const facility = useAetherStore((state) => state.facility);
  const investigationId = useAetherStore((state) => state.investigationId);
  const comparison = useAetherStore((state) => state.comparison);
  const setFacility = useAetherStore((state) => state.setFacility);
  const selectRun = useAetherStore((state) => state.selectRun);
  const ranked = rankRuns(psiDataset.runs, investigationsById, profile, atmosphere);
  const visible = ranked.filter(({ run }) => (
    (facility === "all" || investigationsById.get(run.investigationId)?.facility === facility) &&
    (investigationId === null || run.investigationId === investigationId)
  ));

  return (
    <section className="panel ranking" aria-labelledby="ranking-title">
      <div className="panel-heading">
        <h2 id="ranking-title"><ListOrdered size={17} aria-hidden /> Ranking FSRS</h2>
        <span className="panel-meta mono">{visible.length} corridas</span>
      </div>
      <div className="ranking-controls">
        <div className="segments" role="group" aria-label="Filtrar por instalación">
          {filters.map(({ id, label }) => <button type="button" key={id} aria-pressed={facility === id} onClick={() => setFacility(id)}>{label}</button>)}
        </div>
        <span title="Fire Safety Relevance Score">{investigationId ?? "0–100 pts"}</span>
      </div>
      <ol className="panel-content ranked-list">
        {visible.length === 0 && <li className="empty-state">Esta selección no tiene corridas por prueba en el catálogo.</li>}
        {visible.map(({ run, score, bounds }) => (
          <li className="run-card" key={run.id}>
            <div className="run-top">
              <div>
                <span className="run-study mono">{run.investigationId}</span>
                <h3>{run.label}</h3>
              </div>
              <strong className="score mono">{score.toFixed(1)}</strong>
            </div>
            <meter aria-label={`Puntuación de ${run.label}`} min={0} max={100} value={score} />
            <div className="run-bottom">
              <span>{run.fuel} · {run.atmosphere.oxygen_pct.toFixed(1)}% O₂</span>
              {run.nominal && <span className="nominal-tag" title={run.nominal.basis}>Nominal</span>}
              {bounds.length > 0 && <span className="bound-tag" title={bounds.some(({ outside }) => outside) ? "Cota del catálogo con objetivo fuera de rango" : "Cota cercana al objetivo"}>Cota</span>}
              <div className="run-actions">
                <button type="button" aria-label={`Comparar ${run.label} en A`} aria-pressed={comparison.a === run.id} onClick={() => selectRun("a", run.id)}><Plus size={11} aria-hidden /> A</button>
                <button type="button" aria-label={`Comparar ${run.label} en B`} aria-pressed={comparison.b === run.id} onClick={() => selectRun("b", run.id)}><Plus size={11} aria-hidden /> B</button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
