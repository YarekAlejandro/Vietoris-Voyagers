import { ArrowLeftRight, ArrowRight, ExternalLink, FileText } from "lucide-react";
import type { rankRuns } from "../../core/si-engine/fsrs-ranker";
import { supplementalFields } from "../../core/si-engine/git-diff";
import { studyBridges } from "../../core/si-engine/knowledge-graph";
import { formatPsiQuantity } from "../../core/si-engine/live-psi-mapper";
import { psiStudyComparisonId } from "../../core/si-engine/merge-psi-catalog";
import type { EvidenceSearchResults } from "../../core/si-engine/semantic-search";
import { atmosphereControls } from "../../data/mission_presets";
import { historicalLessons, studentDescriptions, terrestrialApplications } from "../../data/evidence_context";
import { evidenceTopics, facilities, pillarLabels, topicsForRun } from "../../data/psi_vocabulary";
import { useAetherStore } from "../../store/useAetherStore";
import type { Citation, ExperimentalRun, Investigation } from "../../types/psi";
import type { NtrsRecord, PsiProfile } from "../../types/psi-live";
import { AtmosphereSliders } from "../simulator/AtmosphereSliders";
import { SafetyTriadMatrix } from "../simulator/SafetyTriadMatrix";
import { NtrsLink, NtrsRadar, ntrsForStudy } from "./NtrsRadar";
import { ScenarioCoverageCard } from "../simulator/ScenarioCoverageCard";
import type { ScenarioCoverage } from "../../core/si-engine/scenario-coverage";
import { sceneEvidenceForRun } from "../../core/si-engine/experiment-scene";
import { ExperimentScene } from "../simulator/ExperimentScene";

function SourceLink({ source }: { source: Citation }) {
  return <a className="source-link" href={source.url} target="_blank" rel="noreferrer">{source.label} <ExternalLink size={13} aria-hidden /></a>;
}

interface InspectorProps {
  study: Investigation | undefined;
  run: ExperimentalRun | undefined;
  search: EvidenceSearchResults;
  availableRuns: readonly ExperimentalRun[];
  rankedRun: ReturnType<typeof rankRuns>[number] | undefined;
  literature: readonly NtrsRecord[];
  coverage: ScenarioCoverage;
}

