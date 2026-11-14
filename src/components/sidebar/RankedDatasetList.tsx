import { ExternalLink, FlaskConical, ListFilter, SearchX, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { FSRS, rankRuns } from "../../core/si-engine/fsrs-ranker";
import { buildRankPayload, interpretationKey, type InterpretRequest } from "../../core/si-engine/interpret";
import { InterpretationCard } from "../nexus/InterpretationCard";
import type { EvidenceSearchResults } from "../../core/si-engine/semantic-search";
import { investigationsById, psiDataset } from "../../data/psi";
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
  studyScores: ReadonlyMap<string, FSRS>;
  search: EvidenceSearchResults;
  current: EvidenceSelection | null;
  view: "study" | "run";
}

function ScoreBadge({ result }: { result: FSRS }) {
  const level = result.score >= 80 ? "high" : result.score >= 60 ? "mid" : "low";
  return <span className="fsrs-badge mono" data-level={level}>FSRS {result.score.toFixed(1)}</span>;
}

function ScoreDetails({ result, label }: { result: FSRS; label: string }) {
  return <div className="fsrs-details">
    <meter aria-label={`FSRS de ${label}`} min={0} max={100} value={result.score}
      data-level={result.score >= 80 ? "high" : result.score >= 60 ? "mid" : "low"} />
    <span title={`Componentes del FSRS · bonificación por escenario: ${result.bonus_pts} pts`}>
      Atm {Math.round(result.atmosphere_pct)}% · Flujo {Math.round(result.flow_pct)}% · Grav/Puente {Math.round(result.gravityBridge_pct)}%
    </span>
  </div>;
}

export function RankedDatasetList({ studies, rankedRuns, studyScores, search, current, view }: DatasetListProps) {
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
  const profile = useAetherStore((state) => state.profile);
  const atmosphere = useAetherStore((state) => state.atmosphere);
  const mode = useAetherStore((state) => state.mode);
  // Interpretación abierta en una sola fila; se marca desactualizada si cambian el perfil, la atmósfera o el modo.
  const [opened, setOpened] = useState<Extract<InterpretRequest, { kind: "rank" }> | null>(null);
  const hasFilters = facility !== "all" || topic !== null || studyFilter !== null;
  const count = view === "study" ? studies.length : rankedRuns.length;
  const rankedStudies = [...studies].sort((a, b) =>
    (studyScores.get(b.id)?.score ?? 0) - (studyScores.get(a.id)?.score ?? 0) || a.id.localeCompare(b.id));

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
          {rankedStudies.map((study) => {
            const count = catalogRunCounts.get(study.id) ?? 0;
            const active = current?.kind === "study" && current.id === study.id;
            const result = studyScores.get(study.id);
            const bestRun = rankedRuns.find(({ run }) => run.investigationId === study.id)?.run;
            return (
              <li className="study-card" data-active={active} key={study.id}>
                <button className="study-open" type="button" aria-pressed={active} onClick={() => inspect({ kind: "study", id: study.id })}>
                  <span className="study-card-heading"><strong>{study.id}</strong>{result && <ScoreBadge result={result} />}</span>
                  <span className="study-name">{study.name}</span>
                </button>
                {result && <ScoreDetails result={result} label={study.id} />}
                <div className="study-card-meta">
                  <span className="study-count">
                    <span>{facilities[study.facility].label}</span>
                    <span>{count ? `${count} ${count === 1 ? "registro" : "registros"}` : "Ficha bibliográfica"}</span>
                  </span>
                  <div className="run-actions">
                    {(["a", "b"] as const).map((side) => <button type="button" key={side}
                      title={bestRun?.label ?? "Sin registros comparables en esta vista"}
                      aria-pressed={bestRun !== undefined && comparison[side] === bestRun.id}
                      aria-label={`Comparar estudio ${study.id} en ${side.toUpperCase()}`}
                      disabled={!bestRun} onClick={() => { if (bestRun) selectRun(side, bestRun.id); }}>+{side.toUpperCase()}</button>)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ol className="panel-content ranked-list">
          {rankedRuns.map((result) => {
            const { run, bounds } = result;
            const active = current?.kind === "run" && current.id === run.id;
            const interpreting = opened?.payload.run.id === run.id;
            const request = (): Extract<InterpretRequest, { kind: "rank" }> =>
              ({ kind: "rank", payload: buildRankPayload(result, profile, atmosphere, investigationsById), mode, lang: "es" });
            return (
              <li className="run-card" key={run.id} data-active={active}>
                <button type="button" className="run-top" aria-pressed={active} onClick={() => inspect({ kind: "run", id: run.id })}>
                  <span>
                    <span className="run-study">{run.investigationId}</span>
                    <strong>{run.label}</strong>
                  </span>
                  <ScoreBadge result={result} />
                </button>
                <ScoreDetails result={result} label={run.label} />
                <div className="run-bottom">
                  <span><FlaskConical size={11} aria-hidden /> {run.fuel}
                    {run.atmosphere.oxygen_pct !== undefined && !run.nominal?.fields.includes("oxygen_pct") && ` · ${run.atmosphere.oxygen_pct.toFixed(1)}% O₂`}
                  </span>
                  {run.reference && <span className="reference-label">Perfil nominal PSI</span>}
                  {bounds.length > 0 && <span className="bound-tag" title="Cota experimental por variable">Cota</span>}
                  <div className="run-actions">
                    <button type="button" aria-label={`Comparar ${run.label} en A`} aria-pressed={comparison.a === run.id} onClick={() => selectRun("a", run.id)}>+ A</button>
                    <button type="button" aria-label={`Comparar ${run.label} en B`} aria-pressed={comparison.b === run.id} onClick={() => selectRun("b", run.id)}>+ B</button>
                    <button type="button" aria-label="Interpretar puntaje" title="Interpretar puntaje" aria-expanded={interpreting}
                      onClick={() => setOpened(interpreting ? null : request())}><Sparkles size={11} aria-hidden /></button>
                  </div>
                </div>
                {interpreting && opened && <InterpretationCard
                  request={opened}
                  stale={interpretationKey(opened) !== interpretationKey(request())}
                  onRefresh={() => setOpened(request())}
                  chips={<>
                    <a className="chip" href={opened.payload.run.source.url} target="_blank" rel="noreferrer">{opened.payload.run.source.label} <ExternalLink size={10} aria-hidden /></a>
                    <span className="chip">Motor local · FSRS · {opened.payload.profile.name}</span>
                  </>}
                />}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
