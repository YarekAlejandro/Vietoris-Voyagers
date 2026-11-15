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
  let validValues = 0;
  let invalidValues = 0;
  let numericalTotal = 0;
  const rows = questions.map(({ q, profile, expected, abstain }) => {
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
    const observedAbstention = coverage.status === "ninguna";
    abstention += Number(observedAbstention === abstain);
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
    return `| ${q} | ${expected.length ? (hit ? "Sí" : "No") : "—"} | ${coverage.status} | ${abstain === observedAbstention ? "Sí" : "No"} |`;
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
    `- Acierto de abstención · ${fraction(abstention, questions.length)}.`,
    "",
    "La prueba de cifras usa textos reproducibles con valores originales y alterados. No llama a Claude ni Gemini. La abstención se comprueba a nivel de escenario, independientemente de la coincidencia de texto de la pregunta.",
    "",
    "| Pregunta | Acierto top-5 | Cobertura | Abstención correcta |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  writeFileSync(new URL("../docs/eval.md", import.meta.url), report);
});
