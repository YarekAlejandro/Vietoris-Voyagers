import { evidenceTopics, facilities, searchMaterials, topicsForRun } from "../../data/psi_vocabulary";
import type { ExperimentalRun, Investigation, PsiDataset } from "../../types/psi";

interface SearchConcept {
  key: string;
  label: string;
  aliases: readonly string[];
  kind?: "study" | "run";
}

type EvidenceDocument =
  | { type: "study"; study: Investigation }
  | { type: "run"; study: Investigation; run: ExperimentalRun };

export interface EvidenceHit {
  score: number;
  reasons: string[];
}

export interface EvidenceSearchResults {
  active: boolean;
  concepts: string[];
  studies: ReadonlyMap<string, EvidenceHit>;
  runs: ReadonlyMap<string, EvidenceHit>;
}

const evidenceConcepts: SearchConcept[] = [
  ...Object.entries(evidenceTopics).map(([id, topic]) => ({ key: `topic:${id}`, ...topic })),
  ...searchMaterials.map(({ id, ...material }) => ({ key: `material:${id}`, ...material })),
  ...Object.entries(facilities).filter(([id]) => id !== "ISS").map(([id, facility]) => ({
    key: `facility:${id}`, label: facility.label, aliases: [facility.name, ...facility.aliases],
  })),
  {
    key: "platform:iss", label: "ISS",
    aliases: ["Estación Espacial Internacional", "international space station", "space station"],
  },
  {
    key: "gravity:micro", label: "Microgravedad",
    aliases: ["microgravity", "gravedad cero", "zero gravity", "ingravidez", "0g"],
  },
];

const stopWords = new Set(
  `a al algo algun alguna algunos an and aparecen at busca buscar buscarme busco casos como con cual cuales cuando
  condiciones de del bajo donde el en encuentra encontrar ensayos entre es esa ese esta estas este estos
  estudio estudios evidencia experimento experimentos fire flame flames for from fuego hay how in investigation investigaciones is la las
  investigan investiga llama llamas lo los me muestra muestras necesito of ocurre on o or otro para pasa por puedo que quiero
  records related result resultados runs se sobre some son tests the to un una unas unos ver
  versus vs what which with y`.split(/\s+/),
);
const runQuestionWords = new Set([
  "did", "do", "does", "observado", "observo", "published", "recorded", "registro",
  "report", "reporta", "reportado", "reported", "reporto", "was", "were",
]);

