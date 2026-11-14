import type { Atmosphere, EnvironmentPreset, ExperimentalRun, Investigation } from "../../types/psi";

const gravityOffset_g = 1e-4;
const oxygenScale_pct = 12;
const partialPressureScale_psia = 2;
const gravityLogScale = 1.5;
const flowLogScale = 1;
const flowOffset_cm_s = 1;

export function oxygenPartialPressure_psia(atmosphere: Atmosphere) {
  return atmosphere.pressure_psia * atmosphere.oxygen_pct / 100;
}

function atmosphereSimilarity(record: ExperimentalRun, target: Atmosphere, weights: EnvironmentPreset["distanceWeights"]) {
  const run = record.atmosphere;
  const nominal = record.nominal?.fields ?? [];
  const gravityWeight = nominal.includes("gravity_g") ? 0 : weights.gravity;
  const oxygenWeight = nominal.includes("oxygen_pct") ? 0 : weights.oxygen;
  const partialPressureWeight = nominal.includes("oxygen_pct") || nominal.includes("pressure_psia") ? 0 : weights.partialPressure;
  const flowWeight = nominal.includes("flow_velocity_cm_s") ? 0 : weights.flow;
  const gravityLogDelta = Math.log10((run.gravity_g + gravityOffset_g) / (target.gravity_g + gravityOffset_g));
  const oxygenDelta_pct = run.oxygen_pct - target.oxygen_pct;
  const partialPressureDelta_psia = oxygenPartialPressure_psia(run) - oxygenPartialPressure_psia(target);
  const flowLogDelta = Math.log((run.flow_velocity_cm_s + flowOffset_cm_s) / (target.flow_velocity_cm_s + flowOffset_cm_s));

  const distanceSquared =
    gravityWeight * (gravityLogDelta / gravityLogScale) ** 2 +
    oxygenWeight * (oxygenDelta_pct / oxygenScale_pct) ** 2 +
    partialPressureWeight * (partialPressureDelta_psia / partialPressureScale_psia) ** 2 +
    flowWeight * (flowLogDelta / flowLogScale) ** 2;

  const coverage = nominal.length ? gravityWeight + oxygenWeight + partialPressureWeight + flowWeight : 1;
  return coverage * Math.exp(-distanceSquared / 2);
}

const dimensions = ["gravity_g", "oxygen_pct", "pressure_psia", "flow_velocity_cm_s"] as const;
type Dimension = (typeof dimensions)[number];
type Bound = { axis: Dimension; side: "inferior" | "superior"; outside: boolean };

export function rankRuns(
  runs: readonly ExperimentalRun[],
  investigations: ReadonlyMap<string, Investigation>,
  profile: EnvironmentPreset,
  target: Atmosphere,
) {
  const bounds = dimensions.map((axis) => {
    const values = runs.filter((run) => !run.nominal?.fields.includes(axis)).map((run) => run.atmosphere[axis]);
    const value = target[axis];
    return {
      axis,
      low: Math.max(-Infinity, ...values.filter((measured) => measured < value)),
      high: Math.min(Infinity, ...values.filter((measured) => measured > value)),
      exact: values.includes(value),
    };
  });

  return runs.map((run) => {
    const runBounds: Bound[] = [];
    for (const { axis, low, high, exact } of bounds) {
      if (exact || run.nominal?.fields.includes(axis)) continue;
      if (run.atmosphere[axis] === low) runBounds.push({ axis, side: "inferior", outside: high === Infinity });
      if (run.atmosphere[axis] === high) runBounds.push({ axis, side: "superior", outside: low === -Infinity });
    }

    const atmosphere = atmosphereSimilarity(run, target, profile.distanceWeights);
    const fuelMatch = run.fuelCategory === profile.targetFuel;
    const pillarMatch = investigations.get(run.investigationId)?.safetyPillars.includes(profile.priority) ?? false;
    const { scoreWeights } = profile;
    const proximity = atmosphere * scoreWeights.atmosphere +
      Number(fuelMatch) * scoreWeights.fuel +
      Number(pillarMatch) * scoreWeights.pillar;
    const boundingBonus = Math.max(0, ...runBounds.map((bound) => bound.outside ? 0.18 : 0.15));
    const score = 100 * Math.min(1, proximity + boundingBonus);
    return { run, score, bounds: runBounds, fuelMatch, pillarMatch, atmosphere };
  }).sort((a, b) => b.score - a.score || (a.run.id < b.run.id ? -1 : Number(a.run.id > b.run.id)));
}
