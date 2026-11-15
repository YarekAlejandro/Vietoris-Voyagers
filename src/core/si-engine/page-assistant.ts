import { missionPresets } from "../../data/mission_presets";
import type { Atmosphere, Citation, EnvironmentPreset, ExperimentalRun, Investigation } from "../../types/psi";
import { sceneEvidenceForRun } from "./experiment-scene";
import { computeFSRS, rankRuns } from "./fsrs-ranker";
import { compareRuns, diffFields, summarizeChangedDrivers } from "./git-diff";
import { formatPsiQuantity } from "./live-psi-mapper";
import { computeCoverage, type ScenarioCoverage } from "./scenario-coverage";
import type { EvidenceSearchResults } from "./semantic-search";

type Selection = { kind: "study" | "run"; id: string };
type Comparison = { a: string; b: string };
export type AssistantTarget = "search" | "catalog" | "graph" | "inspector" | "coverage" | "comparison" | "atmosphere" | "scene" | "interpret";

export interface AssistantPointer {
  label: string;
  target: AssistantTarget;
  selection?: Selection;
  source?: Citation;
  comparison?: Comparison;
  profileId?: string;
  atmosphereField?: keyof Atmosphere;
  evidenceField?: string;
}

export interface PageAssistantAnswer {
  text: string;
  pointers: AssistantPointer[];
  mayClassify?: boolean;
}

export interface PageAssistantContext {
  studies: readonly Investigation[];
  runs: readonly ExperimentalRun[];
  search: (question: string) => EvidenceSearchResults;
  coverage: ScenarioCoverage;
  profile: EnvironmentPreset;
  atmosphere: Atmosphere;
  selection: Selection | null;
  comparison: Comparison;
  sceneEnabled?: boolean;
}

const searchPointer: AssistantPointer = { label: "Señalar el buscador", target: "search" };
const catalogPointer: AssistantPointer = { label: "Señalar el catálogo", target: "catalog" };
const comparisonPointer: AssistantPointer = { label: "Señalar comparación A/B", target: "comparison" };
const atmospherePointer: AssistantPointer = { label: "Señalar los controles de atmósfera", target: "atmosphere" };