export function EvidenceInspector({ study, run, search, availableRuns, rankedRun, literature, coverage }: InspectorProps) {
  const view = useAetherStore((state) => state.inspectorView);
  const mode = useAetherStore((state) => state.mode);
  const comparison = useAetherStore((state) => state.comparison);
  const setView = useAetherStore((state) => state.setInspectorView);
  const selectRun = useAetherStore((state) => state.selectRun);
  const setStudyFilter = useAetherStore((state) => state.setStudyFilter);
  const reasons = run ? search.runs.get(run.id)?.reasons : study ? search.studies.get(study.id)?.reasons : undefined;
  const bridges = study ? studyBridges.filter(({ source, target }) => source === study.id || target === study.id) : [];
  const matchingRunCount = availableRuns.filter(({ investigationId }) => investigationId === study?.id).length;
  const imported = study?.importedPsi;
  const sceneEnabled = process.env.NEXT_PUBLIC_EXPERIMENT_SCENE !== "false";
  const scene = run && sceneEnabled ? sceneEvidenceForRun(run) : null;
  const relatedLiterature = study ? ntrsForStudy(study, literature) : [];
  const comparisonId = run?.id ?? (imported && !imported.profile && study ? psiStudyComparisonId(study.id) : undefined);
  const evidenceTopicsForSelection = run ? topicsForRun(run) : study?.topics ?? [];
  const extraReadouts = run ? supplementalFields.flatMap((field) => {
    const value = run[field.id];
    return value === undefined ? [] : [{ ...field, value: value.toFixed(field.decimals) }];
  }) : [];

  return (
    <section className="panel inspector" aria-labelledby="inspector-title">
      <div className="panel-heading inspector-heading">
        <h2 id="inspector-title"><FileText size={16} aria-hidden /> {view === "evidence" ? "Ficha" : view === "radar" ? "Radar NTRS" : "Escenario"}</h2>
        <div className="segments" role="group" aria-label="Vista de la ficha">
          <button type="button" aria-pressed={view === "evidence"} onClick={() => setView("evidence")}>Evidencia</button>
          <button type="button" aria-pressed={view === "atmosphere"} onClick={() => setView("atmosphere")}>Atmósfera</button>
          <button type="button" aria-label="Radar NTRS" aria-pressed={view === "radar"} onClick={() => setView("radar")}>NTRS</button>
        </div>
      </div>
      {view !== "radar" && <div className="scenario-coverage"><ScenarioCoverageCard coverage={coverage} /></div>}
      {view === "atmosphere" ? <AtmosphereSliders /> : view === "radar" ? <NtrsRadar literature={literature} /> : study ? (
        <div className="panel-content inspector-content" key={run?.id ?? study.id}>
          <div className="evidence-kind">
            {imported ? <span className="psi-badge" data-origin={imported.origin}>{imported.origin === "live" ? "LIVE PSI" : "PSI · Snapshot"}</span>
              : <span>{run?.reference ? "Perfil nominal PSI" : run ? "Corrida documentada" : matchingRunCount ? "Investigación con registros" : "Ficha bibliográfica"}</span>}
            <span>{facilities[study.facility].label}</span>
          </div>
          <div>
            <h3>{run?.label ?? imported?.acronym ?? study.id}</h3>
            <p className="evidence-study-name">{run?.fuel ? `${study.id} · ${run.fuel}` : study.name}</p>
          </div>
          {comparisonId && <div className="inspector-actions" role="group" aria-label="Añadir al comparador">
            {(["a", "b"] as const).map((side) =>
              <button type="button" className="quiet-button" key={side}
                aria-pressed={comparison[side] === comparisonId} onClick={() => selectRun(side, comparisonId)}>
                <ArrowLeftRight size={13} aria-hidden /> Comparar en {side.toUpperCase()}
              </button>)}
          </div>}
          {imported ? <>
            <p className="psi-note">Dato de NASA PSI. Perfil inferido solo si NASA publica cifras.</p>
            {imported.profile ? <ProfileReadouts profile={imported.profile} />
              : <p className="psi-note">Sin perfil cuantitativo para FSRS.</p>}
            {!run && <p>{study.summary}</p>}
          </> : run ? (
            <>
              <p>{run.configuration}{run.outcome ? ` · ${run.outcome}` : ""}</p>
              <dl className="evidence-readouts">
                {atmosphereControls.map(({ field, label, unit, decimals }) => {
                  const value = run.atmosphere[field];
                  return <div key={field}><dt>{label}</dt>
                    <dd>{value === undefined ? <small>Sin dato</small> : <>{value.toFixed(field === "pressure_psia" ? 2 : decimals)} <small>{unit}</small></>}</dd>
                    {run.nominal?.fields.includes(field) && <small>Nominal</small>}
                  </div>;
                })}
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
          ) : <p>{mode === "student" ? studentDescriptions[study.id] ?? study.summary : study.summary}</p>}
          <SourceLink source={run?.source ?? study.source} />
          {scene ? <ExperimentScene evidence={scene} /> : sceneEnabled && run && <p className="psi-note">
            {run.reference || run.psiProfile ? "La escena requiere una corrida experimental documentada."
              : "Montaje sin escena disponible."}
          </p>}
          {study.psi && <div className="psi-identity">
            <span>{study.psi.accession}{study.psi.license ? ` · ${study.psi.license}` : ""}{imported ? ` · ${imported.researchArea}` : ""}</span>
            {(run || !imported) && <SourceLink source={{ label: "Ficha oficial · NASA Physical Sciences Informatics", url: study.psi.officialUrl }} />}
            {study.psi.doi && <SourceLink source={{ label: `DOI ${study.psi.doi}`, url: `https://doi.org/${study.psi.doi}` }} />}
            {study.psi.publications.length > 0 && <details>
              <summary>Publicaciones en PSI ({study.psi.publications.length})</summary>
              <ul>{study.psi.publications.map(({ title, doi }, index) => <li key={`${title}:${index}`}>
                {doi ? <SourceLink source={{ label: title, url: `https://doi.org/${doi}` }} /> : title}
              </li>)}</ul>
            </details>}
          </div>}
          {relatedLiterature.length > 0 && <div className="psi-identity">
            <span className="ntrs-badge">Literatura NTRS</span>
            {relatedLiterature.slice(0, 4).map((record) => <NtrsLink key={record.id} record={record} />)}
          </div>}
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
          {!imported && <SafetyTriadMatrix study={study} run={run} />}
          {bridges.map((bridge) => <div className="evidence-bridge" key={bridge.title}>
            <strong>{bridge.title}</strong>
            <p>{bridge.description}</p>
            <SourceLink source={bridge.citation} />
          </div>)}
          {rankedRun && !run?.reference && mode === "engineer" && <div className="search-reason">
            <strong>Similitud con el escenario (FSRS) · {rankedRun.score.toFixed(1)} / 100</strong>
            <p>Combina cercanía al escenario, instrumentación y vínculos experimentales. Bonificación del escenario: {rankedRun.bonus_pts} pts.</p>
          </div>}
          {mode === "student" && <>
            <section className="student-card">
              <h4>¿Por qué cambia de forma una llama?</h4>
              <p>En la Tierra, el gas caliente asciende y estira la llama. En microgravedad, sin ventilación fuerte, el combustible y el oxígeno se mezclan por difusión y algunas llamas se redondean. El color depende del combustible y del hollín.</p>
            </section>
            <ReadingCard title="Lecciones históricas" entries={historicalLessons} />
            <ReadingCard title="Transferencia a la Tierra" entries={terrestrialApplications} />
          </>}
        </div>
      ) : (
        <div className="panel-content empty-evidence"><FileText size={26} aria-hidden /><p>Selecciona un resultado para ver sus datos y su fuente original.</p></div>
      )}
    </section>
  );
}

function ProfileReadouts({ profile }: { profile: PsiProfile }) {
  return <dl className="evidence-readouts psi-profile">
    {atmosphereControls.map(({ field, label, decimals }) => {
      const quantity = profile[field];
      return <div key={field}>
        <dt>{label}</dt>
        <dd>{quantity ? formatPsiQuantity(quantity, field === "pressure_psia" ? 2 : decimals) : "—"}</dd>
        {quantity && <small title={quantity.evidence}>
          {quantity.source === "experimental-table" ? "Tabla PSI" : "Texto de PSI"} · confianza {quantity.confidence}
        </small>}
      </div>;
    })}
  </dl>;
}

function ReadingCard({ title, entries }: { title: string; entries: readonly { label: string; note: string; url: string }[] }) {
  return <section className="student-card"><h4>{title}</h4><ul>
    {entries.map(({ label, note, url }) => <li key={label}>
      <a href={url} target="_blank" rel="noreferrer">{label}</a><p>{note}</p>
    </li>)}
  </ul></section>;
}
