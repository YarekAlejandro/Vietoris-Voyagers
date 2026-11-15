import { missionPresets } from "../../data/mission_presets";
import type { Atmosphere, Citation, EnvironmentPreset, ExperimentalRun, Investigation } from "../../types/psi";
import { sceneEvidenceForRun } from "./experiment-scene";
import { computeFSRS, rankRuns } from "./fsrs-ranker";
import { compareRuns, diffFields, summarizeChangedDrivers } from "./git-diff";
import { formatPsiQuantity } from "./live-psi-mapper";
import { computeCoverage, type ScenarioCoverage } from "./scenario-coverage";
import type { EvidenceSearchResults } from "./semantic-search";
import { findAssistantHistory, formatAssistantHistory, isAssistantHistoryQuestion } from "./assistant-history";

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
  sources?: readonly Citation[];
  origin?: "ai" | "local";
  unanswered?: boolean;
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
    const matches = [];
    for (let start = sentence.indexOf(` ${term} `); start !== -1; start = sentence.indexOf(` ${term} `, start + 1)) {
      matches.push({ record, start, end: start + term.length });
    }
    return matches;
  })).sort((a, b) => a.start - b.start || b.end - a.end);

  const accepted: typeof candidates = [];
  for (const candidate of candidates) {
    if (!accepted.some((earlier) => earlier.record === candidate.record ||
      (earlier.start <= candidate.start && earlier.end >= candidate.end))) accepted.push(candidate);
  }
  return accepted.map(({ record }) => record);
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

export function comparisonNarrative(a: ExperimentalRun, b: ExperimentalRun, studies: ReadonlyMap<string, Investigation>) {
  const rows = compareRuns(a, b, studies);
  const { confounded } = summarizeChangedDrivers(rows);
  const matching = (id: string) => rows.find(({ field, status }) => field.id === id && status === "equal");
  const purpose = (run: ExperimentalRun) => {
    const scope = run.topics?.includes("flame-spread") && studies.get(run.investigationId)?.summary;
    return [run.outcome ? `${run.label} documenta ${run.outcome.toLocaleLowerCase("es-MX")}.`
      : scope ? `${run.label} pertenece a un estudio de propagación de llama. ${scope}` : "",
    run.steady_flame_length_cm === undefined ? "" : `La fuente de ${run.label} reporta una longitud de llama estable de ${run.steady_flame_length_cm} cm.`]
      .filter(Boolean).join(" ");
  };
  const extinction = [a, b].find((run) => run.topics?.includes("extinction") && run.outcome);
  const spread = [a, b].find((run) => run !== extinction && run.topics?.includes("flame-spread"));
  const connection = extinction && spread
    ? `Ambos aportan evidencia complementaria en microgravedad. ${extinction.label} ayuda a estudiar cuándo se apaga una llama, y ${spread.label} cómo se propaga.`
    : "";
  const observations = [connection, purpose(a), purpose(b)].filter(Boolean).join(" ");

  const material = matching("fuel")?.valueA;
  const gravity = matching("gravity_g")?.valueA;
  const configuration = matching("configuration")?.valueA;
  const common = [
    material !== undefined ? `material ${material}` : "",
    gravity !== undefined ? `gravedad indicada de ${gravity} g` : "",
    typeof configuration === "string" ? configuration.toLocaleLowerCase("es-MX") : "",
  ].filter(Boolean);
  const similarities = common.length ? `Comparten ${new Intl.ListFormat("es").format(common)}.` : "";

  const fields = ["flow_velocity_cm_s", "oxygen_pct", "pressure_psia", "width_cm", "thickness_mm"] as const;
  const changes = fields.flatMap((id) => {
    const row = rows.find(({ field, status }) => field.id === id && status === "changed");
    if (!row || !("unit" in row.field) || typeof row.valueA !== "number" || typeof row.valueB !== "number") return [];
    const { field, valueA, valueB } = row;
    const format = (value: number) => Number(value.toFixed(field.decimals));
    return [`${field.label.toLocaleLowerCase("es-MX")} de ${format(valueA)} a ${format(valueB)} ${field.unit}`];
  });
  const differences = changes.length ? `Al pasar de ${a.label} a ${b.label} cambian ${new Intl.ListFormat("es").format(changes)}.` : "";

  const missingOutcome = a.outcome && !b.outcome ? b : b.outcome && !a.outcome ? a : undefined;
  const limits = [
    confounded ? "Varias condiciones cambiaron a la vez. La comparación por sí sola no identifica el efecto de cada factor." : "",
    extinction && spread && confounded ? "Estos registros no demuestran una transición entre propagación y extinción." : "",
    missingOutcome ? `La tabla deja vacía la fila de resultado observado para ${missingOutcome.label}.` : "",
  ].filter(Boolean).join(" ");
  return [observations, similarities, differences, limits].filter(Boolean);
}

