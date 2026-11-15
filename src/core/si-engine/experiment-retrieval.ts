import { evidenceTopics, searchMaterials } from "../../data/psi_vocabulary";
import { coverageTolerances } from "../../data/coverage_config";
import type { Citation, ExperimentalRun, Investigation, PsiDataset } from "../../types/psi";
import type { RawPsiInvestigation } from "../../types/psi-live";
import { containsPhrase, geometryKey, isNumberField, materialKey, normalizedWords, numberFields, profileFields, profileLabel, psiaToKpa,
  type ExperimentProfile, type NumberField, type ProfileField } from "./experiment-profile";

const tolerances: Partial<Record<NumberField, number>> = {
  oxygen_pct: coverageTolerances.oxygen_pp, pressure_kpa: coverageTolerances.pressure_kpa,
  flow_cm_s: coverageTolerances.flow_cm_s, gravity_g: 0.05, thickness_mm: 0.2, width_cm: 1, diameter_mm: 0.2,
};
const stopWords = new Set("para este esta como quiero estudiar estudio analizar observar medir datos experiment experimento sobre que cual the some want study for with and experiment from would into en los las con por del las".split(" "));

export interface ParameterMatch {
  field: ProfileField;
  label: string;
  query: number | string;
  recorded: number | string | null;
  unit?: string;
  delta?: number;
  tolerance?: number;
  status: "match" | "different" | "missing";
}

export interface ExperimentRecommendation {
  accession: string;
  title: string;
  acronym: string | null;
  officialUrl: string;
  relevance_pct: number;
  conditions_pct: number | null;
  thematic_pct: number | null;
  themes: string[];
  parameters: ParameterMatch[];
  rationale: string[];
  learning: string;
  metadata?: { label: string; text: string };
  run?: { id: string; label: string; outcome?: string; source: Citation };
}

export function recordedRunProfile(run: ExperimentalRun): ExperimentProfile {
  if (run.reference || run.psiProfile) return {};
  const configuration = normalizedWords(run.configuration ?? "");
  const noMeasuredFlow = !run.nominal?.fields.includes("flow_velocity_cm_s") && run.atmosphere.flow_velocity_cm_s === 0;
  const flowDirection = noMeasuredFlow || /\b(sin flujo|flujo nulo)\b/.test(configuration) ? "sin flujo"
    : /\b(opuesto|contracorriente)\b/.test(configuration) ? "opuesto"
      : /\bconcurrente\b/.test(configuration) ? "concurrente" : undefined;
  const atmosphere = run.atmosphere;
  const pressure_psia = run.nominal?.fields.includes("pressure_psia") ? undefined : atmosphere.pressure_psia;
  // La geometría se usa solo cuando la configuración o la documentación de la corrida la identifica.
  const geometry = run.initial_droplet_diameter_mm !== undefined && configuration.includes("gota aislada") ? "Gota aislada"
    : run.investigationId === "BASS-II" && run.fuelCategory === "SOLID_FABRIC" ? "Lámina de tejido" : undefined;
  return {
    material: run.fuel, geometry, flowDirection,
    oxygen_pct: run.nominal?.fields.includes("oxygen_pct") ? undefined : atmosphere.oxygen_pct,
    pressure_kpa: pressure_psia === undefined ? undefined : pressure_psia * psiaToKpa,
    flow_cm_s: run.nominal?.fields.includes("flow_velocity_cm_s") ? undefined : atmosphere.flow_velocity_cm_s,
    gravity_g: run.nominal?.fields.includes("gravity_g") ? undefined : atmosphere.gravity_g,
    thickness_mm: run.thickness_mm, width_cm: run.width_cm, diameter_mm: run.initial_droplet_diameter_mm,
  };
}

