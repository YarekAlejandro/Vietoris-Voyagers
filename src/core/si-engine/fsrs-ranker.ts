import type { Atmosphere, EnvironmentPreset, ExperimentalRun, Investigation } from "../../types/psi";

const dimensions = ["oxygen_pct", "pressure_psia", "gravity_g", "flow_velocity_cm_s"] as const;
type Dimension = (typeof dimensions)[number];
type Bound = { axis: Dimension; side: "inferior" | "superior"; outside: boolean };
type Range = [number, number];
type Coverage = Partial<Record<Dimension, Range>>;

const scales: Atmosphere = { oxygen_pct: 12, pressure_psia: 4, gravity_g: 0.25, flow_velocity_cm_s: 10 };
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
) {
  const coverage: Coverage = {};
  for (const run of item.runs) {
    for (const axis of dimensions) {
      const value = run.psiProfile?.[axis]?.value ?? reportedRunValue(run, axis);
      if (value === undefined) continue;
      const [min, max] = typeof value === "number" ? [value, value] : value;
      const range = coverage[axis];
      coverage[axis] = range ? [Math.min(min, range[0]), Math.max(max, range[1])] : [min, max];
    }
  }
  function similarity(axis: Dimension) {
    const range = coverage[axis];
    if (!range) return 0;
    const value = atmosphere[axis];
    const distance = Math.max(0, range[0] - value, value - range[1]);
    return Math.exp(-0.5 * (distance / scales[axis]) ** 2);
  }

  const id = item.study?.id ?? item.runs[0]?.investigationId ?? "";
  const oxygen = similarity("oxygen_pct");
  const pressure = similarity("pressure_psia");
  const gravity = similarity("gravity_g");
  const flow = similarity("flow_velocity_cm_s");
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
  const score = Math.min(100, 35 * oxygen + 25 * pressure + 12.5 * (gravity + flow) + 15 * hardware + bonus_pts);
  return {
    score, bonus_pts,
    atmosphere_pct: (35 * oxygen + 25 * pressure) * 100 / 60,
    flow_pct: flow * 100,
    gravityBridge_pct: (12.5 * gravity + 15 * hardware) * 100 / 27.5,
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
