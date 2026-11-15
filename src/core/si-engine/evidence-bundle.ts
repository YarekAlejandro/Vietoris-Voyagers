import type { Atmosphere, EnvironmentPreset, ExperimentalRun, Investigation } from "../../types/psi";
import { rankRuns } from "./fsrs-ranker";
import { compareRuns, comparisonAvailability, reportedComparisonRows, summarizeChangedDrivers } from "./git-diff";
import { computeCoverage, measuredRuns } from "./scenario-coverage";

const units = { oxygen_pct: "% O₂", pressure_psia: "psia", flow_velocity_cm_s: "cm/s", gravity_g: "g" } as const;
const axes = Object.keys(units) as (keyof Atmosphere)[];
const topCount = 5;
type Quantity = { field: string; value: number; unit: string };

function quantities(values: Partial<Atmosphere>): Quantity[] {
  return axes.flatMap((field) => values[field] === undefined ? [] : [{ field, value: values[field], unit: units[field] }]);
}

export function buildEvidenceBundle(state: {
  scenario: Atmosphere;
  profile: EnvironmentPreset;
  runs: readonly ExperimentalRun[];
  investigations: ReadonlyMap<string, Investigation>;
  focusIds?: readonly string[];
  comparison?: readonly [string, string];
}) {
  const runs = measuredRuns(state.runs);
  const byId = new Map(runs.map((run) => [run.id, run]));
  const ranked = rankRuns(runs, state.investigations, state.profile, state.scenario).slice(0, topCount);
  const coverage = computeCoverage(state.scenario, runs);
  const left = byId.get(state.comparison?.[0] ?? "");
  const right = byId.get(state.comparison?.[1] ?? "");
  const rows = left && right ? reportedComparisonRows(compareRuns(left, right, state.investigations), left, right) : [];
  const drivers = summarizeChangedDrivers(rows);
  const selected = new Set([...state.focusIds ?? [], ...state.comparison ?? [], ...ranked.map(({ run }) => run.id)]);
  if (coverage.closest) selected.add(coverage.closest.runId);
  const evidence = [...selected].flatMap((runId) => {
    const run = byId.get(runId);
    if (!run) return [];
    const values = { ...run.atmosphere };
    for (const axis of run.nominal?.fields ?? []) delete values[axis];
    const outcomes = compareRuns(run, run, state.investigations).filter((row) => row.outcome && row.valueA !== undefined);
    return [{
      runId, source: run.source, material: run.fuel, conditions: quantities(values),
      observations: outcomes.map(({ field, valueA }) => ({ field: field.label, value: valueA, unit: "unit" in field ? field.unit : null })),
    }];
  });
  const comparison = left && right ? {
    runIds: [left.id, right.id],
    changedVariables: drivers.changedVariables,
    rows: rows.map(({ field, valueA, valueB, nominalA, nominalB, outcome, status }) => ({
      field: field.label, unit: "unit" in field ? field.unit : null, outcome, status,
      a: { value: valueA ?? null, nominal: nominalA, availability: comparisonAvailability(field.id, valueA, left) },
      b: { value: valueB ?? null, nominal: nominalB, availability: comparisonAvailability(field.id, valueB, right) },
    })),
    quantities: rows.flatMap(({ field, delta, relativeDelta_pct }) => delta === undefined || !("unit" in field) ? [] : [
      { field: field.label, value: delta, unit: "deltaUnit" in field ? field.deltaUnit : field.unit },
      ...(relativeDelta_pct === undefined ? [] : [{ field: field.label, value: relativeDelta_pct, unit: "%" }]),
    ]),
  } : null;
  return {
    scenario: quantities(state.scenario),
    topRunIds: ranked.map(({ run }) => run.id),
    evidence,
    comparison,
    confounded: drivers.confounded,
    coverage: { status: coverage.status, withinTolerance: coverage.withinTolerance, closest: coverage.closest?.runId ?? null },
  };
}

