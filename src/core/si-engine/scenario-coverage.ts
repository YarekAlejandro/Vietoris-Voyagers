import { coverageTolerances, gravityClasses } from "../../data/coverage_config";
import type { Atmosphere, ExperimentalRun } from "../../types/psi";

const kpaPerPsia = 6.894757;
export function measuredRuns(runs: readonly ExperimentalRun[]) {
  return runs.filter((run) => !run.reference && !run.psiProfile);
}

function measuredAtmosphere(run: ExperimentalRun) {
  const values = { ...run.atmosphere };
  for (const field of run.nominal?.fields ?? []) delete values[field];
  return values;
}

function gravityClass(gravity_g: number) {
  return gravityClasses.reduce((best, item) =>
    Math.abs(gravity_g - item.gravity_g) < Math.abs(gravity_g - best.gravity_g) ? item : best).label;
}

export function computeCoverage(scenario: Atmosphere, runs: readonly ExperimentalRun[], tolerances = coverageTolerances) {
  const scenarioGravity = gravityClass(scenario.gravity_g);
  const difference = (actual: number | undefined, target: number, scale = 1) =>
    actual === undefined ? null : (actual - target) * scale;
  const candidates = measuredRuns(runs).flatMap((run) => {
    const values = measuredAtmosphere(run);
    if (!Object.keys(values).length) return [];
    const gap = {
      oxygen_pp: difference(values.oxygen_pct, scenario.oxygen_pct),
      pressure_kpa: difference(values.pressure_psia, scenario.pressure_psia, kpaPerPsia),
      flow_cm_s: difference(values.flow_velocity_cm_s, scenario.flow_velocity_cm_s),
      gravity: values.gravity_g === undefined ? null : gravityClass(values.gravity_g),
    };
    const distances = [
      gap.oxygen_pp === null ? null : Math.abs(gap.oxygen_pp) / tolerances.oxygen_pp,
      gap.pressure_kpa === null ? null : Math.abs(gap.pressure_kpa) / tolerances.pressure_kpa,
      gap.flow_cm_s === null ? null : Math.abs(gap.flow_cm_s) / tolerances.flow_cm_s,
      gap.gravity === null ? null : gap.gravity === scenarioGravity ? 0 : 2,
    ];
    const axesInRange = distances.filter((distance) => distance !== null && distance <= 1).length;
    const distance = distances.reduce<number>((sum, item) => sum + (item ?? 2), 0);
    return [{ runId: run.id, label: run.label, source: run.source, values, gap, axesInRange, distance }];
  }).sort((a, b) => a.distance - b.distance || a.runId.localeCompare(b.runId));
  const withinTolerance = candidates.filter(({ axesInRange }) => axesInRange === 4).length;
  const oxygenObserved = candidates.flatMap(({ values }) => values.oxygen_pct === undefined ? [] : [values.oxygen_pct]);
  const outsideOxygen = oxygenObserved.length > 0 &&
    (scenario.oxygen_pct < Math.min(...oxygenObserved) - tolerances.oxygen_pp ||
     scenario.oxygen_pct > Math.max(...oxygenObserved) + tolerances.oxygen_pp);
  const status = withinTolerance ? "directa"
    : !outsideOxygen && candidates.some(({ axesInRange }) => axesInRange > 0) ? "parcial" : "ninguna";
  return { status, withinTolerance, scenarioGravity, closest: candidates[0] ?? null, candidates } as const;
}

export type ScenarioCoverage = ReturnType<typeof computeCoverage>;
