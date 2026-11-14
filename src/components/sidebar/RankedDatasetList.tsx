import { ArrowUpRight, FlaskConical, ListFilter, SearchX, X } from "lucide-react";
import type { rankRuns } from "../../core/si-engine/fsrs-ranker";
import type { EvidenceSearchResults } from "../../core/si-engine/semantic-search";
import { psiDataset } from "../../data/psi";
import { evidenceTopics, facilities } from "../../data/psi_vocabulary";
import { useAetherStore, type EvidenceSelection } from "../../store/useAetherStore";
import type { EvidenceTopicId, Investigation } from "../../types/psi";

const catalogRunCounts = new Map<string, number>();
for (const run of psiDataset.runs) {
  catalogRunCounts.set(run.investigationId, (catalogRunCounts.get(run.investigationId) ?? 0) + 1);
}

interface DatasetListProps {
  studies: Investigation[];
  rankedRuns: ReturnType<typeof rankRuns>;
  search: EvidenceSearchResults;
  current: EvidenceSelection | null;
  view: "study" | "run";
}

export function RankedDatasetList({ studies, rankedRuns, search, current, view }: DatasetListProps) {
  const facility = useAetherStore((state) => state.facility);
  const topic = useAetherStore((state) => state.topic);
  const studyFilter = useAetherStore((state) => state.studyFilter);
  const comparison = useAetherStore((state) => state.comparison);
  const setFacility = useAetherStore((state) => state.setFacility);
  const setTopic = useAetherStore((state) => state.setTopic);
  const setStudyFilter = useAetherStore((state) => state.setStudyFilter);
  const setResultsView = useAetherStore((state) => state.setResultsView);
  const clearFilters = useAetherStore((state) => state.clearFilters);
  const setQuery = useAetherStore((state) => state.setQuery);
  const inspect = useAetherStore((state) => state.inspect);
  const selectRun = useAetherStore((state) => state.selectRun);
  const hasFilters = facility !== "all" || topic !== null || studyFilter !== null;
  const count = view === "study" ? studies.length : rankedRuns.length;

  return (
    <section className="panel ranking" aria-labelledby="ranking-title">
      <div className="panel-heading">
        <h2 id="ranking-title"><ListFilter size={17} aria-hidden /> {search.active ? "Resultados" : "Catálogo de evidencia"}</h2>
        <span className="panel-meta" aria-live="polite">{count} {view === "study" ? (count === 1 ? "estudio" : "estudios") : (count === 1 ? "corrida" : "corridas")}</span>
      </div>
      <div className="ranking-controls">
        <div className="segments result-segments" role="group" aria-label="Tipo de evidencia">
          <button type="button" aria-pressed={view === "study"} onClick={() => setResultsView("study")}>Estudios <span>{studies.length}</span></button>
          <button type="button" aria-pressed={view === "run"} onClick={() => setResultsView("run")}>Corridas <span>{rankedRuns.length}</span></button>
        </div>
        <div className="filter-selects">
          <select aria-label="Filtrar por instalación" value={facility} onChange={(event) => {
            const id = event.target.value;
            if (id === "all" || Object.hasOwn(facilities, id)) setFacility(id as typeof facility);
          }}>
            <option value="all">Instalaciones</option>
            {Object.entries(facilities).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select aria-label="Filtrar por tema" value={topic ?? ""} onChange={(event) => setTopic((event.target.value || null) as EvidenceTopicId | null)}>
            <option value="">Temas</option>
            {Object.entries(evidenceTopics).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        {hasFilters && <div className="filter-status">
          {studyFilter ? <button type="button" onClick={() => setStudyFilter(null)}>{studyFilter} <X size={12} aria-hidden /></button> : null}
          <button type="button" onClick={clearFilters}>Quitar filtros</button>
        </div>}
      </div>
      {count === 0 ? (
        <div className="panel-content empty-evidence">
          <SearchX size={25} aria-hidden />
          <h3>{view === "run" && studies.length > 0 ? "Sin corridas con estos criterios" : "No encontramos coincidencias"}</h3>
          <p>{view === "run" && studies.length > 0 ? "Puedes consultar las fichas y fuentes de los estudios encontrados." : "Cambia la consulta o los filtros para ampliar los resultados."}</p>
          {view === "run" && studies.length > 0
            ? <button type="button" className="quiet-button" onClick={() => setResultsView("study")}>Ver estudios</button>
            : <button type="button" className="quiet-button" onClick={() => { clearFilters(); setQuery(""); }}>Ver todo el catálogo</button>}
        </div>
      ) : view === "study" ? (
        <ul className="panel-content ranked-list">
          {studies.map((study) => {
            const count = catalogRunCounts.get(study.id) ?? 0;
            const active = current?.kind === "study" && current.id === study.id;
            return (
              <li key={study.id}>
                <button className="study-card" type="button" aria-pressed={active} onClick={() => inspect({ kind: "study", id: study.id })}>
                  <span className="study-card-heading"><strong>{study.id}</strong><ArrowUpRight size={15} aria-hidden /></span>
                  <span className="study-name">{study.name}</span>
                  <span className="study-card-meta">
                    <span>{facilities[study.facility].label}</span>
                    <span className={count > 0 ? "data-available" : ""}>{count > 0 ? `${count} ${count === 1 ? "corrida" : "corridas"}` : "Ficha bibliográfica"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ol className="panel-content ranked-list">
          {rankedRuns.map(({ run, score, bounds }) => {
            const active = current?.kind === "run" && current.id === run.id;
            return (
              <li className="run-card" key={run.id} data-active={active}>
                <button type="button" className="run-top" aria-pressed={active} onClick={() => inspect({ kind: "run", id: run.id })}>
                  <span>
                    <span className="run-study">{run.investigationId}</span>
                    <strong>{run.label}</strong>
                  </span>
                  <span className="run-fsrs"><strong className="score mono">{score.toFixed(1)}</strong><small>FSRS</small></span>
                </button>
                <meter aria-label={`FSRS de ${run.label}`} min={0} max={100} value={score} />
                <div className="run-bottom">
                  <span><FlaskConical size={11} aria-hidden /> {run.fuel} · {run.atmosphere.oxygen_pct.toFixed(1)}% O₂</span>
                  {bounds.length > 0 && <span className="bound-tag" title="Cota experimental por variable">Cota</span>}
                  <div className="run-actions">
                    <button type="button" aria-label={`Comparar ${run.label} en A`} aria-pressed={comparison.a === run.id} onClick={() => selectRun("a", run.id)}>+ A</button>
                    <button type="button" aria-label={`Comparar ${run.label} en B`} aria-pressed={comparison.b === run.id} onClick={() => selectRun("b", run.id)}>+ B</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
