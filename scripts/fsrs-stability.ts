import { writeFileSync } from "node:fs";
import { fsrsWeights_pts, computeFSRS } from "../src/core/si-engine/fsrs-ranker.ts";
import { missionPresets } from "../src/data/mission_presets.ts";
import seed from "../src/data/psi_seed_data.json" with { type: "json" };
import type { PsiDataset } from "../src/types/psi.ts";

const dataset = seed as PsiDataset;
const runs = dataset.runs.filter((run) => !run.reference && !run.psiProfile &&
  Object.entries(run.atmosphere).some(([field, value]) =>
    Number.isFinite(value) && !run.nominal?.fields.some((axis) => axis === field)));
const studies = new Map(dataset.investigations.map((study) => [study.id, study]));
const sampleCount = 500;
const perturbationFraction = 0.20;
const topCount = 5;

// Semilla fija para reproducir la misma perturbación al regenerar el informe.
let seedState = 86437;
function sampleUniform() {
  seedState = (16807 * seedState) % 2147483647;
  return seedState / 2147483647;
}

type Weights = typeof fsrsWeights_pts;
const axes = Object.keys(fsrsWeights_pts) as (keyof Weights)[];
const perturbedWeights = Array.from({ length: sampleCount }, () => {
  const sampled = axes.map((key) => [key, fsrsWeights_pts[key] * (1 + perturbationFraction * (2 * sampleUniform() - 1))] as const);
  const total_pts = sampled.reduce((sum, [, pts]) => sum + pts, 0);
  return Object.fromEntries(sampled.map(([key, pts]) => [key, (100 / total_pts) * pts])) as Weights;
});

function topRuns(preset: typeof missionPresets[number], weights: Weights) {
  return runs.map((run) => ({
    id: run.id,
    score: computeFSRS({ study: studies.get(run.investigationId), runs: [run] },
      preset.atmosphere, preset.priority, weights).score,
  })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, topCount).map(({ id }) => id);
}

const rows = missionPresets.map((preset) => {
  const baseline = new Set(topRuns(preset, fsrsWeights_pts));
  const overlap_pct = perturbedWeights.map((weights) =>
    (100 / baseline.size) * topRuns(preset, weights).filter((id) => baseline.has(id)).length);
  const mean_pct = overlap_pct.reduce((sum, overlap) => sum + overlap, 0) / sampleCount;
  const sameSet_pct = (100 / sampleCount) * overlap_pct.filter((overlap) => overlap === 100).length;
  return { mission: preset.name, mean_pct, min_pct: Math.min(...overlap_pct), sameSet_pct, ids: [...baseline] };
});
console.table(rows.map(({ mission, mean_pct, min_pct, sameSet_pct }) => ({
  Perfil: mission,
  "Solapamiento medio": `${mean_pct.toFixed(2)} %`,
  "Mínimo observado": `${min_pct.toFixed(1)} %`,
  "Mismo conjunto": `${sameSet_pct.toFixed(1)} %`,
})));

const report = [
  "# Estabilidad del FSRS",
  "",
  `Prueba reproducible con ${runs.length} corridas curadas que aportan al menos una medida. Para cada perfil se usaron ${sampleCount} muestras uniformes independientes de los cinco pesos, con perturbaciones de ±${perturbationFraction * 100} % antes de renormalizarlos a 100 puntos. Las bonificaciones, los datos y los perfiles de misión permanecieron fijos.`,
  "",
  `El solapamiento es la fracción del top-${topCount} base que sigue en el conjunto de mayor puntaje tras cada perturbación. La métrica compara pertenencia al conjunto y omite el orden interno. El mínimo es el menor resultado entre las muestras. Este análisis evalúa sensibilidad del ordenamiento a los pesos y tiene alcance únicamente sobre el catálogo curado.`,
  "",
  "| Perfil | Top base | Solapamiento medio | Mínimo observado | Mismo conjunto |",
  "| --- | --- | ---: | ---: | ---: |",
  ...rows.map(({ mission, ids, mean_pct, min_pct, sameSet_pct }) => `| ${mission} | ${ids.map((id) => "\x60" + id + "\x60").join(", ")} | ${mean_pct.toFixed(2)} % | ${min_pct.toFixed(1)} % | ${sameSet_pct.toFixed(1)} % |`),
  "",
  "Regenera este informe con `node scripts/fsrs-stability.ts` desde la raíz del proyecto. [Fórmula del FSRS](fsrs.md)",
  "",
].join("\n");

writeFileSync(new URL("../docs/fsrs-stability.md", import.meta.url), report, "utf8");
