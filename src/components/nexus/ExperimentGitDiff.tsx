import { ArrowLeftRight, ExternalLink, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { compareRuns, comparisonAvailability, reportedComparisonRows, summarizeChangedDrivers } from "../../core/si-engine/git-diff";
import { buildDiffPayload, interpretationKey, type InterpretRequest } from "../../core/si-engine/interpret";
import { psiStudyComparisonId } from "../../core/si-engine/merge-psi-catalog";
import { atmosphereControls } from "../../data/mission_presets";
import { facilities } from "../../data/psi_vocabulary";
import { useAetherStore } from "../../store/useAetherStore";
import type { ExperimentalRun, Facility, Investigation } from "../../types/psi";
import { InterpretationCard } from "./InterpretationCard";
import { SplitHandle } from "./SplitHandle";
import { PanelSizeButton, type PanelSizeProps } from "./PanelSizeButton";

// Mínimos del reparto entre la tabla y la interpretación: encabezado y una fila / título y algo de texto.
const minTableHeight = 72;
const minInterpretationHeight = 96;

function formatValue(value: number | string | undefined, decimals = 0, unit = "") {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return unit ? `${value.toFixed(decimals)} ${unit}` : value.toFixed(decimals);
}

interface ComparisonProps extends PanelSizeProps {
  runs: readonly ExperimentalRun[];
  runsById: ReadonlyMap<string, ExperimentalRun>;
  studiesById: ReadonlyMap<string, Investigation>;
  areaStudies: readonly Investigation[];
  guidedSelectors?: readonly string[];
}

const atmosphereFields = new Set<string>(atmosphereControls.map(({ field }) => field));

export function ExperimentGitDiff({ runs, runsById, studiesById, areaStudies, guidedSelectors, expanded, onToggleSize }: ComparisonProps) {
  const comparison = useAetherStore((state) => state.comparison);
  const mode = useAetherStore((state) => state.mode);
  const scenario = useAetherStore((state) => state.atmosphere);
  const profileId = useAetherStore((state) => state.profile.id);
  const selectRun = useAetherStore((state) => state.selectRun);
  // Petición con la que se abrió la interpretación; si A, B o el modo cambian, queda desactualizada.
  const [opened, setOpened] = useState<InterpretRequest | null>(null);
  // Alto de la tabla fijado con el divisor; null reparte por mitades.
  const [tableHeight, setTableHeight] = useState<number | null>(null);
  const [rowFilter, setRowFilter] = useState<"all" | "changed" | "missing">("all");
  const [showMatches, setShowMatches] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const interpretationRef = useRef<HTMLDivElement>(null);
  const importedStudies = areaStudies.filter((study) => study.importedPsi && !study.importedPsi.profile);
  for (const id of [comparison.a, comparison.b]) {
    if (!id.startsWith("psi-study:")) continue;
    const study = studiesById.get(id.slice("psi-study:".length));
    if (study?.importedPsi && !importedStudies.includes(study)) importedStudies.push(study);
  }
  const bibliographic = new Map<string, ExperimentalRun>(importedStudies.map((study) => {
    const id = psiStudyComparisonId(study.id);
    return [id, { id, label: `${study.importedPsi?.acronym ?? study.id} · ficha`, investigationId: study.id,
      atmosphere: {}, source: study.source }];
  }));
  const a = runsById.get(comparison.a) ?? bibliographic.get(comparison.a) ?? runsById.get("SAFFIRE-V-E6");
  const b = runsById.get(comparison.b) ?? bibliographic.get(comparison.b) ?? runsById.get("SAFFIRE-VI-E6");
  if (!a || !b) return null;
  const hasPsiProfile = Boolean(a.psiProfile || b.psiProfile);
  const hasBibliographic = bibliographic.has(a.id) || bibliographic.has(b.id);
  const hasNominalProfile = Boolean(a.reference || b.reference);
  const allRows = compareRuns(a, b, studiesById);
  const reported = new Set(reportedComparisonRows(allRows, a, b));
  const rows = allRows.filter((row) => reported.has(row) ||
    ((hasPsiProfile || hasBibliographic || hasNominalProfile) && atmosphereFields.has(row.field.id)));
  const annotatedRows = rows.map((row) => ({
    ...row,
    availabilityA: comparisonAvailability(row.field.id, row.valueA, a),
    availabilityB: comparisonAvailability(row.field.id, row.valueB, b),
  }));
  const matchingCount = rows.filter(({ status }) => status === "equal").length;
  const visibleRows = annotatedRows.filter(({ field, status, availabilityA, availabilityB }) => {
    if (rowFilter === "changed") return status === "changed";
    if (rowFilter === "missing") return availabilityA === "missing" || availabilityB === "missing";
    return status !== "equal" || showMatches || guidedSelectors?.some((selector) =>
      selector.includes(`data-assistant-diff-row="${field.id}"`) || selector.includes(`data-assistant-diff-cell="${field.id}:`));
  });
  const drivers = summarizeChangedDrivers(rows);
  const current: InterpretRequest | null = hasPsiProfile || hasBibliographic || hasNominalProfile ? null
    : { kind: "diff", payload: buildDiffPayload(a, b, rows, studiesById), mode, lang: "es", scenario, profileId };
  const interpretation = current && opened?.kind === "diff" ? opened : null;
  const stale = Boolean(interpretation && current && interpretationKey(interpretation) !== interpretationKey(current));

  return (
    <section className="panel comparison" data-expanded={expanded} aria-labelledby="comparison-title">
      <div className="panel-heading">
        <h2 id="comparison-title" tabIndex={-1}><ArrowLeftRight size={17} aria-hidden /> Comparación experimental</h2>
        <div className="panel-heading-actions">
          {mode === "engineer" && <span className="panel-meta">Git-Diff · A/B</span>}
          {current && <button id="assistant-interpret" type="button" className="interpret-toggle" aria-expanded={interpretation !== null} onClick={() => {
            setOpened(interpretation ? null : current);
            setTableHeight(null);
          }}>
            <Sparkles size={13} aria-hidden /> {interpretation ? "Ocultar interpretación" : "Interpretar"}
          </button>}
          <PanelSizeButton name="comparación experimental" expanded={expanded} onToggleSize={onToggleSize} />
        </div>
      </div>
      <div className={`panel-content comparison-content${interpretation ? " with-interpretation" : ""}`}>
        <div className="comparison-selects" id="assistant-diff-runs">
          {(["a", "b"] as const).map((side) => (
            <label key={side}>
              <span className={`side side-${side}`} aria-hidden>{side.toUpperCase()}</span>
              <span className="sr-only">Corrida {side.toUpperCase()}</span>
              <select id={`assistant-diff-run-${side}`} value={side === "a" ? a.id : b.id} onChange={(event) => selectRun(side, event.target.value)}>
                <optgroup label="Corridas experimentales">
                  {runs.filter((run) => !run.reference && !run.psiProfile).map((run) => <option value={run.id} key={run.id}>{run.label}</option>)}
                </optgroup>
                <optgroup label="Perfiles de referencia">
                  {runs.filter((run) => run.reference || run.psiProfile).map((run) => (
                    <option value={run.id} key={run.id}>{run.label} {run.reference ? "(perfil nominal)" : "(perfil PSI)"}</option>
                  ))}
                </optgroup>
                {bibliographic.size > 0 && <optgroup label="Fichas sin cifras">
                  {[...bibliographic.values()].map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                </optgroup>}
              </select>
            </label>
          ))}
        </div>
        {drivers.confounded && <div className="comparison-confounding" id="assistant-diff-confounding" role="status">
          <p>Cambiaron varias condiciones a la vez: la diferencia no puede atribuirse a una sola variable.</p>
          <p>{drivers.changedVariables.join(" · ")}</p>
        </div>}
        <div className="comparison-toolbar">
          <div className="segments" role="group" aria-label="Filtrar filas de la comparación">
            {([["all", "Resumen"], ["changed", "Solo diferencias"], ["missing", "Datos faltantes"]] as const).map(([id, label]) =>
              <button key={id} type="button" aria-pressed={rowFilter === id} onClick={() => setRowFilter(id)}>{label}</button>)}
          </div>
          {rowFilter === "all" && matchingCount > 0 && <button type="button" className="quiet-button" aria-expanded={showMatches}
            aria-controls="comparison-rows" onClick={() => setShowMatches(!showMatches)}>
            {showMatches ? "Plegar" : "Ver"} coincidencias ({matchingCount})
          </button>}
        </div>
        <div className="comparison-scroll" ref={tableRef}
          style={interpretation && tableHeight !== null ? { flex: `0 0 ${tableHeight}px` } : undefined}>
          <table>
            <thead><tr><th scope="col">Variable</th><th scope="col">Corrida A</th><th scope="col">Corrida B</th><th scope="col">{mode === "engineer" ? "Δ B − A" : "Diferencia"}</th></tr></thead>
            <tbody id="comparison-rows">
              {visibleRows.length === 0 && <tr><td colSpan={4} className="diff-empty" role="status">No hay filas para este filtro.</td></tr>}
              {visibleRows.map(({ field, valueA, valueB, nominalA, nominalB, availabilityA, availabilityB, status, delta, relativeDelta_pct, outcome }) => {
                const { decimals, unit } = "unit" in field ? field : { decimals: undefined, unit: undefined };
                const deltaUnit = "deltaUnit" in field ? field.deltaUnit : unit;
                const comparisonState = status === "nominal" || (status === "missing" &&
                  (availabilityA !== "missing" || availabilityB !== "missing")) ? "not-comparable" : status;
                const display = (value: typeof valueA) => field.id === "facility" && typeof value === "string" && Object.hasOwn(facilities, value)
                  ? facilities[value as Facility].label : formatValue(value, decimals, unit);
                return <tr key={field.id} data-status={status} data-outcome={outcome} data-assistant-diff-row={field.id}>
                  <th scope="row">{field.label}</th>
                  {([{ run: a, value: valueA, nominal: nominalA, availability: availabilityA, side: "a" },
                    { run: b, value: valueB, nominal: nominalB, availability: availabilityB, side: "b" }] as const).map(({ run, value, nominal, availability, side }) => {
                    const source = field.id === "facility" ? studiesById.get(run.investigationId)?.source ?? run.source : run.source;
                    return <td key={side} data-assistant-diff-cell={`${field.id}:${side}`}>
                      {availability === "present" ? <><span className="diff-value">{display(value)}</span>
                        <div className="diff-provenance">
                          <span>{run.psiProfile ? "Perfil PSI" : nominal ? "Nominal" : field.id === "cabin_heat_added_kj" ? "Estimación publicada" : "Documentado"}</span>
                          <a href={source.url} target="_blank" rel="noreferrer" title={source.label}
                            aria-label={`Fuente de ${field.label}, ${run.label}: ${source.label}`}>
                            {source.label.split(" · ").slice(1).join(" · ") || "Fuente"} <ExternalLink size={10} aria-hidden />
                          </a>
                        </div></> : <span className="diff-status" data-availability={availability}
                          title={availability === "not-applicable" ? "La variable no corresponde al tipo de muestra." : "La variable no figura en el registro."}>
                          {availability === "not-applicable" ? "No aplica" : "Sin dato"}
                        </span>}
                    </td>;
                  })}
                  <td>
                    {delta === undefined ? <span className="diff-status" data-availability={comparisonState}>{{
                      equal: "Igual", missing: "Sin dato", changed: "Cambió", "not-comparable": "No comparable",
                    }[comparisonState as "equal" | "missing" | "changed" | "not-comparable"]}</span> : (
                      <><span className="diff-delta">{delta > 0 ? "+" : ""}{formatValue(delta, decimals, deltaUnit)}</span>
                        {relativeDelta_pct !== undefined && <small className="diff-relative" title="Cambio relativo a A">/ {relativeDelta_pct > 0 ? "+" : ""}{relativeDelta_pct.toFixed(1)}%</small>}
                      </>
                    )}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {interpretation && <SplitHandle
          label="Ajustar alto de la tabla y la interpretación"
          minTop={minTableHeight}
          minBottom={minInterpretationHeight}
          measure={() => {
            const table = tableRef.current?.getBoundingClientRect().height;
            const interpretation = interpretationRef.current?.getBoundingClientRect().height;
            return table === undefined || interpretation === undefined ? null : { top: table, total: table + interpretation };
          }}
          onResize={setTableHeight}
          onReset={() => setTableHeight(null)}
        />}
        {interpretation && <div className="comparison-interpretation" ref={interpretationRef}><InterpretationCard
          request={interpretation}
          stale={stale}
          onRefresh={() => setOpened(current)}
          chips={<>
            {[interpretation.payload.runs.a, interpretation.payload.runs.b].map((run, index) => (
              <a key={index} className="chip" href={run.source.url} target="_blank" rel="noreferrer">{`Fuente ${index === 0 ? "A" : "B"} · ${run.source.label}`} <ExternalLink size={10} aria-hidden /></a>
            ))}
            <span className="chip">Motor local · {interpretation.payload.rows.length} filas del diff</span>
          </>}
        /></div>}
        {(a.nominal || b.nominal) && <div className="comparison-sources">
          {a.nominal && <span>{a.nominal.basis === b.nominal?.basis ? "A/B" : "A"} · {a.nominal.basis}</span>}
          {b.nominal && b.nominal.basis !== a.nominal?.basis && <span>B · {b.nominal.basis}</span>}
        </div>}
        {(hasPsiProfile || hasBibliographic || hasNominalProfile) && <div className="comparison-sources">
          {hasPsiProfile && <span>Condiciones publicadas como perfil PSI.</span>}
          {hasNominalProfile && <span>El perfil nominal muestra condiciones de referencia.</span>}
        </div>}
        <div className="comparison-sources">
          {[a, b].map((run, index) => (
            <a key={index} href={run.source.url} target="_blank" rel="noreferrer"><strong>{`Fuente ${index === 0 ? "A" : "B"}`}</strong>{` · ${run.source.label} `}<ExternalLink size={11} aria-hidden /></a>
          ))}
        </div>
      </div>
    </section>
  );
}
