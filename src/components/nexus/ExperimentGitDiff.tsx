import { ArrowLeftRight, ExternalLink, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { compareRuns } from "../../core/si-engine/git-diff";
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
}

const atmosphereFields = new Set<string>(atmosphereControls.map(({ field }) => field));

export function ExperimentGitDiff({ runs, runsById, studiesById, areaStudies, expanded, onToggleSize }: ComparisonProps) {
  const comparison = useAetherStore((state) => state.comparison);
  const mode = useAetherStore((state) => state.mode);
  const selectRun = useAetherStore((state) => state.selectRun);
  // Petición con la que se abrió la interpretación; si A, B o el modo cambian, queda desactualizada.
  const [opened, setOpened] = useState<InterpretRequest | null>(null);
  // Alto de la tabla fijado con el divisor; null reparte por mitades.
  const [tableHeight, setTableHeight] = useState<number | null>(null);
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
  const rows = compareRuns(a, b, studiesById).filter(({ field, valueA, valueB }) =>
    valueA !== undefined || valueB !== undefined || ((hasPsiProfile || hasBibliographic) && atmosphereFields.has(field.id)));
  const current: InterpretRequest | null = hasPsiProfile || hasBibliographic ? null
    : { kind: "diff", payload: buildDiffPayload(a, b, rows, studiesById), mode, lang: "es" };
  const interpretation = current && opened?.kind === "diff" ? opened : null;
  const stale = Boolean(interpretation && current && interpretationKey(interpretation) !== interpretationKey(current));

  return (
    <section className="panel comparison" data-expanded={expanded} aria-labelledby="comparison-title">
      <div className="panel-heading">
        <h2 id="comparison-title"><ArrowLeftRight size={17} aria-hidden /> Comparación experimental</h2>
        <div className="panel-heading-actions">
          {mode === "engineer" && <span className="panel-meta">Git-Diff · A/B</span>}
          {current && <button type="button" className="interpret-toggle" aria-expanded={interpretation !== null} onClick={() => {
            setOpened(interpretation ? null : current);
            setTableHeight(null);
          }}>
            <Sparkles size={13} aria-hidden /> {interpretation ? "Ocultar interpretación" : "Interpretar"}
          </button>}
          <PanelSizeButton name="comparación experimental" expanded={expanded} onToggleSize={onToggleSize} />
        </div>
      </div>
      <div className={`panel-content comparison-content${interpretation ? " with-interpretation" : ""}`}>
        <div className="comparison-selects">
          {(["a", "b"] as const).map((side) => (
            <label key={side}>
              <span className={`side side-${side}`} aria-hidden>{side.toUpperCase()}</span>
              <span className="sr-only">Corrida {side.toUpperCase()}</span>
              <select value={side === "a" ? a.id : b.id} onChange={(event) => selectRun(side, event.target.value)}>
                <optgroup label="Corridas y perfiles">
                  {runs.map((run) => <option value={run.id} key={run.id}>{run.label}{run.reference ? " (perfil nominal)" : ""}</option>)}
                </optgroup>
                {bibliographic.size > 0 && <optgroup label="Fichas sin cifras">
                  {[...bibliographic.values()].map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                </optgroup>}
              </select>
            </label>
          ))}
        </div>
        <div className="comparison-scroll" ref={tableRef}
          style={interpretation && tableHeight !== null ? { flex: `0 0 ${tableHeight}px` } : undefined}>
          <table>
            <thead><tr><th scope="col">Variable</th><th scope="col">Corrida A</th><th scope="col">Corrida B</th><th scope="col">{mode === "engineer" ? "Δ B − A" : "Diferencia"}</th></tr></thead>
            <tbody>
              {rows.map(({ field, valueA, valueB, nominalA, nominalB, status, delta, relativeDelta_pct, outcome }) => {
                const { decimals, unit } = "unit" in field ? field : { decimals: undefined, unit: undefined };
                const deltaUnit = "deltaUnit" in field ? field.deltaUnit : unit;
                const display = (value: typeof valueA) => field.id === "facility" && typeof value === "string" && Object.hasOwn(facilities, value)
                  ? facilities[value as Facility].label : formatValue(value, decimals, unit);
                return <tr key={field.id} data-status={status} data-outcome={outcome}>
                  <th scope="row">{field.label}</th>
                  <td>{display(valueA)}{nominalA && <small>Nominal</small>}</td>
                  <td>{display(valueB)}{nominalB && <small>Nominal</small>}</td>
                  <td>
                    {delta === undefined ? <span className="diff-status">{{
                      equal: "Igual", missing: "Sin dato", changed: "Cambió", nominal: "Valor nominal",
                    }[status]}</span> : (
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
        {(hasPsiProfile || hasBibliographic) && <div className="comparison-sources">
          <span>{hasPsiProfile && "Perfil PSI: condiciones publicadas."}{hasBibliographic && " Ficha sin cifras: —."}</span>
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