export function compareExperimentParameters(profile: ExperimentProfile, recorded: ExperimentProfile) {
  return profileFields.flatMap((field): (ParameterMatch & { similarity: number })[] => {
    const query = profile[field];
    if (field === "objective" || query === undefined) return [];
    const value = recorded[field];
    const label = profileLabel(field);
    const tolerance = isNumberField(field) ? tolerances[field] : undefined;
    const unit = isNumberField(field) ? numberFields[field].unit : undefined;
    if (value === undefined) return [{ field, label, query, recorded: null, unit, status: "missing", similarity: 0 }];
    if (typeof query === "number" && typeof value === "number" && tolerance !== undefined) {
      const delta = value - query;
      return [{ field, label, query, recorded: value, unit, delta, tolerance,
        status: Math.abs(delta) <= tolerance ? "match" : "different", similarity: Math.exp(-0.5 * (delta / tolerance) ** 2) }];
    }
    const normalize = field === "material" ? materialKey : field === "geometry" ? geometryKey : normalizedWords;
    const equal = normalize(String(query)) === normalize(String(value));
    return [{ field, label, query, recorded: value, status: equal ? "match" : "different", similarity: equal ? 1 : 0 }];
  });
}

const thematicTopics = Object.entries(evidenceTopics).map(([id, { label, aliases }]) => ({
  id, label, phrases: [label, ...aliases].map(normalizedWords),
}));

function tokens(text: string) {
  return [...new Set(normalizedWords(text).split(" ").filter((word) => word.length > 2 && !stopWords.has(word) && !/^\d/.test(word)))];
}

function excerpt(text: string, limit: number) {
  const plain = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= limit) return plain;
  const cut = plain.lastIndexOf(" ", limit);
  return `${plain.slice(0, cut > limit / 2 ? cut : limit)}…`;
}

function recordText(study: Investigation, raw?: RawPsiInvestigation) {
  return normalizedWords([study.name, study.summary, raw?.objective, raw?.approach, raw?.keywords, ...raw?.hardware ?? []].join(" "));
}

