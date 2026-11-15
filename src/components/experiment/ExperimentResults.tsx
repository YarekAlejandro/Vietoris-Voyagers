import { ArrowUpRight, Database, FlaskConical, Lightbulb, Search } from "lucide-react";
import type { ExperimentHypothesis } from "../../core/si-engine/experiment-hypotheses";
import type { ExperimentRecommendation, ParameterMatch } from "../../core/si-engine/experiment-retrieval";
import type { ExperimentResults as SearchResults } from "../../types/experiment-assistant";
import styles from "./ExperimentAssistant.module.css";

const number = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });
const statusLabels = { match: "Coincide", different: "Difiere", missing: "Sin dato" };

function quantity(value: ParameterMatch["recorded"], unit?: string) {
  if (value === null) return "Sin dato";
  return typeof value === "number" ? `${number.format(value)}${unit ? ` ${unit}` : ""}` : value;
}

function deltaText(row: ParameterMatch) {
  const { delta, unit, tolerance } = row;
  if (delta === undefined || tolerance === undefined) return statusLabels[row.status];
  const deltaUnit = row.field === "oxygen_pct" ? "pp" : unit;
  return `${statusLabels[row.status]} · Δ ${delta > 0 ? "+" : ""}${quantity(delta, deltaUnit)} (±${quantity(tolerance, deltaUnit)})`;
}

function Recommendation({ item, first }: { item: ExperimentRecommendation; first: boolean }) {
  return <li className={styles.recommendation}>
    <div className={styles.resultTitle}>
      <div>
        <p className={styles.psiRecord}><Database size={13} aria-hidden /> Dato respaldado por PSI · {item.accession}</p>
        <h3>{item.title}</h3>
      </div>
      <div className={styles.score} aria-label={`Relevancia ${item.relevance_pct} de 100`}>
        <strong>{item.relevance_pct}<small>/100</small></strong>
        <span>Relevancia</span>
      </div>
    </div>
    <div className={styles.metrics}>
      {item.conditions_pct !== null && <span>Condiciones <b>{item.conditions_pct}%</b></span>}
      {item.thematic_pct !== null && <span>Tema <b>{item.thematic_pct}%</b></span>}
      <a href={item.officialUrl} target="_blank" rel="noreferrer">Registro {item.accession} <ArrowUpRight size={14} aria-hidden /></a>
    </div>
    <p>{item.rationale.join(" ")}</p>
    {item.run && <p className={styles.observed}><b>Corrida {item.run.label}</b>
      {item.run.outcome ? ` · ${item.run.outcome}` : " · Sin resultado explícito en el registro indexado"}.
      {" "}<a href={item.run.source.url} target="_blank" rel="noreferrer">{item.run.source.label} <ArrowUpRight size={12} aria-hidden /></a></p>}
    <p><b>Qué puedes aprender.</b> {item.learning}</p>
    {item.parameters.length > 0 && <details className={styles.breakdown} open={first || undefined}>
      <summary>Desglose de condiciones</summary>
      <div className={styles.parameterTable}>
        <table>
          <thead><tr><th scope="col">Parámetro</th><th scope="col">Tu perfil</th><th scope="col">Registro</th><th scope="col">Comparación</th></tr></thead>
          <tbody>{item.parameters.map((row) => <tr key={row.field}>
            <th scope="row">{row.label}</th>
            <td>{quantity(row.query, row.unit)}</td><td>{quantity(row.recorded, row.unit)}</td>
            <td data-status={row.status}>{deltaText(row)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>}
    {item.metadata && <details className={styles.breakdown}>
      <summary>{item.metadata.label}</summary><blockquote>{item.metadata.text}</blockquote>
    </details>}
  </li>;
}

function Hypothesis({ item, source }: { item: ExperimentHypothesis; source?: "ai" | "local" }) {
  return <li className={styles.hypothesis}>
    <p className={styles.hypothesisLabel}><Lightbulb size={14} aria-hidden /> {source === "local" ? "Hipótesis del análisis local" : "Extrapolación de la IA"} · no es un resultado experimental</p>
    <h3>{item.claim}</h3>
    <div className={styles.hypothesisMeta}><span>Confianza <b>{item.confidence}</b></span><span>Método <b>{item.method}</b></span></div>
    <p>{item.reasoning}</p>
    <p><a href={item.principleSource.url} target="_blank" rel="noreferrer">{item.principleSource.label} <ArrowUpRight size={13} aria-hidden /></a></p>
    <div className={styles.assumptions}>
      <div><h4>Supuestos</h4><ul>{item.assumptions.map((text) => <li key={text}>{text}</li>)}</ul></div>
      <div><h4>Limitaciones</h4><ul>{item.limitations.map((text) => <li key={text}>{text}</li>)}</ul></div>
    </div>
    <h4>Corridas de respaldo</h4>
    <ul className={styles.support}>{item.support.map((run) => <li key={run.runId}>
      <a href={run.officialUrl} target="_blank" rel="noreferrer">{run.accession}</a> · {run.label} · {run.outcome}{" "}
      <a href={run.source.url} aria-label={`Fuente de ${run.label}`} target="_blank" rel="noreferrer"><ArrowUpRight size={13} aria-hidden /></a>
    </li>)}</ul>
  </li>;
}

interface ResultsProps {
  result: SearchResults | null;
  hypotheses: ExperimentHypothesis[];
  hypothesisSource?: "ai" | "local";
  note: string;
  resultStale: boolean;
  searching: boolean;
}

export function ExperimentResults({ result, hypotheses, hypothesisSource, note, resultStale, searching }: ResultsProps) {
  return <section className={styles.resultPane} aria-labelledby="experiment-results-title">
    <div className={styles.paneHeading}>
      <h2 id="experiment-results-title"><Database size={18} aria-hidden /> Resultados de PSI</h2>
      {result && <span>{result.origin === "live" ? "Catálogo en vivo" : "Copia de PSI"} · {result.indexedStudies} fichas examinadas</span>}
    </div>
    <p className="sr-only" role="status">{result ? `${result.recommendations.length} recomendaciones de PSI disponibles.` : ""}</p>
    {!result && <div className={styles.empty}>
      <span><Search size={30} aria-hidden /></span>
      <h3>{searching ? "Buscando evidencia experimental" : "La evidencia comienza con tu perfil"}</h3>
      <p>{searching ? "Estamos revisando los registros de combustión de PSI." : "Describe tu experimento o prueba uno de los ejemplos. Revisa los campos antes de buscar."}</p>
    </div>}
    {result && <>
      {resultStale && <p className={styles.notice} role="status">El perfil cambió después de esta búsqueda. Confírmalo para actualizar los resultados.</p>}
      {!result.recommendations.length
        ? <p className={styles.notice}>No se encontraron coincidencias suficientes en el catálogo. Prueba un objetivo o un material más explícito.</p>
        : <ol className={styles.recommendations}>{result.recommendations.map((item, index) => <Recommendation key={item.accession} item={item} first={index === 0} />)}</ol>}
      <section className={styles.hypothesisPane} aria-labelledby="experiment-hypothesis-title">
        <div className={styles.paneHeading}><h2 id="experiment-hypothesis-title"><FlaskConical size={18} aria-hidden /> Extrapolaciones cualitativas</h2></div>
        {note && <p className={styles.notice} role="status">{note}</p>}
        {hypotheses.length > 0 && <ul className={styles.hypotheses}>{hypotheses.map((item) => <Hypothesis key={item.id} item={item} source={hypothesisSource} />)}</ul>}
      </section>
    </>}
  </section>;
}