type EvidenceBundle = ReturnType<typeof buildEvidenceBundle>;
export type ValidatedNarrative = { summary: string; claims: { text: string; runIds: string[] }[]; limitations: string[] };
const prohibited = /\b(?:segur[oa]s?|safe|certific\w*|garanti[sz]\w*|guarantee\w*|concluyente|no es conservador|explosiv\w*|re[- ]ignici[oó]n)\b/i;
const causal = /\b(?:caus\w*|debido a|a causa de|se debe a|atribu\w*|provoc\w*|produj\w*|gener[oó]|hizo que|result[oó] en|explica|determina|por efecto de|como consecuencia|due to|because|led to|resulted in|caus\w*|attribut\w*|produc\w*|dr[io]ve)\b/i;
const confoundingNotice = "Cambiaron varias condiciones a la vez: la diferencia no puede atribuirse a una sola variable.";
const unitsPattern = /(?<![\p{L}\d.,_])([+−-]?\d+(?:[.,]\d+)?)\s*(%\s*(?:O[₂2]|CO[₂2])?|(?:cm\/s|mm²\/s|mg\/min|psia|kPa|kV\/cm|ppm|pp|kJ|mm|cm|g|s)(?![\p{L}\d²/]))/giu;
const bareNumber = /(?<![\p{L}\d_])\d/u;
const normalizedUnit = (unit: string) => unit.toLowerCase().replace(/\s/g, "").replaceAll("₂", "2");

function validNumbers(text: string, quantities: readonly Quantity[]) {
  for (const [, literal, suffix] of text.matchAll(unitsPattern)) {
    const number = literal.replace(",", ".").replace("−", "-");
    const shown = Number(number);
    const decimals = number.split(".")[1]?.length ?? 0;
    const halfUnit = 0.5 * 10 ** -decimals;
    if (decimals > 6 || !quantities.some(({ value, unit }) => normalizedUnit(unit) === normalizedUnit(suffix) &&
        (shown === 0 || Math.sign(shown) === Math.sign(value)) && Math.abs(value - shown) <= halfUnit + 1e-9)) return false;
  }
  return !bareNumber.test(text.replace(unitsPattern, ""));
}

export function validateInterpretation(output: unknown, bundle: EvidenceBundle): ValidatedNarrative | null {
  if (!output || typeof output !== "object") return null;
  const { summary, claims, limitations } = output as Partial<ValidatedNarrative>;
  const validText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 500;
  if (!validText(summary) || !Array.isArray(claims) || !claims.length || claims.length > 5 ||
      !Array.isArray(limitations) || limitations.length > 5 || !limitations.every(validText)) return null;
  const byId = new Map(bundle.evidence.map((record) => [record.runId, record]));
  const hasSupportedText = (text: string, ids: readonly string[]) => {
    const textToCheck = text.replaceAll(confoundingNotice, "");
    if (prohibited.test(textToCheck) || (bundle.confounded && causal.test(textToCheck))) return false;
    const citedQuantities = ids.flatMap((id) => {
      const run = byId.get(id);
      return run ? [...run.conditions, ...run.observations.flatMap(({ field, value, unit }) =>
        typeof value === "number" && unit ? [{ field, value, unit }] : [])] : [];
    });
    const comparison = bundle.comparison;
    const deltas = comparison?.runIds.every((id) => ids.includes(id)) ? comparison.quantities : [];
    const comparedValues = comparison?.rows.flatMap(({ a, b, field, unit }) => [a, b].flatMap(({ value, nominal }, side) =>
      ids.includes(comparison.runIds[side]) && typeof value === "number" && unit && !nominal ? [{ field, value, unit }] : [])) ?? [];
    const scenarioValues = comparison ? [] : bundle.scenario;
    return validNumbers(textToCheck, [...scenarioValues, ...citedQuantities, ...comparedValues, ...deltas]);
  };
  const allIds = bundle.comparison?.runIds ?? [...byId.keys()];
  if (![summary, ...limitations].every((item) => hasSupportedText(item, allIds))) return null;
  for (const claim of claims) {
    if (!claim || !validText(claim.text) || !Array.isArray(claim.runIds) || !claim.runIds.length ||
        !claim.runIds.every((id) => allIds.includes(id)) || !hasSupportedText(claim.text, claim.runIds)) return null;
  }
  return { summary, claims, limitations };
}