export function rankExperiments(profile: ExperimentProfile, catalog: PsiDataset, records: readonly RawPsiInvestigation[], limit: number): ExperimentRecommendation[] {
  const metadataById = new Map(records.map((record) => [record.accession, record]));
  const studies = catalog.investigations.filter((study) => study.psi && metadataById.has(study.psi.accession));
  const measured = catalog.runs.filter((run) => !run.reference && !run.psiProfile);
  const rawByStudy = studies.map((study) => {
    const raw = metadataById.get(study.psi!.accession);
    return { study, raw, text: recordText(study, raw) };
  });
  const objective = normalizedWords([profile.objective, profile.geometry].filter(Boolean).join(" "));
  const queryTopics = thematicTopics.filter(({ phrases }) => phrases.some((phrase) => containsPhrase(objective, phrase)));
  const objectiveTerms = tokens(objective);
  const material = profile.material ? materialKey(profile.material) : "";
  const aliases = searchMaterials.find(({ id }) => id === material)?.aliases ?? [];
  const termWeights = new Map(objectiveTerms.map((word) => [word, Math.log(1 + (rawByStudy.length + 1) /
    (rawByStudy.filter(({ text }) => containsPhrase(text, word)).length + 1))]));
  const totalTermWeight = [...termWeights.values()].reduce((sum, weight) => sum + weight, 0);
  const hasTheme = Boolean(objectiveTerms.length || queryTopics.length || material);
  const hasConditions = profileFields.some((field) => field !== "objective" && profile[field] !== undefined);
  const scoreConditions = (parameters: ReturnType<typeof compareExperimentParameters>) => {
    if (!parameters.length) return 0;
    return parameters.reduce((sum, item) => sum + item.similarity, 0) / parameters.length;
  };

  return rawByStudy.flatMap(({ study, raw, text }): (ExperimentRecommendation & { rawRelevance: number })[] => {
    if (!study.psi || !raw) return [];
    const studyRuns = measured.filter((run) => run.investigationId === study.id);
    const best = studyRuns.map((run) => {
      const parameters = compareExperimentParameters(profile, recordedRunProfile(run));
      return { run, parameters, score: scoreConditions(parameters) };
    }).sort((a, b) => b.score - a.score || Number(Boolean(b.run.outcome)) - Number(Boolean(a.run.outcome)) ||
      a.run.id.localeCompare(b.run.id))[0];
    const topicHits = queryTopics.filter(({ id, phrases }) =>
      study.topics.some((topic) => topic === id) || phrases.some((phrase) => containsPhrase(text, phrase)));
    const matchingWeight = objectiveTerms.reduce((sum, word) => sum + (containsPhrase(text, word) ? termWeights.get(word)! : 0), 0);
    const literal = totalTermWeight ? matchingWeight / totalTermWeight : 0;
    const materialHit = material && ([material, ...aliases].some((alias) => containsPhrase(text, normalizedWords(alias))) ||
      studyRuns.some(({ fuel }) => fuel && materialKey(fuel) === material));
    const themeComponents: number[] = [];
    if (queryTopics.length) themeComponents.push(topicHits.length / queryTopics.length);
    if (objectiveTerms.length) themeComponents.push(literal);
    if (material) themeComponents.push(materialHit ? 1 : 0);
    const themeScore = themeComponents.length ? themeComponents.reduce((sum, value) => sum + value, 0) / themeComponents.length : 0;
    const conditionScore = best?.score ?? 0;
    const evidenceWeight = hasTheme && hasConditions ? 0.6 : hasConditions ? 1 : 0;
    const relevance = evidenceWeight * conditionScore + (1 - evidenceWeight) * themeScore;
    if (relevance < 0.035) return [];
    const parameters = (best?.parameters ?? compareExperimentParameters(profile, {})).map(({ similarity: _similarity, ...row }) => row);
    const matches = parameters.filter(({ status }) => status === "match");
    const differences = parameters.filter(({ status }) => status === "different");
    const themes = [...topicHits.map(({ label }) => label), ...(materialHit && profile.material ? [profile.material] : [])];
    const rationale = [
      best ? `La comparación usa la corrida documentada ${best.run.label}.`
        : "La recomendación usa los objetivos, el enfoque y los términos de la ficha de PSI.",
      matches.length ? `Coinciden dentro del criterio de búsqueda ${matches.map(({ label }) => label.toLowerCase()).join(", ")}.`
        : themes.length ? `La ficha o sus corridas aportan evidencia sobre ${themes.join(", ")}.`
          : "La coincidencia proviene de los términos compartidos con la descripción de la investigación.",
      differences.length ? `Las diferencias documentadas están en ${differences.map(({ label }) => label.toLowerCase()).join(", ")}.` : "",
    ].filter(Boolean);
    const metadataText = raw.objective ?? raw.approach;
    const run = best?.run;
    const learning = run?.outcome
      ? "Usa la observación de la corrida para contrastar qué fenómeno se reportó bajo sus condiciones medidas."
      : run ? "Compara las condiciones publicadas con tu perfil y revisa los resultados disponibles en la fuente de la corrida."
        : "Consulta el objetivo y el enfoque de la ficha para identificar qué mediciones conviene buscar en el registro original.";
    return [{
      accession: study.psi.accession, title: raw.title, acronym: raw.acronym, officialUrl: study.psi.officialUrl,
      rawRelevance: relevance, relevance_pct: Math.round(100 * relevance), conditions_pct: hasConditions && best ? Math.round(100 * conditionScore) : null,
      thematic_pct: hasTheme ? Math.round(100 * themeScore) : null, themes, parameters, rationale, learning,
      ...(metadataText ? { metadata: { label: raw.objective ? "Objetivo publicado en PSI" : "Enfoque publicado en PSI", text: excerpt(metadataText, 440) } } : {}),
      ...(run ? { run: { id: run.id, label: run.label, outcome: run.outcome, source: run.source } } : {}),
    }];
  }).sort((a, b) => b.rawRelevance - a.rawRelevance || (b.conditions_pct ?? 0) - (a.conditions_pct ?? 0) ||
    a.accession.localeCompare(b.accession)).slice(0, limit).map(({ rawRelevance: _rawRelevance, ...result }) => result);
}
