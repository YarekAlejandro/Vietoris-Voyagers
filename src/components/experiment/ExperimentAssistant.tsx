"use client";

import { ArrowRight, Check, FlaskConical, LoaderCircle, Search, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ExperimentHypothesis } from "../../core/si-engine/experiment-hypotheses";
import { flowDirections, isNumberField, maxExperimentText, maxProfileText, numberFields, parseExperimentProfile, plainObject,
  profileFields, profileLabel, type ExperimentProfile, type ProfileField, type ProfileProposal } from "../../core/si-engine/experiment-profile";
import { jsonEventMediaType, readJsonEvents } from "../../lib/http/json-events";
import { assistantRequestTimeout_ms } from "../../lib/llm/timing";
import { defaultResultCount, maxResultCount, type ExperimentEvent, type ExperimentRequest, type ExperimentResults as SearchResults } from "../../types/experiment-assistant";
import { ExperimentResults } from "./ExperimentResults";
import styles from "./ExperimentAssistant.module.css";

type Phase = "extracting" | "searching" | "analyzing";
type Origin = { label: "Inferido por IA" | "Detectado en el texto" | "Editado" | "Ejemplo"; quote?: string };
type Origins = Partial<Record<ProfileField, Origin>>;
type Turn = { text: string; detail: string };

const sessionKey = "aether-experiment-assistant-v1";
const phaseLabels: Record<Phase, string> = {
  extracting: "Interpretando experimento…", searching: "Buscando en PSI…", analyzing: "Analizando el respaldo de las hipótesis…",
};
const advancedFields: ProfileField[] = ["temperature_c", "ignition", "diluent", "thickness_mm", "width_cm", "diameter_mm"];

const examples: { label: string; description: string; profile: ExperimentProfile }[] = [
  {
    label: "Extinción en tejido SIBAL",
    description: "Quiero estudiar la extinción de una lámina de SIBAL. O₂ 18.7%, presión 101.3 kPa, flujo concurrente a 2.2 cm/s, gravedad 0 g y espesor 0.32 mm.",
    profile: { material: "SIBAL", geometry: "Lámina de tejido", oxygen_pct: 18.7, pressure_kpa: 101.3, flow_cm_s: 2.2,
      flowDirection: "concurrente", gravity_g: 0, thickness_mm: 0.32, objective: "Extinción de llama en tejido a bajo flujo" },
  },
  {
    label: "Llama en una gota de metanol",
    description: "Quiero observar la extinción de una gota aislada de metanol. Diámetro inicial 2.54 mm. O₂ 21%, presión 101.3 kPa, 0 cm/s, sin flujo y gravedad 0 g.",
    profile: { material: "Metanol", geometry: "Gota aislada", diameter_mm: 2.54, oxygen_pct: 21,
      pressure_kpa: 101.3, flow_cm_s: 0, flowDirection: "sin flujo", gravity_g: 0, objective: "Extinción de la llama visible de una gota" },
  },
  {
    label: "Propagación en una placa de PMMA",
    description: "Quiero estudiar propagación de llama en una placa de PMMA con O₂ 28.8%, presión 55.2 kPa, flujo concurrente de 20 cm/s y gravedad 0.165 g.",
    profile: { material: "PMMA", geometry: "Placa", oxygen_pct: 28.8, pressure_kpa: 55.2, flow_cm_s: 20,
      flowDirection: "concurrente", gravity_g: 0.165, objective: "Propagación de llama en plástico a gravedad parcial" },
  },
];

function profileKey(profile: ExperimentProfile, limit: string) {
  return JSON.stringify([limit, ...profileFields.map((field) => profile[field] ?? null)]);
}