function answerComparison(runs: readonly ExperimentalRun[], context: PageAssistantContext, interpret: boolean, relevance = false): PageAssistantAnswer {
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

  const studies = new Map(context.studies.map((study) => [study.id, study]));
  if (relevance) {
    const explanation = comparisonNarrative(a, b, studies);
    if (explanation.length) return { text: explanation.join("\n\n"), pointers };
  }
  const rows = compareRuns(a, b, studies);
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

function compareExperiments(question: string, namedRuns: ExperimentalRun[], namedStudies: Investigation[], context: PageAssistantContext, interpret: boolean, relevance: boolean): PageAssistantAnswer {
  const studyById = new Map(context.studies.map((study) => [study.id, study]));
  const ranked = rankRuns(context.runs.filter((run) => !run.reference && !run.psiProfile), studyById, context.profile, context.atmosphere);
  const representative = new Map<string, ExperimentalRun>();
  for (const { run } of ranked) if (!representative.has(run.investigationId)) representative.set(run.investigationId, run);

  const chosen: (ExperimentalRun | Investigation)[] = [...namedRuns];
  const includedStudies = new Set(namedRuns.map(({ investigationId }) => investigationId));
  function addStudy(study: Investigation) {
    if (includedStudies.has(study.id)) return;
    includedStudies.add(study.id);
    chosen.push(representative.get(study.id) ?? study);
  }
  namedStudies.forEach(addStudy);

  const quantity = question.match(/\b([2-9]|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\s+(?:experimentos?|estudios?|corridas?)\b/)?.[1];
  const words = ["dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const requested = quantity ? (Number(quantity) || words.indexOf(quantity) + 2) : 2;
  const count = Math.min(6, Math.max(requested, chosen.length));
  const hits = context.search(question.replace(/\b(?:compara\w*|contrasta\w*|diferencias?|experimentos?|estudios?|corridas?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|[2-9])\b/g, " "));
  const anchor = [...includedStudies].map((id) => studyById.get(id)).find(Boolean);
  const related = [...studyById.values()].filter((study) => hits.studies.size
    ? hits.studies.has(study.id) || Boolean(anchor?.topics.some((topic) => study.topics.includes(topic)))
    : representative.has(study.id)).sort((a, b) => {
    const score = (study: Investigation) => (hits.studies.get(study.id)?.score ?? 0) +
      (anchor ? study.topics.filter((topic) => anchor.topics.includes(topic)).length : 0);
    return score(b) - score(a);
  });
  for (const study of related) {
    if (chosen.length >= count) break;
    addStudy(study);
  }

  const compared = chosen.slice(0, count);
  if (compared.length < 2) {
    return { text: compared.length ? "Encontré un solo registro pertinente. Hace falta otro para comparar este tema."
      : "No encontré registros pertinentes para comparar ese tema.",
      pointers: compared.map((item) => evidencePointer(item)) };
  }
  const [baseline, ...others] = compared;
  const shortage = compared.length < count ? ` Encontré ${compared.length} registros pertinentes para esta comparación.` : "";
  if (others.length === 1 && "investigationId" in baseline && "investigationId" in others[0]) {
    const pair = answerComparison([baseline, others[0]], context, interpret, relevance);
    return { ...pair, text: pair.text + shortage };
  }
  const pairPointers: AssistantPointer[] = [];
  const comparisons = others.map((item) => {
    if ("investigationId" in baseline && "investigationId" in item) {
      const pair = answerComparison([baseline, item], context, false);
      pairPointers.push({ ...pair.pointers[0], label: `Comparar ${baseline.label} con ${item.label}` });
      return pair.text;
    }
    const describe = (record: ExperimentalRun | Investigation) => "investigationId" in record
      ? `${record.label}. ${record.outcome ?? record.configuration ?? "Corrida documentada."}` : `${record.id}. ${record.summary}`;
    return `${describe(baseline)} frente a ${describe(item)}. La comparación disponible es descriptiva.`;
  });
  const lead = compared.length > 2 ? `Comparé ${compared.length} registros tomando ${"investigationId" in baseline ? baseline.label : baseline.id} como referencia.`
    : "Comparé el objetivo y los datos disponibles de ambos estudios.";
  return { text: [lead + shortage, ...comparisons].join("\n\n"), pointers: [...pairPointers, ...compared.map((item) => evidencePointer(item))] };
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

  const studyNamesWithoutRun = studies.filter((study) => !runs.some((run) => run.investigationId === study.id));
  const relevance = runs.length + studyNamesWithoutRun.length >= 2 &&
    /\b(?:relevan\w*|importan\w*|aporta\w*|comun|similitudes?|relacion\w*|complement\w*)\b/.test(normalized);
  const comparisonAsked = relevance || /\b(?:interpretar|interpretacion|interpreta|comparar|comparame|compara|comparacion|contrasta|contrastar|git diff|entre a y b|a b)\b/.test(normalized) ||
    Boolean(explicit && /\b(?:diferencias?|cambios? entre)\b/.test(normalized));

  if (!comparisonAsked && isAssistantHistoryQuestion(question)) {
    const contextual = /^(?:y )?(?:cuando|en que fecha)(?: (?:fue|ocurrio|se hizo|se realizo|se publico))?$/.test(normalized) ||
      /\b(?:este estudio|esta mision|este experimento|su fecha|su lanzamiento|el reingreso)\b/.test(normalized);
    const study = explicitStudy ?? (contextual ? selectedStudy : undefined);
    if (study) {
      const history = formatAssistantHistory(findAssistantHistory(study.id), question);
      if (history) return { text: history.text, sources: history.citations, pointers: [evidencePointer(study)] };
      return { text: `${study.summary} La ficha no incluye una fecha confirmada para ese hito.`, pointers: [evidencePointer(study)] };
    }
  }

  if (comparisonAsked) {
    const interpret = /\binterpret\w*\b/.test(normalized);
    if (!explicit && (interpret || /\b(?:entre a y b|a b|git diff)\b/.test(normalized))) return answerComparison([], context, interpret);
    return compareExperiments(normalized, runs, studies, context, interpret, relevance);
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
    pointers: [searchPointer], unanswered: true };
}
