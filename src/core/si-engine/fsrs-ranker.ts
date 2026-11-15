import type { Atmosphere, Citation, EnvironmentPreset, ExperimentalRun, Investigation } from "../../types/psi";

const dimensions = ["oxygen_pct", "pressure_psia", "gravity_g", "flow_velocity_cm_s"] as const;
type Dimension = (typeof dimensions)[number];
type Bound = { axis: Dimension; side: "inferior" | "superior"; outside: boolean };
type Range = [number, number];
type QuantitativeInputs = Partial<Record<Dimension, {
  range: Range;
  measured: boolean;
  published: boolean;
  sources: Citation[];
}>>;
type FsrsWeights = Record<Dimension | "context", number>;

const scales: Atmosphere = { oxygen_pct: 12, pressure_psia: 4, gravity_g: 0.25, flow_velocity_cm_s: 10 };
export const fsrsWeights_pts: Readonly<FsrsWeights> = {
  oxygen_pct: 35, pressure_psia: 25, gravity_g: 12.5, flow_velocity_cm_s: 12.5, context: 15,
};
const highOxygenStudies = new Set(["CFI-G", "SAFFIRE-IV-V", "SAFFIRE-VI", "BASS-II"]);
const reducedPressureStudies = new Set(["SAFFIRE-IV-V", "SAFFIRE-VI"]);
const forcedFlowStudies = new Set(["BASS-II", "SLICE"]);
const documentedBridges = new Set(["BRE", "BASS-II", "SPICE", "SLICE", "SAME", "SAME-R", "DAFT", "FLEX", "FLEX-2", "CFI", "CFI-G", "E-FIELD"]);

export function oxygenPartialPressure_psia(atmosphere: Atmosphere) {
  return atmosphere.pressure_psia * atmosphere.oxygen_pct / 100;
}

function reportedRunValue(run: ExperimentalRun, axis: Dimension) {
  return run.nominal?.fields.includes(axis) ? undefined : run.atmosphere[axis];
}

export function computeFSRS(
  item: { study?: Investigation; runs: readonly ExperimentalRun[] },
  atmosphere: Atmosphere,
  priority?: EnvironmentPreset["priority"],
  weights: Readonly<FsrsWeights> = fsrsWeights_pts,
) {
  const inputs: QuantitativeInputs = {};
  for (const run of item.runs) {
    if (run.reference) continue;
    for (const axis of dimensions) {
      const profileValue = run.psiProfile?.[axis]?.value;
      const value = profileValue ?? reportedRunValue(run, axis);
      if (value === undefined) continue;
      const [min, max] = typeof value === "number" ? [value, value] : value;
      const input = inputs[axis] ?? { range: [min, max], measured: false, published: false, sources: [] };
      input.range = [Math.min(min, input.range[0]), Math.max(max, input.range[1])];
      input.measured ||= !run.psiProfile;
      input.published ||= Boolean(run.psiProfile);
      if (!input.sources.some(({ url, label }) => url === run.source.url && label === run.source.label)) {
        input.sources.push(run.source);
      }
      inputs[axis] = input;
    }
  }

  function explainCriterion(axis: Dimension) {
    const input = inputs[axis];
    const target = atmosphere[axis];
    const distance = input ? Math.max(0, input.range[0] - target, target - input.range[1]) : undefined;
    const similarity = distance === undefined ? 0 : Math.exp(-0.5 * (distance / scales[axis]) ** 2);
    return { axis, input, target, distance, similarity, contribution_pts: weights[axis] * similarity, weight_pts: weights[axis] };
  }

  const id = item.study?.id ?? item.runs[0]?.investigationId ?? "";
  const criteria = dimensions.map(explainCriterion);
  const [oxygen, pressure, gravity, flow] = criteria;
  const instrument = item.study && (!item.study.importedPsi || item.study.importedPsi.hardware.length) ? 0.4 : 0;
  const bridge = documentedBridges.has(id) ? 0.35 : 0;
  const pillar = priority && item.study?.safetyPillars.includes(priority) ? 0.25 : 0;
  const hardware = instrument + bridge + pillar;
  const oxygenBonus_pts = atmosphere.oxygen_pct >= 30 && highOxygenStudies.has(id) ? 15 : 0;
  const pressureBonus_pts = atmosphere.pressure_psia <= 10.5 && reducedPressureStudies.has(id) ? 10 : 0;
  const partialGravity = atmosphere.gravity_g >= 0.05 && atmosphere.gravity_g <= 0.40;
  const proxyBonus_pts = partialGravity && id === "E-FIELD" ? 22 : 0;
  const flowBonus_pts = partialGravity && forcedFlowStudies.has(id) ? 10 : 0;
  const bonus_pts = oxygenBonus_pts + pressureBonus_pts + proxyBonus_pts + flowBonus_pts;
  const context_pts = weights.context * hardware;
  const context = {
    total_pts: context_pts,
    weight_pts: weights.context,
    instrument_pts: weights.context * instrument,
    bridge_pts: weights.context * bridge,
    priority_pts: weights.context * pillar,
  };
  const base_pts = oxygen.contribution_pts + pressure.contribution_pts + gravity.contribution_pts + flow.contribution_pts + context_pts;
  const score = Math.min(100, base_pts + bonus_pts);
  return {
    score, bonus_pts, base_pts, criteria, context,
    atmosphere_pct: (oxygen.contribution_pts + pressure.contribution_pts) * 100 / (weights.oxygen_pct + weights.pressure_psia),
    flow_pct: flow.similarity * 100,
    gravityBridge_pct: (gravity.contribution_pts + context_pts) * 100 / (weights.gravity_g + weights.context),
  };
}

export type FSRS = ReturnType<typeof computeFSRS>;

export function rankRuns(
  runs: readonly ExperimentalRun[],
  investigations: ReadonlyMap<string, Investigation>,
  profile: EnvironmentPreset,
  target: Atmosphere,
) {
  const bounds = dimensions.map((axis) => {
    const values = runs.flatMap((run) => {
      const value = run.reference || run.psiProfile ? undefined : reportedRunValue(run, axis);
      return value === undefined ? [] : [value];
    });
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
      if (exact || run.reference || run.psiProfile) continue;
      const value = reportedRunValue(run, axis);
      if (value === low) runBounds.push({ axis, side: "inferior", outside: high === Infinity });
      if (value === high) runBounds.push({ axis, side: "superior", outside: low === -Infinity });
    }
    const fsrs = computeFSRS({ study: investigations.get(run.investigationId), runs: [run] }, target, profile.priority);
    return { run, ...fsrs, bounds: runBounds };
  }).sort((a, b) => b.score - a.score || a.run.id.localeCompare(b.run.id));
}