function tokens(text: string): string[] {
  return text.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function buildEvidenceIndex({ investigations, runs }: PsiDataset) {
  const studyById = new Map(investigations.map((study) => [study.id, study]));
  const concepts: SearchConcept[] = [
    ...evidenceConcepts,
    ...investigations.map(({ id, name, psi, importedPsi }): SearchConcept => ({
      key: `study:${id}`, label: id, aliases: [name, ...(psi ? [psi.accession] : []), ...(importedPsi?.acronym ? [importedPsi.acronym] : [])], kind: "study",
    })),
    ...runs.map(({ id }): SearchConcept => ({ key: `run:${id}`, label: id, aliases: [], kind: "run" })),
  ];
  const phrases = concepts.flatMap((concept) => [concept.label, ...concept.aliases].map((alias) => ({
    concept, words: tokens(alias),
  }))).filter(({ words }) => words.length > 0).sort((a, b) => b.words.length - a.words.length);
  const phrasesByFirstWord = new Map<string, typeof phrases>();
  for (const phrase of phrases) {
    const [firstWord] = phrase.words;
    if (!firstWord) continue;
    const list = phrasesByFirstWord.get(firstWord) ?? [];
    list.push(phrase);
    phrasesByFirstWord.set(firstWord, list);
  }

  const documents: EvidenceDocument[] = [
    ...investigations.map((study): EvidenceDocument => ({ type: "study", study })),
    ...runs.flatMap((run): EvidenceDocument[] => {
      const study = studyById.get(run.investigationId);
      return study ? [{ type: "run", study, run }] : [];
    }),
  ];

  const indexed = documents.map((document) => {
    const { study } = document;
    const run = document.type === "run" ? document.run : undefined;
    const imported = study.importedPsi;
    const metadata = run
      ? [run.id, run.label, run.fuel, run.configuration, run.outcome, run.source.label]
      : [study.id, study.name, study.summary, study.source.label, imported?.acronym, imported?.keywords,
        imported?.researchArea, imported?.projectType, ...(imported?.hardware ?? [])];
    const keys = new Set([`study:${study.id}`, `facility:${study.facility}`]);
    if (["ISS", "CIR", "MSG"].includes(study.facility) || imported?.flightPlatform?.includes("International Space Station")) keys.add("platform:iss");
    if ((run?.atmosphere.gravity_g !== undefined && run.atmosphere.gravity_g < 1e-4) ||
        (!run && (!imported || imported.projectType === "Microgravity Investigation"))) keys.add("gravity:micro");
    const topics = run ? topicsForRun(run) : study.topics;
    for (const topic of topics) keys.add(`topic:${topic}`);
    const fields = metadata.map((value) => tokens(value ?? ""));
    for (const material of searchMaterials) {
      if (run?.fuel && tokens(run.fuel).includes(material.id)) keys.add(`material:${material.id}`);
      if (imported && !run && [material.label, ...material.aliases].some((alias) => {
        const phrase = ` ${tokens(alias).join(" ")} `;
        return fields.some((words) => ` ${words.join(" ")} `.includes(phrase));
      })) {
          keys.add(`material:${material.id}`);
      }
    }
    return { document, keys, fields, words: new Set(fields.flat()) };
  });

  function search(query: string): EvidenceSearchResults {
    const words = tokens(query);
    const required = new Map<string, SearchConcept>();
    const namedStudies = new Set<string>();
    const namedRuns = new Set<string>();
    const terms = new Set<string>();
    const matchedPhrases: string[][] = [];
    for (let offset = 0; offset < words.length;) {
      const word = words[offset];
      const phrase = phrasesByFirstWord.get(word)?.find((candidate) =>
        candidate.words.every((item, index) => item === words[offset + index]));
      if (!phrase) {
        if (!stopWords.has(word)) terms.add(word);
        offset += 1;
        continue;
      }
      if (phrase.concept.kind === "study") namedStudies.add(phrase.concept.key);
      else if (phrase.concept.kind === "run") namedRuns.add(phrase.concept.key);
      else required.set(phrase.concept.key, phrase.concept);
      matchedPhrases.push(phrase.words);
      offset += phrase.words.length;
    }

    const studies = new Map<string, EvidenceHit>();
    const runHits = new Map<string, EvidenceHit>();
    const active = required.size + namedStudies.size + namedRuns.size + terms.size > 0;
    if (!active) return { active, studies, runs: runHits, concepts: [] };
    const requiredKeys = [...required.keys()];
    const requiredTerms = [...terms].filter((term) => !namedRuns.size || !runQuestionWords.has(term));
    const conceptReasons = [...required.values()].map(({ label }) => label);
    for (const { document, keys, fields, words: metadataWords } of indexed) {
      const studyKey = `study:${document.study.id}`;
      if (namedStudies.size && !namedStudies.has(studyKey)) continue;
      const exactRun = document.type === "run" && namedRuns.has(`run:${document.run.id}`);
      if (namedRuns.size && !exactRun) continue;
      if (requiredKeys.some((key) => !keys.has(key))) continue;
      if (requiredTerms.some((term) => !metadataWords.has(term))) continue;
      const reasons = [...conceptReasons];
      if (namedStudies.has(studyKey)) reasons.unshift(document.study.id);
      if (exactRun) reasons.unshift(document.run.id);
      if (requiredTerms.length) reasons.push(`Texto: ${requiredTerms.join(", ")}`);
      const literalMatches = matchedPhrases.filter((phrase) => fields.some((field) =>
        field.some((_, offset) => phrase.every((word, index) => word === field[offset + index])))).length;
      const score = required.size * 3 + (Number(namedStudies.has(studyKey)) + Number(exactRun)) * 4 +
        requiredTerms.length + literalMatches * 0.25;
      if (document.type === "study") {
        if ((studies.get(document.study.id)?.score ?? -Infinity) <= score) studies.set(document.study.id, { score, reasons });
      } else {
        runHits.set(document.run.id, { score, reasons });
        const existingStudy = studies.get(document.study.id);
        if (!existingStudy || existingStudy.score < score - 1) {
          studies.set(document.study.id, { score: score - 1, reasons: [...reasons, "Evidencia en una corrida"] });
        }
      }
    }
    return { active, studies, runs: runHits, concepts: conceptReasons };
  }

  return { search };
}
