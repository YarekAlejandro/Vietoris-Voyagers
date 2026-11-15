import snapshot from "../../../data/psi-snapshot.json";
import { atmosphereControls, missionPresets } from "../../data/mission_presets";
import { psiDataset } from "../../data/psi";
import type { Atmosphere, Citation, ExperimentalRun, Investigation } from "../../types/psi";
import type { PsiSnapshot } from "../../types/psi-live";
import { assistantHistory } from "./assistant-history";
import { sceneEvidenceForRun } from "./experiment-scene";
import { compareRuns, diffFields, summarizeChangedDrivers } from "./git-diff";
import { formatPsiQuantity } from "./live-psi-mapper";
import { mergePsiCatalog } from "./merge-psi-catalog";
import { answerPageQuestion, comparisonNarrative, type AssistantPointer, type AssistantTarget, type PageAssistantAnswer } from "./page-assistant";
import { computeCoverage } from "./scenario-coverage";
import { buildEvidenceIndex } from "./semantic-search";

export interface AssistantGroundingInput {
  question: string;
  previousQuestion?: string;
  history?: readonly { question: string; answer: string }[];
  selection?: AssistantPointer["selection"];
  comparison?: AssistantPointer["comparison"];
  profileId?: string;
  atmosphere?: Atmosphere;
}

interface GroundingFact {
  id: string;
  text: string;
  source?: Citation;
  citations?: readonly Citation[];
  dates?: readonly string[];
  milestone?: string;
  confounded?: boolean;
  pointer?: AssistantPointer;
}

const guide = {
  search: ["Señalar el buscador", "Búsqueda semántica encuentra estudios, corridas y temas en español e inglés."],
  catalog: ["Señalar el catálogo", "El catálogo alterna entre Estudios y Corridas y filtra por instalación y tema. El puntaje FSRS mide similitud con el escenario activo."],
  graph: ["Señalar PSI‑Nexus", "PSI-Nexus muestra relaciones entre investigaciones, corridas, instalaciones y temas."],
  inspector: ["Señalar la ficha", "La ficha describe la selección y presenta los datos, observaciones y fuentes disponibles."],
  coverage: ["Señalar la cobertura", "Cobertura del escenario muestra las corridas que cumplen las tolerancias y la más cercana cuando hay datos."],
  comparison: ["Señalar comparación A/B", "Comparación experimental muestra las dos corridas elegidas, sus diferencias y las condiciones que cambiaron a la vez."],
  atmosphere: ["Señalar Atmósfera", "Atmósfera en la ficha permite ajustar el oxígeno, la presión absoluta, el flujo y la gravedad del escenario."],
  interpret: ["Señalar Interpretar", "Interpretar explica la comparación activa cuando hay dos corridas documentadas."],
} satisfies Partial<Record<AssistantTarget, readonly [string, string]>>;

const targets = [...Object.keys(guide), "scene", "none"];
export const assistantGroundedSchema = {
  type: "object",
  properties: {
    paragraphs: { type: "array", items: {
      type: "object", properties: {
        text: { type: "string" }, factIds: { type: "array", items: { type: "string" } },
      },
      required: ["text", "factIds"], additionalProperties: false,
    } },
    target: { type: "string", enum: targets },
  },
  required: ["paragraphs", "target"], additionalProperties: false,
};

const records = (snapshot as PsiSnapshot).investigations;
const catalog = mergePsiCatalog(psiDataset, new Map(records.map((record) => [record.accession, { record, origin: "snapshot" }])));
const studiesById = new Map(catalog.investigations.map((study) => [study.id, study]));
const runsById = new Map(catalog.runs.map((run) => [run.id, run]));
const evidenceIndex = buildEvidenceIndex(catalog);
const snapshotByAccession = new Map(records.map((record) => [record.accession, record]));