function normalize(text: string) {
  return text.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function findMentions<T>(question: string, records: readonly T[], aliases: (record: T) => readonly (string | null | undefined)[]) {
  const sentence = ` ${question} `;
  const candidates = records.flatMap((record) => aliases(record).flatMap((alias) => {
    if (!alias) return [];
    const term = normalize(alias);
    if (!term) return [];
    const start = sentence.indexOf(` ${term} `);
    return start === -1 ? [] : [{ record, start, end: start + term.length }];
  })).sort((a, b) => a.start - b.start || b.end - a.end);

  return candidates.filter((candidate, index) => !candidates.slice(0, index).some((earlier) =>
    earlier.record === candidate.record || (earlier.start <= candidate.start && earlier.end >= candidate.end),
  )).map(({ record }) => record);
}

function studyAliases(study: Investigation) {
  const accession = study.psi?.accession ?? study.source.label.match(/\bPSI-\d+\b/i)?.[0];
  return [study.id, study.name, accession, study.importedPsi?.acronym];
}

function evidencePointer(item: ExperimentalRun | Investigation, target: AssistantPointer["target"] = "inspector"): AssistantPointer {
  const isRun = "investigationId" in item;
  const label = isRun ? item.label : item.importedPsi?.acronym ?? item.id;
  return {
    label: target === "scene" ? `Señalar escena · ${label}` : target === "graph" ? `Señalar en el grafo · ${label}` : `Señalar ficha · ${label}`,
    target, selection: { kind: isRun ? "run" : "study", id: item.id }, source: item.source,
  };
}

const atmosphereFields = [
  { id: "oxygen_pct", pattern: /\b(?:oxigeno|o2)\b/ },
  { id: "pressure_psia", pattern: /\bpresion\b/ },
  { id: "flow_velocity_cm_s", pattern: /\b(?:flujo|ventilacion|caudal)\b/ },
  { id: "gravity_g", pattern: /\bgravedad\b/ },
] as const;

const requestedFields = [
  { id: "extinction_droplet_diameter_mm", pattern: /\bdiametro\b.*\b(?:extincion|extingu|apag)\w*/ },
  { id: "initial_droplet_diameter_mm", pattern: /\bdiametro\b/ },
  { id: "burn_time_s", pattern: /\b(?:tiempo|duracion)\b.*\b(?:quemado|combustion)\b/ },
  { id: "cabin_heat_added_kj", pattern: /\bcalor\b.*\bcabina\b/ },
  { id: "thickness_mm", pattern: /\bespesor\b/ },
  ...atmosphereFields,
] as const;

function summarizeRun(run: ExperimentalRun, question: string): string {
  const requested = requestedFields.find(({ pattern }) => pattern.test(question));
  if (requested?.id === "initial_droplet_diameter_mm" && !/\binicial\b/.test(question) && run.initial_droplet_diameter_mm !== undefined) {
    const initial = `El diámetro inicial de la gota fue de ${run.initial_droplet_diameter_mm.toFixed(2)} mm.`;
    const extinction = run.extinction_droplet_diameter_mm === undefined ? "La ficha no indica el diámetro al extinguirse la llama visible."
      : `Al extinguirse la llama visible, la gota medía ${run.extinction_droplet_diameter_mm.toFixed(2)} mm.`;
    return `${run.label}. ${initial} ${extinction}`;
  }
  const field = requested && diffFields.find(({ id }) => id === requested.id);
  if (field && "unit" in field && "decimals" in field) {
    const id = field.id;
    const profile = run.psiProfile?.[id as keyof Atmosphere];
    if (profile) return `${run.label}. El perfil PSI indica ${formatPsiQuantity(profile, field.decimals)} para ${field.label.toLowerCase()}.`;
    const values = { ...run.atmosphere, ...run };
    const value = values[id];
    if (value === undefined) return `La ficha de ${run.label} no indica ${field.label.toLowerCase()}.`;
    const nominal = run.reference || run.nominal?.fields.some((axis) => axis === id);
    const provenance = nominal ? "Valor de referencia" : id === "cabin_heat_added_kj" ? "Estimación publicada" : "Valor registrado";
    return `${run.label}. ${provenance} para ${field.label.toLowerCase()} de ${value.toFixed(field.decimals)} ${field.unit}.`;
  }

  const origin = run.reference ? "Perfil de referencia." : run.psiProfile ? "Condiciones publicadas en el perfil PSI." : "Corrida documentada.";
  const details = [run.fuel ? `Material — ${run.fuel}` : undefined, run.configuration, run.outcome].filter(Boolean).join(" · ");
  return `${run.label}. ${origin}${details ? ` ${details.replace(/\.?$/, ".")}` : ""}`;
}

function answerEvidence(items: readonly (ExperimentalRun | Investigation)[], question: string): PageAssistantAnswer {
  const first = items[0];
  const summary = "investigationId" in first ? summarizeRun(first, question) : first.summary;
  const related = items.slice(1).map((item) => "investigationId" in item ? item.label : item.importedPsi?.acronym ?? item.id);
  const evidenceField = requestedFields.find(({ pattern }) => pattern.test(question))?.id;
  return {
    text: related.length ? `${summary} También encontré ${related.join(" y ")}.` : summary,
    pointers: items.map((item) => ({ ...evidencePointer(item), evidenceField: "investigationId" in item ? evidenceField : undefined })),
  };
}

function answerCoverage(question: string, context: PageAssistantContext): PageAssistantAnswer {
  const namedProfile = findMentions(question, missionPresets, (profile) => [profile.name, profile.id === "eva" ? "EVA" : undefined])[0];
  const useNamedProfile = namedProfile && namedProfile.id !== context.profile.id;
  const coverage = useNamedProfile ? computeCoverage(namedProfile.atmosphere, context.runs) : context.coverage;
  const profileName = useNamedProfile ? namedProfile.name : context.profile.name;
  const closest = coverage.closest;
  const status = coverage.status === "ninguna" ? `El catálogo no ofrece cobertura directa para ${profileName}.`
    : `La cobertura para ${profileName} es ${coverage.status}.`;
  const nearby = coverage.withinTolerance === 1 ? "1 corrida cumple" : `${coverage.withinTolerance} corridas cumplen`;
  const run = closest && context.runs.find(({ id }) => id === closest.runId);

  return {
    text: `${status} ${nearby} las tolerancias de comparación.${closest ? ` La corrida más cercana es ${closest.label}.` : ""}`,
    pointers: [
      { label: "Señalar la cobertura", target: "coverage", profileId: useNamedProfile ? namedProfile.id : undefined },
      ...(run ? [evidencePointer(run)] : []),
    ],
  };
}

function answerComparison(runs: readonly ExperimentalRun[], context: PageAssistantContext, interpret: boolean): PageAssistantAnswer {
  const [a, b] = runs.length === 2 ? runs : [context.runs.find(({ id }) => id === context.comparison.a), context.runs.find(({ id }) => id === context.comparison.b)];
  if (!a || !b) return { text: "Elige dos corridas en el comparador para revisar sus diferencias.", pointers: [comparisonPointer] };

  const comparison = { a: a.id, b: b.id };
  const measured = ![a, b].some((run) => run.reference || run.psiProfile);
  const panelPointer = interpret && measured
    ? { label: "Señalar Interpretar", target: "interpret" as const, comparison }
    : { ...comparisonPointer, comparison };
  const pointers = [panelPointer, evidencePointer(a), ...(a.id === b.id ? [] : [evidencePointer(b)])];
  if (!measured) return {
    text: `La comparación de ${a.label} y ${b.label} incluye condiciones de referencia. La tabla distingue su procedencia.`, pointers,
  };

  const rows = compareRuns(a, b, new Map(context.studies.map((study) => [study.id, study])));
  const { changedVariables, confounded } = summarizeChangedDrivers(rows);
  const deltas = rows.flatMap(({ field, delta, outcome }) => !outcome && delta !== undefined && "unit" in field
    ? [`${field.label} ${delta > 0 ? "+" : ""}${delta.toFixed(field.decimals)} ${"deltaUnit" in field ? field.deltaUnit : field.unit}`] : []);
  const changes = changedVariables.length ? ` Cambiaron ${changedVariables.join(", ").toLowerCase()}.`
    : " La tabla muestra los valores disponibles para ambas corridas.";
  return {
    text: `A es ${a.label} y B es ${b.label}.${changes}${deltas.length ? ` Diferencias de B respecto a A (${deltas.slice(0, 3).join(" · ")}).` : ""}${confounded ? " Las condiciones cambiaron a la vez y la tabla no permite atribuir el resultado a una sola variable." : ""}`,
    pointers,
  };
}

export function answerPageQuestion(question: string, context: PageAssistantContext): PageAssistantAnswer {
  const normalized = normalize(question);
  const runs = findMentions(normalized, context.runs, (run) => [run.id, run.label]);
  const studies = findMentions(normalized, context.studies, studyAliases);
  const selectedRun = context.selection?.kind === "run" ? context.runs.find(({ id }) => id === context.selection?.id) : undefined;
  const selectedStudy = context.studies.find(({ id }) => id === (selectedRun?.investigationId ?? context.selection?.id));
  const explicit = runs[0] ?? studies[0];
  const explicitStudy = runs[0] ? context.studies.find(({ id }) => id === runs[0].investigationId) : studies[0];
  const current = selectedRun ?? selectedStudy;
  const navigation = /\b(?:como|donde|muestrame|senala(?:me)?|ubic(?:a|ame)|abre|abrir|ir a|lleva(?:me)?|puedo ver|encuentro)\b/.test(normalized);
  const unmatchedId = question.match(/\b[A-Z][\w]*(?:[-‐‑–][\w]+)+\b/gi)?.find((candidate) => {
    if (!/\d/.test(candidate)) return false;
    const id = normalize(candidate);
    if (!id.startsWith("psi ") && !studies.some((study) => id.startsWith(`${normalize(study.id)} `))) return false;
    return !runs.some((run) => normalize(run.id) === id) &&
      !studies.some((study) => studyAliases(study).some((alias) => alias && normalize(alias) === id));
  });
  if (unmatchedId) return {
    text: `No encontré ${unmatchedId} en el catálogo. Puedes comprobar el identificador con la búsqueda semántica.`, pointers: [searchPointer],
  };

  if (/\b(?:interpretar|interpretacion|interpreta|comparar|comparame|compara|comparacion|git diff|entre a y b|a b)\b/.test(normalized) ||
    (explicit && /\b(?:diferencias?|cambios? entre)\b/.test(normalized))) {
    const interpret = /\binterpret\w*\b/.test(normalized);
    if (runs.length > 2 || (explicit && runs.length !== 2)) return {
      text: "Indica los nombres o identificadores de dos corridas para compararlas.", pointers: [comparisonPointer, catalogPointer],
    };
    return answerComparison(runs, context, interpret);
  }

  if (/\b(?:escena|3d|webgl|montaje 3d)\b/.test(normalized)) {
    if (context.sceneEnabled === false) {
      return { text: "El visor de escenas está desactivado en esta versión. Las mediciones publicadas siguen disponibles en las fichas.", pointers: [catalogPointer] };
    }
    const study = studies[0] ?? selectedStudy;
    const run = runs[0] ?? (explicit ? undefined : selectedRun)
      ?? context.runs.find((entry) => entry.investigationId === study?.id && sceneEvidenceForRun(entry));
    if (run && sceneEvidenceForRun(run)) return {
      text: `La ficha de ${run.label} incluye una escena ilustrativa que puedes abrir en 3D o 2D.`,
      pointers: [evidencePointer(run, "scene")],
    };
    return { text: "La escena está disponible en corridas documentadas con un montaje representable. Puedes elegir otra corrida en el catálogo.", pointers: [catalogPointer] };
  }

  if (/\b(?:grafo|psi nexus|nodo|relaciones)\b/.test(normalized) && (navigation || !explicit)) return {
    text: "PSI‑Nexus muestra las conexiones entre investigaciones, corridas, instalaciones y temas.",
    pointers: explicit ? [evidencePointer(explicit, "graph")] : [{ label: "Señalar PSI‑Nexus", target: "graph" }],
  };
  const atmosphereField = atmosphereFields.find(({ pattern }) => pattern.test(normalized))?.id;
  if (navigation && /\b(?:cambi(?:o|ar)|ajust\w*|modific\w*|atmosfera|control(?:es)?)\b/.test(normalized) &&
    (atmosphereField || /\b(?:atmosfera|escenario)\b/.test(normalized))) return {
    text: "Abre Atmósfera en la ficha para ajustar el oxígeno, la presión absoluta, el flujo o la gravedad del escenario.",
    pointers: [{ ...atmospherePointer, atmosphereField }],
  };
  if (navigation && /\b(?:buscador|buscar|busqueda)\b/.test(normalized) && !explicit) return {
    text: "Usa Búsqueda semántica para encontrar un estudio, una corrida o un tema en español o inglés.", pointers: [searchPointer],
  };
  if (navigation && /\bcatalogo\b/.test(normalized) && !explicit) return {
    text: "El catálogo alterna entre Estudios y Corridas y permite filtrar por instalación y tema.", pointers: [catalogPointer],
  };
  if (navigation && /\bficha\b/.test(normalized) && !explicit && current) return answerEvidence([current], normalized);
  if (/\bcobertura\b|\b(?:evidencia|mediciones?|datos)\b.*\b(?:escenario|traje eva|rover lunar|base lunar artemis)\b/.test(normalized)) {
    return answerCoverage(normalized, context);
  }

  if (/\b(?:fsrs|puntaje|similitud|ranking|relevante)\b/.test(normalized)) {
    const explanation = "El FSRS ordena la similitud con el escenario activo usando oxígeno, presión absoluta, flujo, gravedad y contexto del estudio.";
    const study = explicitStudy ?? selectedStudy;
    if (!explicit && /\b(?:mas|mejor|primera|primero)\b/.test(normalized)) {
      const ranked = rankRuns(context.runs.filter((run) => !run.reference && (run.psiProfile || Object.keys(run.atmosphere).length)),
        new Map(context.studies.map((item) => [item.id, item])), context.profile, context.atmosphere)[0];
      if (ranked) return {
        text: `${ranked.run.label} tiene la mayor similitud entre los registros del área activa (${ranked.score.toFixed(1)} de 100 puntos). ${explanation}`,
        pointers: [evidencePointer(ranked.run), catalogPointer],
      };
    }
    if (explicit || /\b(?:por que|este|esta|actual)\b/.test(normalized)) {
      const run = runs[0] ?? (explicit ? undefined : selectedRun);
      const evidenceRuns = (run ? [run] : context.runs.filter(({ investigationId }) => investigationId === study?.id)).filter(({ reference }) => !reference);
      if (evidenceRuns.length && study) {
        const score = computeFSRS({ study, runs: evidenceRuns }, context.atmosphere, context.profile.priority).score;
        return { text: `${run?.label ?? study.id} tiene ${score.toFixed(1)} de 100 puntos. ${explanation}`,
          pointers: [evidencePointer(run ?? study), catalogPointer] };
      }
    }
    return { text: explanation, pointers: [catalogPointer] };
  }

  if (explicit) return answerEvidence(runs.length ? runs.slice(0, 2) : studies.slice(0, 2), normalized);
  if (current && (/\b(?:esta corrida|este estudio|esta ficha|seleccionad[oa]|ficha actual)\b/.test(normalized) ||
    (/\b(?:su|sus)\b/.test(normalized) && requestedFields.some(({ pattern }) => pattern.test(normalized))))) {
    return answerEvidence([current], normalized);
  }

  const query = normalized.replace(/\b(?:ayuda(?:me)?|buscar|buscarme|comparame|cuales?|cuentame|datos|dime|documentan|documentaron|encuentro|estudiaron|explica(?:me)?|ficha|hallazgos|informacion|midieron|investigaron|medicion(?:es)?|muestrame|observacion(?:es)?|sabemos|senala(?:me)?|tienes?)\b/g, " ");
  const hits = context.search(query);
  if (/\b(?:corridas?|mediciones?|midieron|reportaron)\b/.test(normalized)) {
    const matches = [...hits.runs].sort(([, a], [, b]) => b.score - a.score)
      .flatMap(([id]) => context.runs.filter((run) => run.id === id)).slice(0, 2);
    if (matches.length) return answerEvidence(matches, normalized);
  }
  const matches = [...hits.studies].sort(([, a], [, b]) => b.score - a.score)
    .flatMap(([id]) => context.studies.filter((study) => study.id === id)).slice(0, 2);
  if (matches.length) return answerEvidence(matches, normalized);

  return { text: "No encontré evidencia en el catálogo para esa pregunta. Prueba con el nombre de un estudio, un identificador de corrida o un tema como humo y polvo.",
    pointers: [searchPointer], mayClassify: true };
}

const intentQuestions: Record<AssistantTarget, string> = {
  search: "¿Dónde está el buscador?",
  catalog: "¿Dónde está el catálogo?",
  graph: "Muéstrame el grafo",
  inspector: "¿Qué muestra la ficha actual?",
  coverage: "¿Cuál es la cobertura?",
  comparison: "¿Qué cambió entre A y B?",
  atmosphere: "¿Dónde ajusto la atmósfera?",
  scene: "¿Dónde está la escena 3D?",
  interpret: "¿Dónde puedo interpretar A/B?",
};

export function answerAssistantIntent(intent: AssistantTarget, context: PageAssistantContext) {
  return answerPageQuestion(intentQuestions[intent], context);
}