export function ExperimentAssistant() {
  const [profile, setProfile] = useState<ExperimentProfile>({});
  const [origins, setOrigins] = useState<Origins>({});
  const [draft, setDraft] = useState("");
  const [interpretedDraft, setInterpretedDraft] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [limit, setLimit] = useState(String(defaultResultCount));
  const [phase, setPhase] = useState<Phase | null>(null);
  const [result, setResult] = useState<SearchResults | null>(null);
  const [lastSearch, setLastSearch] = useState("");
  const [hypotheses, setHypotheses] = useState<ExperimentHypothesis[]>([]);
  const [hypothesisSource, setHypothesisSource] = useState<"ai" | "local" | undefined>();
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const active = useRef<AbortController | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const status = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(sessionKey) ?? "null");
      if (plainObject(saved)) {
        const previous = parseExperimentProfile(saved.profile);
        if (previous) setProfile(previous);
        if (plainObject(saved.origins)) setOrigins(saved.origins as Origins);
        if (typeof saved.draft === "string") setDraft(saved.draft.slice(0, maxExperimentText));
        if (typeof saved.interpretedDraft === "string") setInterpretedDraft(saved.interpretedDraft.slice(0, maxExperimentText));
        if (typeof saved.limit === "string" && /^\d{1,2}$/.test(saved.limit)) setLimit(saved.limit);
        if (Array.isArray(saved.history)) setHistory(saved.history.filter((turn): turn is Turn =>
          plainObject(turn) && typeof turn.text === "string" && typeof turn.detail === "string").slice(-12));
      }
    } catch {
      // La sesión sigue disponible en memoria si el almacenamiento del navegador está bloqueado.
    }
    setRestored(true);
    return () => active.current?.abort();
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({ profile, origins, draft, interpretedDraft, history, limit }));
    } catch {
      // El formulario se mantiene operativo aunque el almacenamiento local esté deshabilitado.
    }
  }, [restored, profile, origins, draft, interpretedDraft, history, limit]);

  const hasUnreviewedText = draft.trim() !== "" && draft.trim() !== interpretedDraft;
  const filled = profileFields.filter((field) => profile[field] !== undefined).length;
  const busy = phase !== null;

  async function send(input: ExperimentRequest, handle: (event: ExperimentEvent) => void) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setError("");
    setPhase(input.action === "extract" ? "extracting" : "searching");
    let completed = false;
    try {
      const response = await fetch("/api/experiment-assistant", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: jsonEventMediaType },
        body: JSON.stringify(input), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(assistantRequestTimeout_ms)]),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message = plainObject(body) && typeof body.error === "string" ? body.error : "No se pudo iniciar la solicitud.";
        throw new Error(message);
      }
      await readJsonEvents<ExperimentEvent>(response, (event) => {
        if (controller.signal.aborted) return;
        if (event.type === "done") completed = true;
        if (event.type === "stage") setPhase(event.stage);
        if (event.type === "error") setError(event.message);
        handle(event);
      });
      if (!completed && !controller.signal.aborted) throw new Error("La conexión se cerró antes de completar la respuesta.");
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error && failure.name === "TimeoutError"
        ? "La respuesta tardó demasiado. Puedes volver a intentarlo."
        : failure instanceof Error && failure.name !== "TypeError" ? failure.message : "Se perdió la conexión. Revisa la red e inténtalo de nuevo.");
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPhase(null);
      }
    }
  }

  function applyProposal(proposal: ProfileProposal, source: "ai" | "local", text: string) {
    setProfile(proposal.profile);
    setInterpretedDraft(text);
    setOrigins((previous) => {
      const next = { ...previous };
      for (const field of proposal.cleared) delete next[field];
      for (const field of profileFields) {
        const quote = proposal.evidence[field];
        if (quote && proposal.profile[field] !== undefined) next[field] = { label: source === "ai" ? "Inferido por IA" : "Detectado en el texto", quote };
      }
      return next;
    });
    const changed = profileFields.filter((field) => profile[field] !== proposal.profile[field]);
    const detail = changed.length ? changed.map(profileLabel).join(", ") : "El perfil conserva los mismos valores.";
    setHistory((turns) => [...turns, { text, detail }].slice(-12));
  }

  async function extract() {
    const text = draft.trim();
    if (!text || active.current) return;
    const valid = parseExperimentProfile(profile);
    if (!valid) {
      setError("Corrige los valores del formulario antes de interpretar el texto.");
      return;
    }
    setNotice("");
    await send({ action: "extract", text, profile: valid }, (event) => {
      if (event.type !== "profile") return;
      applyProposal(event.proposal, event.source, text);
      setNotice(event.notice ?? (Object.keys(event.proposal.evidence).length ? "Revisa los cambios antes de buscar en PSI."
        : "No se encontraron campos nuevos en este mensaje. Puedes completarlos en el formulario."));
      reviewHeading.current?.focus();
    });
  }

  function edit(field: ProfileField, value: string) {
    setProfile((previous) => {
      const next = { ...previous };
      if (!value.trim()) delete next[field];
      else Object.assign(next, { [field]: isNumberField(field) ? Number(value) : value });
      return next;
    });
    setOrigins((previous) => ({ ...previous, [field]: value.trim() ? { label: "Editado" } : undefined }));
  }

  function loadExample(example: (typeof examples)[number]) {
    setProfile(example.profile);
    setDraft(example.description);
    setInterpretedDraft(example.description);
    setOrigins(Object.fromEntries(Object.keys(example.profile).map((field) => [field, { label: "Ejemplo" }])));
    setNotice("Ejemplo cargado. Puedes ajustar los valores antes de buscar.");
    setError("");
    setHistory((turns) => [...turns, { text: example.description, detail: example.label }].slice(-12));
    reviewHeading.current?.focus({ preventScroll: true });
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = parseExperimentProfile(profile);
    if (hasUnreviewedText || !valid || !filled || active.current) return;
    const resultCount = Number(limit);
    if (!Number.isInteger(resultCount) || resultCount < 1 || resultCount > maxResultCount) return;
    setNote("");
    setHypotheses([]);
    setHypothesisSource(undefined);
    setResult(null);
    setNotice("");
    status.current?.focus({ preventScroll: true });
    void send({ action: "search", profile: valid, limit: resultCount }, (item) => {
      if (item.type === "results") {
        setLastSearch(profileKey(valid, limit));
        setResult(item.result);
      }
      if (item.type === "hypotheses") {
        setHypotheses(item.hypotheses);
        setHypothesisSource(item.source);
        setNote(item.note ?? "");
      }
      if (item.type === "error") setNote("Análisis de hipótesis incompleto.");
    });
  }

  function fieldControl(field: ProfileField) {
    const origin = origins[field];
    const value = profile[field] ?? "";
    const id = `experiment-field-${field}`;
    const label = profileLabel(field);
    const attrs = { id, value, "aria-describedby": origin ? `${id}-origin` : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => edit(field, event.target.value) };
    return <div className={`${styles.field} ${field === "objective" ? styles.wide : ""}`} key={field}>
      <label htmlFor={id}>{label}{isNumberField(field) && <small>{numberFields[field].unit}</small>}</label>
      {isNumberField(field) ? <input {...attrs} type="number" step="any" min={numberFields[field].min} max={numberFields[field].max} placeholder="No especificado" />
        : field === "flowDirection" ? <select {...attrs}>
          <option value="">No especificado</option>
          {flowDirections.map((direction) => <option key={direction}>{direction}</option>)}
        </select> : field === "objective" ? <textarea {...attrs} rows={2} placeholder="No especificado" maxLength={maxProfileText} />
          : <input {...attrs} type="text" maxLength={maxProfileText} placeholder="No especificado" />}
      {origin && <small className={styles.origin} id={`${id}-origin`} title={origin.quote ? `Texto de origen: «${origin.quote}»` : undefined}>
        {origin.label}{origin.quote && <span className="sr-only">. Texto de origen: {origin.quote}</span>}
      </small>}
    </div>;
  }

  return <main className={styles.workspace}>
    <header className={styles.hero}>
      <div>
        <p className={styles.eyebrow}><FlaskConical size={15} aria-hidden /> Asistente IA para investigación</p>
        <h1>Diseña tu experimento con evidencia</h1>
        <p>Describe un ensayo de combustión, revisa los parámetros y encuentra investigaciones comparables en NASA PSI.</p>
      </div>
      <div className={styles.examples} role="group" aria-label="Ejemplos de experimentos">
        <span>Explorar un ejemplo</span>
        {examples.map((example) => <button key={example.label} type="button" disabled={busy} onClick={() => loadExample(example)}>
          {example.label} <ArrowRight size={14} aria-hidden />
        </button>)}
      </div>
    </header>

    <div className={styles.columns}>
      <div className={styles.inputPane}>
        <section className={styles.describe} aria-labelledby="experiment-description-title">
          <h2 id="experiment-description-title"><Sparkles size={18} aria-hidden /> Descripción o refinamiento</h2>
          <label className="sr-only" htmlFor="experiment-message">Descripción del experimento</label>
          <textarea id="experiment-message" value={draft} disabled={busy} maxLength={maxExperimentText} rows={4}
            placeholder="Describe el material, las condiciones y qué quieres estudiar. También puedes escribir «¿Y si bajo el O₂ a 18%?»." onChange={(event) => setDraft(event.target.value)} />
          <div className={styles.describeActions}>
            <button type="button" className={styles.secondary} onClick={() => void extract()} disabled={busy || !draft.trim()}>Interpretar texto</button>
            {draft && <button type="button" className={styles.tertiary} onClick={() => { setDraft(""); setInterpretedDraft(""); }} disabled={busy}>Limpiar texto</button>}
          </div>
          {history.length > 0 && <details className={styles.history}>
            <summary>Historial de refinamientos ({history.length})</summary>
            <ol>{history.map((turn, index) => <li key={index}><p>{turn.text}</p><small>{turn.detail}</small></li>)}</ol>
          </details>}
        </section>

        <form className={styles.profile} onSubmit={search}>
          <div className={styles.paneHeading}>
            <h2 tabIndex={-1} ref={reviewHeading}><FlaskConical size={18} aria-hidden /> Revisa el perfil</h2>
            <span>{filled} de {profileFields.length} campos</span>
          </div>
          {notice && <p className={styles.notice} role="status"><Check size={14} aria-hidden /> {notice}</p>}
          <fieldset disabled={busy}>
            <legend className="sr-only">Parámetros del experimento</legend>
            <div className={styles.fields}>{profileFields.filter((field) => !advancedFields.includes(field)).map(fieldControl)}</div>
            <details className={styles.advanced} open={advancedFields.some((field) => profile[field] !== undefined) || undefined}>
              <summary>Dimensiones y condiciones adicionales</summary>
              <div className={styles.fields}>{advancedFields.map(fieldControl)}</div>
            </details>
            <div className={styles.searchActions}>
              <label htmlFor="experiment-results-limit">Número de resultados
                <input id="experiment-results-limit" type="number" min={1} max={maxResultCount} value={limit} step={1} required onChange={(event) => setLimit(event.target.value)} />
              </label>
              <button type="submit" className={styles.primary} disabled={busy || !filled || hasUnreviewedText}><Search size={16} aria-hidden /> Confirmar perfil y buscar</button>
            </div>
          </fieldset>
          {hasUnreviewedText && <p className={styles.hint}>Interpreta el texto nuevo para revisarlo, o límpialo para buscar con el formulario.</p>}
        </form>
        <div tabIndex={-1} ref={status} aria-live="polite" className={styles.operation}>
          {phase && <div><LoaderCircle size={16} className="spinning" aria-hidden /> {phaseLabels[phase]}
            <button type="button" className={styles.tertiary} onClick={() => { active.current?.abort(); setNotice("Solicitud cancelada."); }}>Cancelar</button>
          </div>}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>

      <ExperimentResults result={result} hypotheses={hypotheses} hypothesisSource={hypothesisSource} note={note}
        resultStale={Boolean(lastSearch && (lastSearch !== profileKey(profile, limit) || hasUnreviewedText))} searching={phase === "searching"} />
    </div>
  </main>;
}
