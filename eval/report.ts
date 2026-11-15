import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { missionPresets } from "../src/data/mission_presets";
import { investigationsById, psiDataset } from "../src/data/psi";
import { buildEvidenceBundle, validateInterpretation } from "../src/core/si-engine/evidence-bundle";
import { rankRuns } from "../src/core/si-engine/fsrs-ranker";
import { computeCoverage, measuredRuns } from "../src/core/si-engine/scenario-coverage";
import { buildEvidenceIndex } from "../src/core/si-engine/semantic-search";
import questions from "./questions.json";

it("genera la evaluación local reproducible", () => {
  const index = buildEvidenceIndex(psiDataset);
  const runs = measuredRuns(psiDataset.runs);
  let retrieval = 0;
  let retrievalTotal = 0;
  let abstention = 0;
  let abstentionTotal = 0;
  let directCoverage = 0;
  let directCoverageTotal = 0;
  let validValues = 0;
  let invalidValues = 0;
  let numericalTotal = 0;
  const rows = questions.map(({ q, profile, expected, abstain, requiresDirectCoverage }) => {
    const preset = missionPresets.find(({ id }) => id === profile)!;
    const search = index.search(q);
    const rank = rankRuns(runs.filter((run) => search.runs.has(run.id)), investigationsById, preset, preset.atmosphere);
    const top = rank.slice(0, 5).map(({ run }) => run.id);
    const hit = expected.some((id) => top.includes(id));
    if (expected.length) {
      retrievalTotal += 1;
      retrieval += Number(hit);
    }
    const coverage = computeCoverage(preset.atmosphere, runs);
    const observedAbstention = requiresDirectCoverage ? coverage.status !== "directa" : coverage.status === "ninguna";
    const correct = observedAbstention === abstain;
    if (requiresDirectCoverage) {
      directCoverageTotal += 1;
      directCoverage += Number(correct);
    } else {
      abstentionTotal += 1;
      abstention += Number(correct);
    }
    const selected = rank[0]?.run;
    const oxygen = selected?.nominal?.fields.includes("oxygen_pct") ? undefined : selected?.atmosphere.oxygen_pct;
    if (selected && oxygen !== undefined) {
      const bundle = buildEvidenceBundle({ scenario: preset.atmosphere, profile: preset, runs,
        investigations: investigationsById, focusIds: [selected.id] });
      const narrative = (value: number) => ({
        summary: "La ficha documenta las condiciones del ensayo.",
        claims: [{ text: `Concentración registrada de ${value} % O₂.`, runIds: [selected.id] }],
        limitations: [],
      });
      numericalTotal += 1;
      validValues += Number(Boolean(validateInterpretation(narrative(oxygen), bundle)));
      invalidValues += Number(!validateInterpretation(narrative(oxygen + 100), bundle));
    }
    return `| ${q} | ${expected.length ? (hit ? "Sí" : "No") : "—"} | ${coverage.status} | ${requiresDirectCoverage ? "Evidencia directa" : "Interpretación"} | ${correct ? "Sí" : "No"} |`;
  });
  const fraction = (hits: number, total: number) => total ? `${hits}/${total} (${(100 * hits / total).toFixed(1)} %)` : "—";
  const report = [
    "# Evaluación local",
    "",
    "Conjunto bilingüe de comprobación del catálogo curado. Las preguntas fijan un perfil de misión y los registros esperados cuando corresponde. El acierto de búsqueda exige que aparezca al menos una corrida esperada entre las cinco primeras coincidencias, ordenadas por FSRS.",
    "",
    `- Acierto en top-5 · ${fraction(retrieval, retrievalTotal)}.`,
    `- Cifras documentadas aceptadas · ${fraction(validValues, numericalTotal)}.`,
    `- Cifras alteradas rechazadas · ${fraction(invalidValues, numericalTotal)}.`,
    `- Acierto de abstención de interpretación · ${fraction(abstention, abstentionTotal)}.`,
    `- Acierto al declarar si hay evidencia directa · ${fraction(directCoverage, directCoverageTotal)}.`,
    "",
    "La prueba de cifras usa textos reproducibles con valores originales y alterados, sin llamar a Claude ni Gemini. Los dos casos sobre evidencia directa de Artemis están etiquetados de antemano: comprueban que la cobertura parcial no se presente como directa. Los demás casos miden la abstención completa de interpretación al faltar cobertura. El informe evalúa estas decisiones de escenario, sin inferir la intención de la pregunta.",
    "",
    "| Pregunta | Acierto top-5 | Cobertura | Decisión | Acierto |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  writeFileSync(new URL("../docs/eval.md", import.meta.url), report);
});