function normalized(text: string) {
  return text.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function namedSelections(question: string): NonNullable<AssistantPointer["selection"]>[] {
  const text = ` ${normalized(question)} `;
  const names = [
    ...catalog.runs.map((run) => ({ selection: { kind: "run" as const, id: run.id }, aliases: [run.id, run.label] })),
    ...catalog.investigations.map((study) => ({ selection: { kind: "study" as const, id: study.id },
      aliases: [study.id, study.name, study.psi?.accession, study.importedPsi?.acronym,
        study.source.label.match(/\bPSI-\d+\b/i)?.[0]] })),
  ];
  const matches = names.flatMap(({ selection, aliases }) => aliases.flatMap((name) => {
    if (!name) return [];
    const alias = normalized(name);
    const start = text.indexOf(` ${alias} `);
    return start < 0 ? [] : [{ selection, start, end: start + alias.length }];
  })).sort((a, b) => a.start - b.start || b.end - a.end);
  return matches.filter((item, index) => !matches.slice(0, index).some((earlier) => earlier.selection.id === item.selection.id ||
    (earlier.start <= item.start && earlier.end >= item.end))).map(({ selection }) => selection);
}

function studyFacts(study: Investigation): GroundingFact[] {
  const pointer: AssistantPointer = {
    label: `Señalar ficha · ${study.id}`, target: "inspector", selection: { kind: "study", id: study.id },
  };
  const facts: GroundingFact[] = [{ id: `study:${study.id}`, text: `${study.id}. ${study.name}. ${study.summary.slice(0, 1400)}`, source: study.source, pointer }];
  for (const [index, entry] of assistantHistory.filter(({ studyId }) => studyId === study.id).entries()) {
    facts.push({ id: `history:${study.id}:${index}`, text: entry.text, source: entry.citation, pointer,
      dates: [entry.date, entry.endDate].filter((date): date is string => Boolean(date)), milestone: entry.kind });
  }
  const record = study.psi && snapshotByAccession.get(study.psi.accession);
  if (study.psi && record?.releaseDate && (record.objective || record.approach)) {
    const date = record.releaseDate.slice(0, 10);
    const description = [record.objective, record.approach].filter(Boolean).join(" ").slice(0, 1000);
    facts.push({ id: `psi:${record.accession}`, text: `${record.accession}. Fecha de publicación de la ficha PSI: ${date}. ${description}`,
      source: { label: `NASA PSI · ${record.accession}`, url: study.psi.officialUrl }, pointer, dates: [date], milestone: "publication" });
  }
  return facts;
}

function runFact(run: ExperimentalRun, pointer?: AssistantPointer): GroundingFact {
  const values = { ...run, ...run.atmosphere };
  const measures = diffFields.flatMap((field) => {
    if (!("unit" in field)) return [];
    const profile = run.psiProfile?.[field.id as keyof Atmosphere];
    if (profile) return [`${field.label}: ${formatPsiQuantity(profile, field.decimals)} (perfil publicado en PSI)`];
    const value = values[field.id];
    if (value === undefined) return [];
    const nominal = run.reference || run.nominal?.fields.some((axis) => axis === field.id);
    return [`${field.label}: ${value.toFixed(field.decimals)} ${field.unit}${nominal ? " (nominal)" : ""}`];
  });
  const description = [run.label, `Estudio ${run.investigationId}`, run.reference ? "Perfil de referencia" : undefined,
    run.fuel, run.configuration, run.outcome, ...measures].filter(Boolean);
  return { id: `run:${run.id}`, text: description.join(" · "), source: run.source, pointer: pointer ?? {
    label: `Señalar ficha · ${run.label}`, target: "inspector", selection: { kind: "run", id: run.id },
  } };
}

function comparisonFact(comparison: NonNullable<AssistantPointer["comparison"]>, index: number): GroundingFact | null {
  const a = runsById.get(comparison.a);
  const b = runsById.get(comparison.b);
  if (!a || !b) return null;
  const rows = compareRuns(a, b, studiesById);
  const drivers = summarizeChangedDrivers(rows);
  const deltas = rows.flatMap(({ field, delta }) => delta === undefined || !("unit" in field) ? [] :
    [`${field.label}: ${delta.toFixed(field.decimals)} ${"deltaUnit" in field ? field.deltaUnit : field.unit}`]);
  const conclusion = drivers.confounded ? "Cambiaron varias condiciones a la vez. La diferencia no puede atribuirse a una sola variable." : "";
  return { id: index === 0 ? "comparison:active" : `comparison:${index + 1}`, text: [`Comparación de A (${a.label}) y B (${b.label})`,
    `Condiciones distintas: ${drivers.changedVariables.join(", ") || "ninguna con diferencia reportada"}`,
    `Diferencias B menos A: ${deltas.join(" · ") || "sin diferencias cuantificadas"}`, conclusion,
    comparisonNarrative(a, b, studiesById).join(" ")].filter(Boolean).join(". "),
  citations: [a.source, b.source], confounded: drivers.confounded, pointer: { label: guide.comparison[0], target: "comparison", comparison } };
}

export function buildAssistantGrounding(input: AssistantGroundingInput) {
  const profile = missionPresets.find(({ id }) => id === input.profileId) ?? missionPresets[0];
  const atmosphere = input.atmosphere ?? profile.atmosphere;
  const coverage = computeCoverage(atmosphere, catalog.runs);
  const context = { studies: catalog.investigations, runs: catalog.runs, search: evidenceIndex.search, coverage, profile, atmosphere,
    selection: input.selection ?? null, comparison: input.comparison ?? { a: "", b: "" } };
  const local = answerPageQuestion(input.question, context);
  const exact = namedSelections(input.question);
  const refersBack = /\b(?:su|sus|ese|esa|eso|ellos|ellas|anterior|cuando|que fecha|cual fue|how long|when did|that|it)\b/.test(normalized(input.question));
  const previousQuestions = input.history?.map(({ question }) => question) ?? [input.previousQuestion ?? ""];
  const previous = !exact.length && refersBack ? [...previousQuestions].reverse().flatMap(namedSelections) : [];
  const facts = new Map<string, GroundingFact>();
  const add = (fact: GroundingFact) => { if (!facts.has(fact.id)) facts.set(fact.id, fact); };
  const pointerForRun = new Map(local.pointers.flatMap((pointer) => pointer.selection?.kind === "run" ? [[pointer.selection.id, pointer] as const] : []));
  const candidates = [...exact, ...previous, ...local.pointers.flatMap(({ selection }) => selection ? [selection] : [])];
  if (!candidates.length && refersBack && input.selection) candidates.push(input.selection);
  const comparisons = local.pointers.flatMap(({ comparison }) => comparison ? [comparison] : []);
  for (const selection of [...new Map(candidates.map((item) => [item.id, item])).values()].slice(0, comparisons.length ? 12 : 6)) {
    const run = selection.kind === "run" ? runsById.get(selection.id) : undefined;
    const study = studiesById.get(run?.investigationId ?? selection.id);
    if (run) add(runFact(run, pointerForRun.get(run.id)));
    if (!study) continue;
    studyFacts(study).forEach(add);
    if (!run && /\b(?:corrida|corridas|datos|medidas|mediciones|muestra|muestras|resultados|presion|oxigeno|hallazgos)\b/.test(normalized(input.question))) {
      catalog.runs.filter(({ investigationId }) => investigationId === study.id).slice(0, 3).forEach((record) => add(runFact(record)));
    }
  }

  comparisons.forEach((comparison, index) => {
    const diff = comparisonFact(comparison, index);
    if (diff) add(diff);
  });
  if (comparisons.length) {
    for (const pointer of local.pointers) {
      if (pointer.selection?.kind !== "study") continue;
      const study = studiesById.get(pointer.selection.id);
      if (study) add({ id: `comparison:descriptive:${study.id}`,
        text: `${study.id}. Comparación descriptiva: ${study.summary}`, source: study.source, pointer });
    }
  }
  const contextual = local.pointers.find(({ target }) => target === "coverage" || target === "catalog" || target === "atmosphere" || target === "scene");
  if (contextual && !local.unanswered) add({ id: `answer:${contextual.target}`, text: local.text, pointer: contextual });
  if (contextual?.target === "atmosphere") add({ id: "scenario:active", text: `${profile.name}. ${atmosphereControls.map(({ field, label, decimals, unit }) =>
    `${label}: ${atmosphere[field].toFixed(decimals)} ${unit}`).join(" · ")}`, pointer: contextual });
  for (const [target, [label, text]] of Object.entries(guide)) add({ id: `guide:${target}`, text, pointer: { label, target: target as AssistantTarget } });
  return [...facts.values()];
}

export function assistantFactsForModel(facts: readonly GroundingFact[]) {
  return facts.map(({ id, text, source, dates, milestone, confounded, pointer }) => ({
    id, text: text.replace(/https?:\/\/[^\s)>"]+/gi, "[enlace en la fuente]"), sourceLabel: source?.label,
    dates, milestone, confounded, target: pointer?.target,
  }));
}

const months = ["enero|january", "febrero|february", "marzo|march", "abril|april", "mayo|may", "junio|june", "julio|july", "agosto|august", "septiembre|setiembre|september", "octubre|october", "noviembre|november", "diciembre|december"];
const monthPattern = months.join("|");
const spanishRange = new RegExp(`\\b(\\d{1,2})\\s+(?:al|a|y)\\s+(\\d{1,2})\\s+de\\s+(${monthPattern})\\s+(?:de|del)\\s+(\\d{4})\\b`, "gi");
const spanishDate = new RegExp(`\\b(?:(\\d{1,2})\\s+de\\s+)?(${monthPattern})\\s+(?:de|del)\\s+(\\d{4})\\b`, "gi");
const englishDate = new RegExp(`\\b(${monthPattern})\\s+(?:(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+)?(\\d{4})\\b`, "gi");
const dayFirstDate = new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})\\b`, "gi");
const isoDate = /\b\d{4}-\d{2}(?:-\d{2})?\b/g;

function literalDates(text: string) {
  const format = (year: string, month: string, day?: string) => {
    const number = 1 + months.findIndex((names) => names.split("|").includes(month.toLowerCase()));
    return `${year}-${String(number).padStart(2, "0")}${day ? `-${day.padStart(2, "0")}` : ""}`;
  };
  return [
    ...[...text.matchAll(spanishRange)].flatMap(([, from, to, month, year]) => [format(year, month, from), format(year, month, to)]),
    ...[...text.matchAll(spanishDate)].map(([, day, month, year]) => format(year, month, day)),
    ...[...text.matchAll(englishDate)].map(([, month, day, year]) => format(year, month, day)),
    ...[...text.matchAll(dayFirstDate)].map(([, day, month, year]) => format(year, month, day)),
    ...[...text.matchAll(isoDate)].map(([date]) => date),
  ];
}

const numberAndUnit = /(?<![\p{L}\d])([+−-]?\d+(?:[.,]\d+)?)(?:\s*(%\s*(?:O[₂2]|CO[₂2])?|mm²\/s|cm\/s|mg\/min|kv\/cm|Rt\/R[₀0]|psia|kpa|ppm|pp|kJ|mm|cm|g|s)(?![\p{L}\d/]))?/giu;

function numbers(text: string) {
  return [...text.matchAll(numberAndUnit)].map(([, literal, unit]) => ({
    value: Number(literal.replace(",", ".").replace("−", "-")),
    decimals: literal.split(/[.,]/)[1]?.length ?? 0,
    unit: unit?.toLowerCase().replace(/\s+/g, "").replaceAll("₂", "2").replaceAll("₀", "0") ?? "",
  }));
}

const milestoneLabels = [
  { kind: "launch", mentions: /\b(?:despeg\w*|lanzamiento|lanzo|launch\w*)\b/ },
  { kind: "experiment", mentions: /\b(?:ensayos?|pruebas?|ignici[oó]n|se realiz\w*|experiments? took place)\b/ },
  { kind: "conclusion", mentions: /\b(?:conclu\w*|reentr\w*|finaliz\w*|ended|concluded)\b/ },
  { kind: "publication", mentions: /\b(?:public\w*|publish\w*)\b/ },
];

function supportedNumbers(text: string, cited: readonly GroundingFact[]) {
  const support = cited.flatMap((fact) => numbers(fact.text));
  const milestones = milestoneLabels.filter(({ mentions }) => mentions.test(normalized(text)));
  const datedFacts = milestones.length === 1 && cited.some(({ milestone }) => Boolean(milestone))
    ? cited.filter(({ milestone }) => milestone === milestones[0].kind) : cited;
  const dates = datedFacts.flatMap((fact) => [...fact.dates ?? [], ...literalDates(fact.text)]);
  const uncoveredDate = literalDates(text).some((date) => !dates.some((value) => value === date || value.startsWith(`${date}-`)));
  if (uncoveredDate) return false;
  const textWithoutDates = text.replace(spanishRange, "").replace(spanishDate, "").replace(dayFirstDate, "").replace(englishDate, "").replace(isoDate, "");
  return numbers(textWithoutDates).every(({ value, unit, decimals }) =>
    support.some((entry) => entry.unit === unit && Math.abs(entry.value - value) < 0.5 * 10 ** -decimals + 1e-9));
}

const unsafeAssertions = /\b(?:certific\w*|garanti[sz]\w*|guarantee\w*|concluyente|explosiv\w*|segur[oa]s? (?:para|en)|safe (?:for|to)|apt[oa]s? para)\b/i;
const directCausality = /\b(?:causo|provoco|produjo|se debe a|por efecto de|attributable to|caused|led to|resulted in)\b/;
const modelLinks = /(?:\b(?:https?|ftp|file|javascript|data):|www\.|\[[^\]]*\]\(|<\/?[a-z])/i;

function pointedFact(fact: GroundingFact, target: string): AssistantPointer | undefined {
  const pointer = fact.pointer;
  if (!pointer) return undefined;
  if (target === pointer.target) return pointer;
  if (target === "graph" && pointer.selection) return { label: `Señalar en el grafo · ${pointer.selection.id}`, target, selection: pointer.selection };
  if (target === "scene" && pointer.selection?.kind === "run") {
    const run = runsById.get(pointer.selection.id);
    if (run && sceneEvidenceForRun(run)) return { label: `Señalar escena · ${run.label}`, target, selection: pointer.selection };
  }
  if (target === "inspector" && pointer.selection) return { ...pointer, target, label: `Señalar ficha · ${pointer.selection.id}` };
  return undefined;
}

export function validateAssistantGroundedAnswer(output: unknown, facts: readonly GroundingFact[]): PageAssistantAnswer | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const { paragraphs, target } = output as { paragraphs?: unknown; target?: unknown };
  if (Object.keys(output).length !== 2 || !Array.isArray(paragraphs) || !paragraphs.length || paragraphs.length > 4 ||
    typeof target !== "string" || !targets.includes(target)) return null;

  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const cited = new Map<string, GroundingFact>();
  const text: string[] = [];
  for (const item of paragraphs) {
    if (!item || typeof item !== "object" || Object.keys(item).length !== 2 || typeof item.text !== "string" ||
      !item.text.trim() || item.text.length > 600 || unsafeAssertions.test(item.text) || modelLinks.test(item.text) ||
      !Array.isArray(item.factIds) || !item.factIds.length || item.factIds.length > 6) return null;
    const matching = item.factIds.flatMap((id: unknown): GroundingFact[] => {
      const fact = typeof id === "string" ? byId.get(id) : undefined;
      return fact ? [fact] : [];
    });
    if (matching.length !== item.factIds.length || !supportedNumbers(item.text, matching) ||
        (facts.some(({ confounded }) => confounded) && directCausality.test(normalized(item.text)))) return null;
    for (const fact of matching) cited.set(fact.id, fact);
    text.push(item.text.trim());
  }

  const citedFacts = [...cited.values()];
  const preparedPairs = facts.filter(({ id }) => id.startsWith("comparison:"));
  if (preparedPairs.some(({ id }) => !cited.has(id))) return null;
  const requested = citedFacts.map((fact) => pointedFact(fact, target)).filter((pointer): pointer is AssistantPointer => !!pointer);
  const pointers = requested.length ? requested : citedFacts.flatMap(({ pointer }) => pointer?.selection ? [pointer] : []);
  const sources = new Map(citedFacts.flatMap(({ source, citations }) =>
    (citations ?? (source ? [source] : [])).map((citation) => [citation.url, citation] as const)));
  return { text: text.join("\n\n"), pointers: [...new Map(pointers.map((pointer) => [
    `${pointer.target}:${pointer.selection?.id ?? ""}`, { ...pointer, source: undefined },
  ])).values()].slice(0, 3), sources: [...sources.values()] };
}
