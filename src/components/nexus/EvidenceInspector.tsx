import { ArrowLeftRight, ArrowRight, ExternalLink, FileText } from "lucide-react";
import type { rankRuns } from "../../core/si-engine/fsrs-ranker";
import { supplementalFields } from "../../core/si-engine/git-diff";
import { studyBridges } from "../../core/si-engine/knowledge-graph";
import type { EvidenceSearchResults } from "../../core/si-engine/semantic-search";
import { atmosphereControls } from "../../data/mission_presets";
import { investigationsById, psiDataset, runsById } from "../../data/psi";
import { evidenceTopics, facilities, pillarLabels, topicsForRun } from "../../data/psi_vocabulary";
import { useAetherStore, type EvidenceSelection } from "../../store/useAetherStore";
import type { Citation, ExperimentalRun } from "../../types/psi";
import { AtmosphereSliders } from "../simulator/AtmosphereSliders";

function SourceLink({ source }: { source: Citation }) {
  return <a className="source-link" href={source.url} target="_blank" rel="noreferrer">{source.label} <ExternalLink size={13} aria-hidden /></a>;
}

interface InspectorProps {
  current: EvidenceSelection | null;
  search: EvidenceSearchResults;
  availableRuns: readonly ExperimentalRun[];
  rankedRun: ReturnType<typeof rankRuns>[number] | undefined;
}

export function EvidenceInspector({ current, search, availableRuns, rankedRun }: InspectorProps) {
  const view = useAetherStore((state) => state.inspectorView);
  const mode = useAetherStore((state) => state.mode);
  const comparison = useAetherStore((state) => state.comparison);
  const setView = useAetherStore((state) => state.setInspectorView);
  const selectRun = useAetherStore((state) => state.selectRun);
  const setStudyFilter = useAetherStore((state) => state.setStudyFilter);
  const run = current?.kind === "run" ? runsById.get(current.id) : undefined;
  const study = current ? investigationsById.get(run?.investigationId ?? current.id) : undefined;

  const reasons = run ? search.runs.get(run.id)?.reasons : study ? search.studies.get(study.id)?.reasons : undefined;
  const bridges = study ? studyBridges.filter(({ source, target }) => source === study.id || target === study.id) : [];
  const matchingRunCount = availableRuns.filter(({ investigationId }) => investigationId === study?.id).length;
  const studyHasRuns = study && psiDataset.runs.some(({ investigationId }) => investigationId === study.id);
  const evidenceTopicsForSelection = run ? topicsForRun(run) : study?.topics ?? [];
  const extraReadouts = run ? supplementalFields.flatMap((field) => {
    const value = run[field.id];
    return value === undefined ? [] : [{ ...field, value: value.toFixed(field.decimals) }];
  }) : [];

  return (
    <section className="panel inspector" aria-labelledby="inspector-title">
      <div className="panel-heading inspector-heading">
        <h2 id="inspector-title"><FileText size={16} aria-hidden /> {view === "evidence" ? "Ficha" : "Escenario"}</h2>
        <div className="segments" role="group" aria-label="Vista de la ficha">
          <button type="button" aria-pressed={view === "evidence"} onClick={() => setView("evidence")}>Evidencia</button>
          <button type="button" aria-pressed={view === "atmosphere"} onClick={() => setView("atmosphere")}>Atmósfera</button>
        </div>
      </div>
      {view === "atmosphere" ? <AtmosphereSliders /> : study ? (
        <div className="panel-content inspector-content" key={current?.id}>
          <div className="evidence-kind">
            <span>{run ? "Corrida documentada" : studyHasRuns ? "Investigación con corridas" : "Ficha bibliográfica"}</span>
            <span>{facilities[study.facility].label}</span>
          </div>
          <div>
            <h3>{run?.label ?? study.id}</h3>
            <p className="evidence-study-name">{run ? `${study.id} · ${run.fuel}` : study.name}</p>
          </div>
          {run && <div className="inspector-actions" role="group" aria-label="Añadir corrida al comparador">
            {(["a", "b"] as const).map((side) =>
              <button type="button" className="quiet-button" key={side}
                aria-pressed={comparison[side] === run.id} onClick={() => selectRun(side, run.id)}>
                <ArrowLeftRight size={13} aria-hidden /> Comparar en {side.toUpperCase()}
              </button>)}
          </div>}
          {run ? (
            <>
              <p>{run.configuration}{run.outcome ? ` · ${run.outcome}` : ""}</p>
              <dl className="evidence-readouts">
                {atmosphereControls.map(({ field, label, unit, decimals }) => <div key={field}>
                  <dt>{label}</dt><dd>{run.atmosphere[field].toFixed(field === "pressure_psia" ? 2 : decimals)} <small>{unit}</small></dd>
                  {run.nominal?.fields.includes(field) && <small>Nominal</small>}
                </div>)}
              </dl>
              {run.nominal && <p>{run.nominal.basis}</p>}
              {extraReadouts.length > 0 && <dl className="evidence-readouts">
                {extraReadouts.map(({ id, label, value, unit }) => <div key={id}>
                  <dt>{label}</dt><dd>{value} <small>{unit}</small></dd>
                </div>)}
              </dl>}
              {run.cabin_heat_added_kj !== undefined && <p className="observation"><strong>{run.cabin_heat_added_kj} kJ</strong> de calor añadido a cabina (estimación publicada).</p>}
              {run.steady_flame_length_cm !== undefined && <p className="observation"><strong>{run.steady_flame_length_cm} cm</strong> de longitud de llama estable.</p>}
            </>
          ) : <p>{study.summary}</p>}
          <SourceLink source={run?.source ?? study.source} />
          {!run && matchingRunCount > 0 && (
            <button type="button" className="quiet-button open-runs" onClick={() => setStudyFilter(study.id)}>
              {`Ver ${matchingRunCount} ${matchingRunCount === 1 ? "corrida" : "corridas"}`} <ArrowRight size={13} aria-hidden />
            </button>
          )}
          {reasons && reasons.length > 0 && <div className="search-reason"><strong>Por qué aparece</strong><p>{reasons.join(" · ")}</p></div>}
          <div className="evidence-tags">
            {evidenceTopicsForSelection.map((topic) => <span key={topic}>{evidenceTopics[topic].label}</span>)}
            {mode === "engineer" && study.safetyPillars.map((pillar) => <span key={pillar}>{pillarLabels[pillar]}</span>)}
          </div>
          {bridges.map((bridge) => <div className="evidence-bridge" key={bridge.title}>
            <strong>{bridge.title}</strong>
            <p>{bridge.description}</p>
            <SourceLink source={bridge.citation} />
          </div>)}
          {rankedRun && mode === "engineer" && <div className="search-reason">
            <strong>FSRS · {rankedRun.score.toFixed(1)} / 100</strong>
            <p>Estima la relevancia para la atmósfera, el material y la prioridad del perfil de misión.</p>
            {run?.nominal && <p>La similitud atmosférica se pondera según los datos reportados.</p>}
          </div>}
        </div>
      ) : (
        <div className="panel-content empty-evidence"><FileText size={26} aria-hidden /><p>Selecciona un resultado para ver sus datos y su fuente original.</p></div>
      )}
    </section>
  );
}
