import { ArrowLeftRight, ExternalLink, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { compareRuns } from "../../core/si-engine/git-diff";
import { buildDiffPayload, interpretationKey, type InterpretRequest } from "../../core/si-engine/interpret";
import { investigationsById, psiDataset, runsById } from "../../data/psi";
import { useAetherStore } from "../../store/useAetherStore";
import { InterpretationCard } from "./InterpretationCard";
import { SplitHandle } from "./SplitHandle";

// Mínimos del reparto entre la tabla y la interpretación: encabezado y una fila / título y algo de texto.
const minTableHeight = 72;
const minInterpretationHeight = 96;

function formatValue(value: number | string | undefined, decimals = 0, unit = "") {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return unit ? `${value.toFixed(decimals)} ${unit}` : value.toFixed(decimals);
}

export function ExperimentGitDiff() {
  const comparison = useAetherStore((state) => state.comparison);
  const mode = useAetherStore((state) => state.mode);
  const selectRun = useAetherStore((state) => state.selectRun);
  // Petición con la que se abrió la interpretación; si A, B o el modo cambian, queda desactualizada.
  const [opened, setOpened] = useState<InterpretRequest | null>(null);
  // Alto de la tabla fijado con el divisor; null reparte por mitades.
  const [tableHeight, setTableHeight] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const interpretationRef = useRef<HTMLDivElement>(null);
  const a = runsById.get(comparison.a);
  const b = runsById.get(comparison.b);
  if (!a || !b) return null;
  const rows = compareRuns(a, b, investigationsById).filter(({ valueA, valueB }) => valueA !== undefined || valueB !== undefined);
  const current: InterpretRequest = { kind: "diff", payload: buildDiffPayload(a, b, rows, investigationsById), mode, lang: "es" };
  const stale = opened !== null && interpretationKey(opened) !== interpretationKey(current);

  return (
    <section className="panel comparison" aria-labelledby="comparison-title">
      <div className="panel-heading">
        <h2 id="comparison-title"><ArrowLeftRight size={17} aria-hidden /> Comparación experimental</h2>
        <div className="panel-heading-actions">
          {mode === "engineer" && <span className="panel-meta">Git-Diff · A/B</span>}
          <button type="button" className="interpret-toggle" aria-expanded={opened !== null} onClick={() => {
            setOpened(opened ? null : current);
            setTableHeight(null);
          }}>
            <Sparkles size={13} aria-hidden /> {opened ? "Ocultar interpretación" : "Interpretar"}
          </button>
        </div>
      </div>
      <div className={`panel-content comparison-content${opened ? " with-interpretation" : ""}`}>
        <div className="comparison-selects">
          {(["a", "b"] as const).map((side) => (
            <label key={side}>
              <span className={`side side-${side}`} aria-hidden>{side.toUpperCase()}</span>
              <span className="sr-only">Corrida {side.toUpperCase()}</span>
              <select value={comparison[side]} onChange={(event) => selectRun(side, event.target.value)}>
                {psiDataset.runs.map((run) => <option value={run.id} key={run.id}>{run.label}{run.reference ? " (perfil nominal)" : ""}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="comparison-scroll" ref={tableRef}
          style={opened && tableHeight !== null ? { flex: `0 0 ${tableHeight}px` } : undefined}>
          <table>
            <thead><tr><th scope="col">Variable</th><th scope="col">Corrida A</th><th scope="col">Corrida B</th><th scope="col">{mode === "engineer" ? "Δ B − A" : "Diferencia"}</th></tr></thead>
            <tbody>
              {rows.map(({ field, valueA, valueB, nominalA, nominalB, status, delta, relativeDelta_pct, outcome }) => {
                const { decimals, unit } = "unit" in field ? field : { decimals: undefined, unit: undefined };
                const deltaUnit = "deltaUnit" in field ? field.deltaUnit : unit;
                return <tr key={field.id} data-status={status} data-outcome={outcome}>
                  <th scope="row">{field.label}</th>
                  <td>{formatValue(valueA, decimals, unit)}{nominalA && <small>Nominal</small>}</td>
                  <td>{formatValue(valueB, decimals, unit)}{nominalB && <small>Nominal</small>}</td>
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
        {opened?.kind === "diff" && <SplitHandle
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
        {opened?.kind === "diff" && <div className="comparison-interpretation" ref={interpretationRef}><InterpretationCard
          request={opened}
          stale={stale}
          onRefresh={() => setOpened(current)}
          chips={<>
            {[opened.payload.runs.a, opened.payload.runs.b].map((run, index) => (
              <a key={index} className="chip" href={run.source.url} target="_blank" rel="noreferrer">{`Fuente ${index === 0 ? "A" : "B"} · ${run.source.label}`} <ExternalLink size={10} aria-hidden /></a>
            ))}
            <span className="chip">Motor local · {opened.payload.rows.length} filas del diff</span>
          </>}
        /></div>}
        {(a.nominal || b.nominal) && <div className="comparison-sources">
          {a.nominal && <span>{a.nominal.basis === b.nominal?.basis ? "A/B" : "A"} · {a.nominal.basis}</span>}
          {b.nominal && b.nominal.basis !== a.nominal?.basis && <span>B · {b.nominal.basis}</span>}
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
