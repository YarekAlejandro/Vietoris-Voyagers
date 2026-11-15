import { AlertTriangle, Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  interpretationKey, isInterpretation, localInterpretation,
  type InterpretRequest, type InterpretationResult,
} from "../../core/si-engine/interpret";
import { useAetherStore } from "../../store/useAetherStore";
import { computeCoverage } from "../../core/si-engine/scenario-coverage";
import { missionPresets } from "../../data/mission_presets";
import { psiDataset, runsById } from "../../data/psi";
import { assistantRequestTimeout_ms } from "../../lib/llm/timing";
import { jsonEventMediaType, readJsonEvents } from "../../lib/http/json-events";

// Evita llamadas duplicadas a la misma clave (por ejemplo, el doble efecto de React en desarrollo).
const inflight = new Set<string>();

async function requestInterpretation(request: InterpretRequest): Promise<{ result: InterpretationResult; failed: boolean }> {
  const atmosphere = request.kind === "rank" ? request.payload.target : request.scenario ?? missionPresets[0].atmosphere;
  const coverage = computeCoverage(atmosphere, psiDataset.runs);
  if (coverage.status === "ninguna") return { result: localInterpretation(request, coverage), failed: false };
  try {
    const response = await fetch("/api/interpret", {
      method: "POST",
      headers: { "content-type": "application/json", accept: jsonEventMediaType },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(assistantRequestTimeout_ms),
    });
    if (response.ok) {
      let data: unknown;
      if (response.headers.get("content-type")?.includes(jsonEventMediaType)) {
        await readJsonEvents<{ type: "interpretation"; result: unknown }>(response, (event) => {
          if (event.type === "interpretation") data = event.result;
        });
      } else {
        data = await response.json();
      }
      if (isInterpretation(data) && "source" in data && (data.source === "ai" || data.source === "template")) {
        return { result: data as InterpretationResult, failed: false };
      }
    }
  } catch {
    // Sin red o sin servidor: se usa la plantilla local.
  }
  return { result: localInterpretation(request, coverage), failed: true };
}

interface InterpretationCardProps {
  request: InterpretRequest;
  chips: ReactNode;
  stale?: boolean;
  onRefresh?: () => void;
}

export function InterpretationCard({ request, chips, stale = false, onRefresh }: InterpretationCardProps) {
  const key = interpretationKey(request);
  const result = useAetherStore((state) => state.interpretations[key]);
  const setInterpretation = useAetherStore((state) => state.setInterpretation);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load(force: boolean) {
    if (inflight.has(key) || (!force && useAetherStore.getState().interpretations[key])) return;
    inflight.add(key);
    setLoading(true);
    const outcome = await requestInterpretation(request);
    inflight.delete(key);
    setInterpretation(key, outcome.result);
    setFailed(outcome.failed);
    setLoading(false);
  }

  useEffect(() => {
    setFailed(false);
    void load(false);
    // La clave resume la petición: solo se carga cuando cambia.
  }, [key]);

  function copy() {
    if (!result) return;
    navigator.clipboard?.writeText([...result.paragraphs, ...result.caveats].join("\n\n"))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
      .catch(() => undefined);
  }

  return (
    <div className="interpretation" aria-live="polite" aria-busy={loading}>
      <div className="interpretation-heading">
        <h3><Sparkles size={14} aria-hidden /> Interpretación</h3>
        {result && <span className={`interpretation-badge ${result.source}`}>{result.source === "ai" ? "Resumen generado con validación" : "Plantilla determinista"}</span>}
        <div className="interpretation-actions">
          <button type="button" className="icon-button" aria-label="Regenerar interpretación" title="Regenerar" disabled={loading}
            onClick={() => (stale && onRefresh ? onRefresh() : void load(true))}>
            <RefreshCw size={13} aria-hidden className={loading ? "spinning" : undefined} />
          </button>
          <button type="button" className="icon-button" aria-label="Copiar interpretación" title={copied ? "Copiado" : "Copiar"} disabled={!result} onClick={copy}>
            {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          </button>
        </div>
      </div>
      {stale && <p className="interpretation-stale">
        La selección cambió desde esta interpretación.{" "}
        {onRefresh && <button type="button" className="quiet-button" onClick={onRefresh}>Regenerar</button>}
      </p>}
      {loading && !result && <p className="interpretation-loading">Generando interpretación…</p>}
      {failed && <p className="interpretation-note">No se pudo contactar al servicio; se muestra el resumen automático.</p>}
      {result && <div className="interpretation-body">
        {result.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {result.caveats.length > 0 && <ul className="interpretation-caveats">
          {result.caveats.map((caveat, index) => <li key={index}><AlertTriangle size={12} aria-hidden /> {caveat}</li>)}
        </ul>}
      </div>}
      <div className="interpretation-chips">{chips}{result?.fieldsUsed.flatMap((id) => {
        const run = runsById.get(id);
        return run ? [<a className="chip" key={id} href={run.source.url} target="_blank" rel="noreferrer">{run.label}</a>] : [];
      })}</div>
    </div>
  );
}
