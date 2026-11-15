import { ExternalLink, FlaskConical, ListFilter, SearchX, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { FSRS, rankRuns } from "../../core/si-engine/fsrs-ranker";
import { buildRankPayload, interpretationKey, type InterpretRequest } from "../../core/si-engine/interpret";
import { psiStudyComparisonId } from "../../core/si-engine/merge-psi-catalog";
import { InterpretationCard } from "../nexus/InterpretationCard";
import type { EvidenceSearchResults } from "../../core/si-engine/semantic-search";
import { evidenceTopics, facilities } from "../../data/psi_vocabulary";
import { atmosphereControls } from "../../data/mission_presets";
import { useAetherStore, type EvidenceSelection } from "../../store/useAetherStore";
import type { EvidenceTopicId, ExperimentalRun, Investigation } from "../../types/psi";

interface DatasetListProps {
  studies: Investigation[];
  rankedRuns: ReturnType<typeof rankRuns>;
  studyScores: ReadonlyMap<string, FSRS>;
  studiesById: ReadonlyMap<string, Investigation>;
  runsByStudy: ReadonlyMap<string, readonly ExperimentalRun[]>;
  search: EvidenceSearchResults;
  current: EvidenceSelection | null;
  view: "study" | "run";
}

function ScoreBadge({ result }: { result: FSRS }) {
  return <span className="fsrs-badge mono" title="Similitud con el escenario (FSRS)">FSRS {result.score.toFixed(1)}</span>;
}

function ScoreDetails({ result, label }: { result: FSRS; label: string }) {
  return <div className="fsrs-details">
    <meter aria-label={`Similitud con el escenario (FSRS) de ${label}`} min={0} max={100} value={result.score} />
    <p>Atm {Math.round(result.atmosphere_pct)}% · Flujo {Math.round(result.flow_pct)}% · Grav/Puente {Math.round(result.gravityBridge_pct)}%</p>
    <details className="fsrs-explanation">
      <summary>¿Por qué este puntaje?</summary>
      <dl>
        {atmosphereControls.map(({ field, label, unit, decimals }) => {
          const criterion = result.criteria.find(({ axis }) => axis === field)!;
          const { input, target, distance, contribution_pts, weight_pts } = criterion;
          const range = input?.range.map((value) => value.toFixed(decimals));
          const rangeLabel = range && [...new Set(range)].join("–");
          const inputLabel = input?.published ? input.measured ? "Registros y perfil publicado" : "Perfil publicado" : "Registro";
          return <div key={field}>
            <dt>{label} · {contribution_pts.toFixed(1)} de {weight_pts} pts</dt>
            <dd>
              Escenario {target.toFixed(decimals)} {unit}.
              {rangeLabel ? ` ${inputLabel} ${rangeLabel} ${unit}. Brecha ${distance!.toFixed(decimals)} ${field === "oxygen_pct" ? "pp" : unit}.`
                : " Sin dato medido ni perfil publicado para este criterio."}
              {input?.sources.map((source) => <a key={`${source.url}|${source.label}`} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
            </dd>
          </div>;
        })}
        <div><dt>Contexto · {result.context.total_pts.toFixed(1)} de {result.context.weight_pts} pts</dt>
          <dd>Instrumentación {result.context.instrument_pts.toFixed(1)} pts · vínculo entre estudios {result.context.bridge_pts.toFixed(1)} pts · prioridad de misión {result.context.priority_pts.toFixed(1)} pts.</dd></div>
        {result.bonus_pts > 0 && <div><dt>Bonificación heurística · +{result.bonus_pts} pts</dt><dd>Se aplica según el escenario y el estudio. El índice se limita a 100 pts.</dd></div>}
      </dl>
    </details>
  </div>;
}

export function RankedDatasetList({ studies, rankedRuns, studyScores, studiesById, runsByStudy, search, current, view }: DatasetListProps) {
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
  const psiArea = useAetherStore((state) => state.psiArea);
  const psiCatalog = useAetherStore((state) => state.psiCatalog);
  const setPsiArea = useAetherStore((state) => state.setPsiArea);
  // Interpretación abierta en una sola fila; se marca desactualizada si cambian el perfil, la atmósfera o el modo.
  const [opened, setOpened] = useState<Extract<InterpretRequest, { kind: "rank" }> | null>(null);
  const hasFilters = facility !== "all" || topic !== null || studyFilter !== null;
  const count = view === "study" ? studies.length : rankedRuns.length;
  const quantitativeRuns = rankedRuns.filter(({ run }) => !run.reference);
  const referenceRuns = rankedRuns.filter(({ run }) => run.reference);
  const rankedStudies = [...studies].sort((a, b) =>
    (studyScores.get(b.id)?.score ?? -1) - (studyScores.get(a.id)?.score ?? -1) || a.id.localeCompare(b.id));

  return (
    <section className="panel ranking" aria-labelledby="ranking-title">
      <div className="panel-heading">
        <h2 id="ranking-title" tabIndex={-1}><ListFilter size={17} aria-hidden /> {search.active ? "Resultados" : "Catálogo de evidencia"}</h2>
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
        <label className="psi-area-control">
          <input type="checkbox" checked={psiArea === "all"} onChange={(event) => setPsiArea(event.target.checked ? "all" : "combustion")} />
          Ver todo PSI
          {psiArea === "all" && psiCatalog?.area === "all" && <small>{psiCatalog.disciplines} {psiCatalog.disciplines === 1 ? "disciplina" : "disciplinas"}</small>}
        </label>
        <p className="fsrs-details">Similitud con el escenario (FSRS)</p>
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
            const count = runsByStudy.get(study.id)?.length ?? 0;
            const active = current?.kind === "study" && current.id === study.id;
            const result = studyScores.get(study.id);
            const bestRun = [...quantitativeRuns, ...referenceRuns].find(({ run }) => run.investigationId === study.id)?.run;
            const imported = study.importedPsi;
            const comparisonId = bestRun?.id ?? (imported && !imported.profile ? psiStudyComparisonId(study.id) : undefined);
            return (
              <li className="study-card" data-active={active} key={study.id}>
                <button className="study-open" type="button" aria-pressed={active} onClick={() => inspect({ kind: "study", id: study.id })}>
                  <span className="study-card-heading"><strong>{imported?.acronym ?? study.id}</strong>{result && <ScoreBadge result={result} />}</span>
                  <span className="study-name">{study.name}</span>
                </button>
                {result && <ScoreDetails result={result} label={study.id} />}
                {imported && <div className="psi-badge" data-origin={imported.origin}>
                  {imported.origin === "live" ? "LIVE PSI" : "PSI · Snapshot"}{!imported.profile && " · sin perfil cuantitativo"}
                </div>}
                <div className="study-card-meta">
                  <span className="study-count">
                    <span>{facilities[study.facility].label}</span>
                    <span>{imported ? imported.researchArea : count ? `${count} ${count === 1 ? "registro" : "registros"}` : "Ficha bibliográfica"}</span>
                  </span>
                  <div className="run-actions">
                    {(["a", "b"] as const).map((side) => <button type="button" key={side}
                      title={bestRun?.label ?? (comparisonId ? "Comparar ficha sin cifras" : "Sin registros comparables en esta vista")}
                      aria-pressed={comparisonId !== undefined && comparison[side] === comparisonId}
                      aria-label={`Comparar estudio ${study.id} en ${side.toUpperCase()}`}
                      disabled={!comparisonId} onClick={() => { if (comparisonId) selectRun(side, comparisonId); }}>+{side.toUpperCase()}</button>)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ol className="panel-content ranked-list">
          {[...quantitativeRuns, ...referenceRuns].map((result) => {
            const { run, bounds } = result;
            const imported = studiesById.get(run.investigationId)?.importedPsi;
            const active = current?.kind === "run" && current.id === run.id;
            const interpreting = opened?.payload.run.id === run.id;
            const request = (): Extract<InterpretRequest, { kind: "rank" }> =>
              ({ kind: "rank", payload: buildRankPayload(result, profile, atmosphere, studiesById), mode, lang: "es" });
            return (
              <li className="run-card" key={run.id} data-active={active} data-reference={Boolean(run.reference)}>
                <button type="button" className="run-top" aria-pressed={active} onClick={() => inspect({ kind: "run", id: run.id }, run.investigationId)}>
                  <span>
                    <span className="run-study">{run.investigationId}</span>
                    <strong>{run.label}</strong>
                  </span>
                  {!run.reference && <ScoreBadge result={result} />}
                </button>
                {!run.reference && <ScoreDetails result={result} label={run.label} />}
                <div className="run-bottom">
                  <span><FlaskConical size={11} aria-hidden /> {run.fuel ?? "Condiciones publicadas"}
                    {run.atmosphere.oxygen_pct !== undefined && !run.nominal?.fields.includes("oxygen_pct") && ` · ${run.atmosphere.oxygen_pct.toFixed(1)}% O₂`}
                  </span>
                  {run.reference && <span className="reference-label">Perfil nominal PSI</span>}
                  {imported && <span className="psi-badge" data-origin={imported.origin}>{imported.origin === "live" ? "LIVE PSI" : "PSI · Snapshot"}</span>}
                  {bounds.length > 0 && <span className="bound-tag" title="Cota experimental por variable">Cota</span>}
                  <div className="run-actions">
                    <button type="button" aria-label={`Comparar ${run.label} en A`} aria-pressed={comparison.a === run.id} onClick={() => selectRun("a", run.id)}>+ A</button>
                    <button type="button" aria-label={`Comparar ${run.label} en B`} aria-pressed={comparison.b === run.id} onClick={() => selectRun("b", run.id)}>+ B</button>
                    {!run.reference && !run.psiProfile && <button type="button" aria-label="Interpretar puntaje" title="Interpretar puntaje" aria-expanded={interpreting}
                      onClick={() => setOpened(interpreting ? null : request())}><Sparkles size={11} aria-hidden /></button>}
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
