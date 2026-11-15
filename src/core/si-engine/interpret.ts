import type { Atmosphere, Citation, EnvironmentPreset, ExperimentalRun, Investigation } from "../../types/psi";
import type { compareRuns } from "./git-diff";
import { oxygenPartialPressure_psia, type rankRuns } from "./fsrs-ranker";

// Lógica pura para la interpretación con IA: el modelo solo redacta, los números salen de aquí.

export type InterpretMode = "engineer" | "student";
export type InterpretLang = "es" | "en";
type DiffRow = ReturnType<typeof compareRuns>[number];
type RankResult = ReturnType<typeof rankRuns>[number];
type Missing = "missing";
type AtmosphereAxis = keyof Atmosphere;
/** Un eje medido o "missing" si la corrida no lo reporta (la atmósfera del catálogo puede ser parcial). */
type Measured = number | Missing;
export type PayloadAtmosphere = Record<AtmosphereAxis, Measured>;

const atmosphereAxisList: readonly AtmosphereAxis[] = ["gravity_g", "oxygen_pct", "pressure_psia", "flow_velocity_cm_s"];

/** Estados de `compareRuns`. Un estado nuevo hace fallar `diffStatus` (y sus pruebas) en lugar de pasar en silencio. */
export const diffStatuses = ["equal", "changed", "missing", "nominal"] as const;
export type DiffStatus = (typeof diffStatuses)[number];

export function diffStatus(status: string): DiffStatus {
  const known = diffStatuses.find((candidate) => candidate === status);
  if (!known) throw new Error(`Estado de diff desconocido: ${status}`);
  return known;
}

// El payload lleva los números ya redondeados como se muestran: así el modelo, la plantilla y
// validateNumbers trabajan con las mismas cifras.
function round(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

/** Valor tal como lo muestra la tabla del comparador (redondeado a los decimales del campo). */
function shown(value: number | string | undefined, decimals: number | null): number | string | Missing {
  if (value === undefined) return "missing";
  return typeof value === "number" && decimals !== null ? round(value, decimals) : value;
}

function measuredAtmosphere(atmosphere: Partial<Atmosphere>): PayloadAtmosphere {
  return {
    gravity_g: atmosphere.gravity_g ?? "missing",
    oxygen_pct: atmosphere.oxygen_pct ?? "missing",
    pressure_psia: atmosphere.pressure_psia ?? "missing",
    flow_velocity_cm_s: atmosphere.flow_velocity_cm_s ?? "missing",
  };
}

/** Presión parcial de O₂, solo si la corrida reporta oxígeno y presión. */
function partialPressure(atmosphere: Partial<Atmosphere>): Measured {
  const { oxygen_pct, pressure_psia } = atmosphere;
  if (oxygen_pct === undefined || pressure_psia === undefined) return "missing";
  return round(oxygenPartialPressure_psia({ gravity_g: 0, flow_velocity_cm_s: 0, oxygen_pct, pressure_psia }), 2);
}

/** Ejes de la atmósfera que no se midieron y usan un valor nominal documentado. */
export type PayloadNominal = { fields: AtmosphereAxis[]; basis: string } | null;

export interface PayloadRun {
  id: string;
  label: string;
  investigationId: string;
  facility: string | Missing;
  /** Perfil nominal PSI: describe condiciones de referencia, no es una corrida medida. */
  reference: boolean;
  gravity_g: Measured;
  oxygen_partial_pressure_psia: Measured;
  /** La presión parcial se calcula con O₂ o presión nominales, así que también es nominal. */
  oxygen_partial_pressure_nominal: boolean;
  nominal: PayloadNominal;
  source: Citation;
}

function partialPressureIsNominal(run: ExperimentalRun) {
  return run.nominal?.fields.some((axis) => axis === "oxygen_pct" || axis === "pressure_psia") ?? false;
}

function payloadNominal(run: ExperimentalRun): PayloadNominal {
  return run.nominal ? { fields: [...run.nominal.fields], basis: run.nominal.basis } : null;
}

export interface DiffPayloadRow {
  id: string;
  label: string;
  unit: string | null;
  deltaUnit: string | null;
  decimals: number | null;
  valueA: number | string | Missing;
  valueB: number | string | Missing;
  /** El valor de A o de B es nominal (no medido); en ese caso status es "nominal" y no hay delta. */
  nominalA: boolean;
  nominalB: boolean;
  /** Resultado observado (true) o condición del ensayo (false). */
  outcome: boolean;
  /** En qué corrida falta el dato: "A", "B" o "both"; null si ambas lo reportan. */
  missingIn: "A" | "B" | "both" | null;
  status: DiffStatus;
  delta: number | null;
  relativeDelta_pct: number | null;
}

export interface DiffPayload {
  runs: { a: PayloadRun; b: PayloadRun };
  rows: DiffPayloadRow[];
}

/**
 * Desglose del FSRS tal como lo calcula `computeFSRS` (`fsrs-ranker.ts`) y lo muestra la interfaz.
 * No incluye pesos ni constantes de la fórmula: si la fórmula cambia, la interpretación sigue siendo válida.
 */
export interface RankPayload {
  run: Omit<PayloadRun, "facility"> & { atmosphere: PayloadAtmosphere; fuel: string; fuelCategory: string };
  study: { id: string; safetyPillars: string[] } | null;
  profile: { id: string; name: string; priority: string };
  target: Atmosphere & { oxygen_partial_pressure_psia: number };
  score: number;
  scoreMax: 100;
  /** Componentes en %, redondeados como en la interfaz: atmósfera (O₂ y presión), flujo y gravedad/puente. */
  atmosphere_pct: number;
  flow_pct: number;
  gravityBridge_pct: number;
  /** Bonificación por escenario, en puntos. */
  bonus_pts: number;
  bounds: { axis: AtmosphereAxis; side: "inferior" | "superior"; outside: boolean }[];
}

export type InterpretRequest =
  | { kind: "diff"; payload: DiffPayload; mode: InterpretMode; lang: InterpretLang }
  | { kind: "rank"; payload: RankPayload; mode: InterpretMode; lang: InterpretLang };

export interface Interpretation {
  paragraphs: string[];
  caveats: string[];
  fieldsUsed: string[];
}

export interface InterpretationResult extends Interpretation {
  source: "ai" | "template";
  /** Proveedor que redactó el texto cuando `source` es "ai". */
  provider?: "anthropic" | "gemini";
}

function payloadRun(run: ExperimentalRun, investigations: ReadonlyMap<string, Investigation>): PayloadRun {
  return {
    id: run.id,
    label: run.label,
    investigationId: run.investigationId,
    facility: investigations.get(run.investigationId)?.facility ?? "missing",
    reference: run.reference === true,
    gravity_g: run.atmosphere.gravity_g ?? "missing",
    oxygen_partial_pressure_psia: partialPressure(run.atmosphere),
    oxygen_partial_pressure_nominal: partialPressureIsNominal(run),
    nominal: payloadNominal(run),
    source: { label: run.source.label, url: run.source.url },
  };
}

export function buildDiffPayload(
  a: ExperimentalRun,
  b: ExperimentalRun,
  rows: readonly DiffRow[],
  investigations: ReadonlyMap<string, Investigation>,
): DiffPayload {
  return {
    runs: { a: payloadRun(a, investigations), b: payloadRun(b, investigations) },
    // Se respeta el orden de compareRuns: resultados, cambios, faltantes e iguales.
    rows: rows.map(({ field, valueA, valueB, nominalA, nominalB, outcome, status, delta, relativeDelta_pct }) => {
      const unit = "unit" in field ? field.unit : null;
      const decimals = "decimals" in field ? field.decimals : null;
      return {
        id: field.id,
        label: field.label,
        unit,
        deltaUnit: "deltaUnit" in field ? field.deltaUnit : unit,
        decimals,
        valueA: shown(valueA, decimals),
        valueB: shown(valueB, decimals),
        nominalA,
        nominalB,
        outcome,
        missingIn: valueA === undefined && valueB === undefined ? "both" : valueA === undefined ? "A" : valueB === undefined ? "B" : null,
        status: diffStatus(status), // compareRuns lo infiere como string
        delta: delta === undefined ? null : decimals === null ? delta : round(delta, decimals),
        relativeDelta_pct: relativeDelta_pct === undefined ? null : round(relativeDelta_pct, 1),
      };
    }),
  };
}

export function buildRankPayload(
  result: RankResult,
  profile: EnvironmentPreset,
  target: Atmosphere,
  investigations: ReadonlyMap<string, Investigation>,
): RankPayload {
  const { run } = result;
  const study = investigations.get(run.investigationId);
  return {
    run: {
      id: run.id,
      label: run.label,
      investigationId: run.investigationId,
      reference: run.reference === true,
      gravity_g: run.atmosphere.gravity_g ?? "missing",
      oxygen_partial_pressure_psia: partialPressure(run.atmosphere),
      oxygen_partial_pressure_nominal: partialPressureIsNominal(run),
      nominal: payloadNominal(run),
      source: { label: run.source.label, url: run.source.url },
      atmosphere: measuredAtmosphere(run.atmosphere),
      fuel: run.fuel ?? "missing",
      fuelCategory: run.fuelCategory ?? "missing",
    },
    study: study ? { id: study.id, safetyPillars: [...study.safetyPillars] } : null,
    profile: { id: profile.id, name: profile.name, priority: profile.priority },
    target: { ...target, oxygen_partial_pressure_psia: round(oxygenPartialPressure_psia(target), 2) },
    score: round(result.score, 1),
    scoreMax: 100,
    // Redondeo como ScoreDetails (Math.round) en RankedDatasetList.
    atmosphere_pct: Math.round(result.atmosphere_pct),
    flow_pct: Math.round(result.flow_pct),
    gravityBridge_pct: Math.round(result.gravityBridge_pct),
    bonus_pts: Math.round(result.bonus_pts),
    bounds: result.bounds.map((bound) => ({ ...bound })),
  };
}

// ---------- Plantilla determinista ----------

const text = {
  es: {
    changed: (n: number, a: string, b: string) => `Entre ${a} (A) y ${b} (B) ${n === 1 ? "cambió una condición" : "cambiaron varias condiciones"}: `,
    noChange: (a: string, b: string) => `Entre ${a} (A) y ${b} (B) no cambió ninguna condición registrada.`,
    outcomes: "Resultados observados que cambiaron: ",
    equal: "Se mantienen iguales: ",
    missing: "Sin dato en al menos una corrida: ",
    nominalRows: "Valor nominal, no medido: ",
    nominalBasis: (side: string, basis: string) => `Valor nominal en ${side}: ${basis}`,
    nominalAxes: (axes: string, basis: string) => `Valores nominales, no medidos (${axes}): ${basis} El FSRS no los usa como mediciones.`,
    missingAxes: (axes: string) => `La corrida no reporta ${axes}; esos ejes no se pueden comparar con el objetivo.`,
    reference: (side: string, label: string) => `${side}${label} es un perfil nominal PSI: describe condiciones de referencia, no es una corrida medida.`,
    nominalTag: "nominal",
    noData: "sin dato",
    partial: { engineer: "La presión parcial de O₂ es", student: "La presión que aporta el oxígeno es" },
    partialPair: (a: string, b: string) => ` ${a} en A y ${b} en B.`,
    partialOnly: { engineer: "La presión parcial de O₂ solo está disponible en", student: "La presión que aporta el oxígeno solo está disponible en" },
    many: "Cambiaron varias condiciones a la vez; no se puede atribuir la diferencia de resultados a una sola.",
    gaps: (labels: string) => `Faltan datos en: ${labels}.`,
    zeroG: "Ambas corridas son de 0 g; no hay datos de gravedad parcial en PSI.",
    score: (label: string, score: string, max: string, profile: string) => `${label} obtiene ${score} de ${max} en FSRS para el perfil ${profile}.`,
    components: (atm: string, flow: string, grav: string) => ` Componentes: atmósfera ${atm} %, flujo ${flow} % y gravedad/puente ${grav} %.`,
    bonus: (pts: string) => ` Incluye una bonificación por escenario de ${pts} pts.`,
    pillar: (match: boolean, pillar: string) => match
      ? ` El estudio cubre el pilar prioritario del perfil (${pillar}).`
      : ` El estudio no cubre el pilar prioritario del perfil (${pillar}).`,
    bounds: (list: string) => ` Además, la corrida es cota ${list}.`,
    bound: (side: string, axis: string, outside: boolean) => `${side} en ${axis}${outside ? " (objetivo fuera del rango medido)" : ""}`,
    conditions: (run: string, target: string) => `Condiciones de la corrida: ${run}. Objetivo: ${target}.`,
    gravity: (run: string, target: string) => `La corrida es de ${run} g y el objetivo es ${target} g; no hay datos de gravedad parcial en PSI.`,
    axes: { gravity_g: "gravedad", oxygen_pct: "oxígeno", pressure_psia: "presión", flow_velocity_cm_s: "flujo" },
    sides: { inferior: "inferior", superior: "superior" },
    pillars: { PREVENTION: "prevención", DETECTION: "detección", SUPPRESSION: "supresión" } as Record<string, string>,
  },
  en: {
    changed: (n: number, a: string, b: string) => `Between ${a} (A) and ${b} (B), ${n === 1 ? "one condition changed" : "several conditions changed"}: `,
    noChange: (a: string, b: string) => `Between ${a} (A) and ${b} (B), no recorded condition changed.`,
    outcomes: "Observed outcomes that changed: ",
    equal: "Unchanged: ",
    missing: "Missing in at least one run: ",
    nominalRows: "Nominal value, not measured: ",
    nominalBasis: (side: string, basis: string) => `Nominal value in ${side}: ${basis}`,
    nominalAxes: (axes: string, basis: string) => `Nominal, unmeasured values (${axes}): ${basis} FSRS does not use them as measurements.`,
    missingAxes: (axes: string) => `The run does not report ${axes}; those axes cannot be compared with the target.`,
    reference: (side: string, label: string) => `${side}${label} is a PSI nominal profile: it describes reference conditions, not a measured run.`,
    nominalTag: "nominal",
    noData: "no data",
    partial: { engineer: "The O₂ partial pressure is", student: "The pressure contributed by oxygen is" },
    partialPair: (a: string, b: string) => ` ${a} in A and ${b} in B.`,
    partialOnly: { engineer: "The O₂ partial pressure is only available in", student: "The pressure contributed by oxygen is only available in" },
    many: "Several conditions changed at once; the difference in outcomes cannot be attributed to a single one.",
    gaps: (labels: string) => `Missing data in: ${labels}.`,
    zeroG: "Both runs are at 0 g; PSI has no partial-gravity data.",
    score: (label: string, score: string, max: string, profile: string) => `${label} scores ${score} out of ${max} on FSRS for the ${profile} profile.`,
    components: (atm: string, flow: string, grav: string) => ` Components: atmosphere ${atm} %, flow ${flow} % and gravity/bridge ${grav} %.`,
    bonus: (pts: string) => ` It includes a scenario bonus of ${pts} pts.`,
    pillar: (match: boolean, pillar: string) => match
      ? ` The study covers the profile's priority pillar (${pillar}).`
      : ` The study does not cover the profile's priority pillar (${pillar}).`,
    bounds: (list: string) => ` The run also bounds the target ${list}.`,
    bound: (side: string, axis: string, outside: boolean) => `${side} in ${axis}${outside ? " (target outside the measured range)" : ""}`,
    conditions: (run: string, target: string) => `Run conditions: ${run}. Target: ${target}.`,
    gravity: (run: string, target: string) => `The run is at ${run} g and the target is ${target} g; PSI has no partial-gravity data.`,
    axes: { gravity_g: "gravity", oxygen_pct: "oxygen", pressure_psia: "pressure", flow_velocity_cm_s: "flow" },
    sides: { inferior: "from below", superior: "from above" },
    pillars: { PREVENTION: "prevention", DETECTION: "detection", SUPPRESSION: "suppression" } as Record<string, string>,
  },
} as const;

function format(value: number | string, decimals: number | null, unit: string | null) {
  if (typeof value === "string") return value;
  const number = value.toFixed(decimals ?? 2);
  return unit ? `${number} ${unit}` : number;
}

function sentence(value: string) {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

const axisFormat: Record<AtmosphereAxis, { decimals: number; unit: string }> = {
  gravity_g: { decimals: 3, unit: "g" },
  oxygen_pct: { decimals: 1, unit: "% O₂" },
  pressure_psia: { decimals: 2, unit: "psia" },
  flow_velocity_cm_s: { decimals: 1, unit: "cm/s" },
};

function atmosphereText(atmosphere: Record<AtmosphereAxis, Measured>, noData: string, nominal: readonly AtmosphereAxis[] = [], tag = "") {
  return atmosphereAxisList.map((axis) => {
    const value = atmosphere[axis];
    const { decimals, unit } = axisFormat[axis];
    if (value === "missing") return `${unit} ${noData}`;
    return `${value.toFixed(decimals)} ${unit}${nominal.includes(axis) ? ` (${tag})` : ""}`;
  }).join(", ");
}

function partialText(run: PayloadRun, t: (typeof text)[InterpretLang]) {
  const value = run.oxygen_partial_pressure_psia;
  if (value === "missing") return t.noData;
  return `${value.toFixed(2)} psia${run.oxygen_partial_pressure_nominal ? ` (${t.nominalTag})` : ""}`;
}

function diffTemplate(payload: DiffPayload, mode: InterpretMode, lang: InterpretLang): Interpretation {
  const t = text[lang];
  const { a, b } = payload.runs;
  const changedRows = payload.rows.filter(({ status }) => status === "changed");
  const conditions = changedRows.filter(({ outcome }) => !outcome);
  const outcomes = changedRows.filter(({ outcome }) => outcome);
  const equal = payload.rows.filter(({ status }) => status === "equal");
  const missing = payload.rows.filter(({ status }) => status === "missing");
  const nominal = payload.rows.filter(({ status }) => status === "nominal");
  const change = (row: DiffPayloadRow) =>
    `${row.label} (${format(row.valueA, row.decimals, row.unit)} → ${format(row.valueB, row.decimals, row.unit)})`;
  // Una sola nota si A y B comparten la misma base nominal.
  const bases = a.nominal && b.nominal && a.nominal.basis === b.nominal.basis
    ? [t.nominalBasis("A/B", a.nominal.basis)]
    : [a.nominal && t.nominalBasis("A", a.nominal.basis), b.nominal && t.nominalBasis("B", b.nominal.basis)];

  const first = [
    conditions.length === 0
      ? t.noChange(a.label, b.label)
      : t.changed(conditions.length, a.label, b.label) + conditions.map(change).join("; ") + ".",
    outcomes.length > 0 ? t.outcomes + outcomes.map(change).join("; ") + "." : "",
  ].filter(Boolean).join(" ");
  const missingA = a.oxygen_partial_pressure_psia === "missing";
  const missingB = b.oxygen_partial_pressure_psia === "missing";
  const partialSentence = missingA && missingB ? ""
    : missingA ? `${t.partialOnly[mode]} B: ${partialText(b, t)}.`
      : missingB ? `${t.partialOnly[mode]} A: ${partialText(a, t)}.`
        : t.partial[mode] + t.partialPair(partialText(a, t), partialText(b, t));
  const second = [
    equal.length > 0 ? t.equal + equal.map(({ label }) => label).join(", ") + "." : "",
    missing.length > 0 ? t.missing + missing.map(({ label }) => label).join(", ") + "." : "",
    nominal.length > 0 ? t.nominalRows + nominal.map(({ label }) => label).join(", ") + "." : "",
    partialSentence,
  ].filter(Boolean).join(" ");

  const caveats = [
    conditions.length > 1 ? t.many : "",
    a.reference ? t.reference("A: ", a.label) : "",
    b.reference ? t.reference("B: ", b.label) : "",
    missing.length > 0 ? t.gaps(missing.map(({ label }) => label).join(", ")) : "",
    ...(nominal.length > 0 ? bases.map((basis) => (basis ? sentence(basis) : "")) : []),
    a.gravity_g === 0 && b.gravity_g === 0 ? t.zeroG : "",
  ].filter((caveat): caveat is string => Boolean(caveat));

  return { paragraphs: [first, second].filter(Boolean), caveats, fieldsUsed: payload.rows.map(({ id }) => id) };
}

function rankTemplate(payload: RankPayload, lang: InterpretLang): Interpretation {
  const t = text[lang];
  const { run, profile, target, study } = payload;
  const bounds = payload.bounds.map(({ axis, side, outside }) => t.bound(t.sides[side], t.axes[axis], outside));
  const pillar = t.pillars[profile.priority] ?? profile.priority;
  const first = t.score(run.label, payload.score.toFixed(1), String(payload.scoreMax), profile.name) +
    t.components(String(payload.atmosphere_pct), String(payload.flow_pct), String(payload.gravityBridge_pct)) +
    (payload.bonus_pts > 0 ? t.bonus(String(payload.bonus_pts)) : "") +
    (study ? t.pillar(study.safetyPillars.includes(profile.priority), pillar) : "") +
    (bounds.length > 0 ? t.bounds(bounds.join(", ")) : "");
  const nominalAxes = run.nominal?.fields ?? [];
  const missingAxes = atmosphereAxisList.filter((axis) => run.atmosphere[axis] === "missing");
  const second = t.conditions(atmosphereText(run.atmosphere, t.noData, nominalAxes, t.nominalTag), atmosphereText(target, t.noData));
  const caveats = [
    run.reference ? t.reference("", run.label) : "",
    missingAxes.length > 0 ? t.missingAxes(missingAxes.map((axis) => t.axes[axis]).join(", ")) : "",
    run.nominal && nominalAxes.length > 0
      ? t.nominalAxes(nominalAxes.map((axis) => t.axes[axis]).join(", "), sentence(run.nominal.basis))
      : "",
    typeof run.atmosphere.gravity_g === "number" && run.atmosphere.gravity_g !== target.gravity_g
      ? t.gravity(run.atmosphere.gravity_g.toFixed(3), target.gravity_g.toFixed(3))
      : "",
  ].filter(Boolean);
  return {
    paragraphs: [first, second],
    caveats,
    fieldsUsed: ["score", "atmosphere_pct", "flow_pct", "gravityBridge_pct", "bonus_pts", "study.safetyPillars", "bounds", "run.atmosphere", "target"],
  };
}

export function templateInterpretation(request: InterpretRequest): Interpretation {
  return request.kind === "diff"
    ? diffTemplate(request.payload, request.mode, request.lang)
    : rankTemplate(request.payload, request.lang);
}

// ---------- Validación de números ----------

// Un número que no está pegado a letras (así se ignoran CO2, E6 o PSI-25). Acepta coma decimal.
const numberPattern = /(?<![\p{L}\d_.,\-−])([-−+]?)(\d+(?:[.,]\d+)?)(?![.,]?\d)/gu;

function extractNumbers(source: string) {
  return [...source.matchAll(numberPattern)].map((match) => {
    const literal = match[2].replace(",", ".");
    const decimals = literal.includes(".") ? literal.split(".")[1].length : 0;
    return { value: Number(literal), decimals, literal: match[0] };
  });
}

function collectAllowed(value: unknown, into: number[]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    into.push(Math.abs(value));
    if (Math.abs(value) <= 1) into.push(Math.abs(value) * 100); // similitudes y pesos expresados en %
  } else if (typeof value === "string") {
    for (const { value: number } of extractNumbers(value)) into.push(number);
  } else if (Array.isArray(value)) {
    for (const item of value) collectAllowed(item, into);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectAllowed(item, into);
  }
  return into;
}

export function validateNumbers(source: string, payload: DiffPayload | RankPayload) {
  const allowed = collectAllowed(payload, []);
  const unknown: number[] = [];
  for (const { value, decimals } of extractNumbers(source)) {
    if (decimals === 0 && value <= 3) continue; // conteos como «dos variables» o «2 corridas»
    const scale = 10 ** decimals;
    const matches = allowed.some((candidate) => Math.abs(Math.round(candidate * scale) / scale - value) < 1e-9);
    if (!matches) unknown.push(value);
  }
  return { ok: unknown.length === 0, unknown };
}

// ---------- Validación del cuerpo de la petición ----------

const maxString = 400;
const maxArray = 60;

function withinLimits(value: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (typeof value === "string") return value.length <= maxString;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean" || value === null) return true;
  if (Array.isArray(value)) return value.length <= maxArray && value.every((item) => withinLimits(item, depth + 1));
  if (typeof value === "object") return Object.values(value).every((item) => withinLimits(item, depth + 1));
  return false;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const atmosphereAxes: readonly string[] = ["gravity_g", "oxygen_pct", "pressure_psia", "flow_velocity_cm_s"];
const isNominal = (value: unknown) => value === null || (isObject(value) && typeof value.basis === "string" &&
  Array.isArray(value.fields) && value.fields.every((axis) => typeof axis === "string" && atmosphereAxes.includes(axis)));
const isMeasured = (value: unknown) => typeof value === "number" || value === "missing";
const isRun = (value: unknown) => isObject(value) && typeof value.id === "string" && typeof value.label === "string" &&
  isMeasured(value.oxygen_partial_pressure_psia) && isMeasured(value.gravity_g) && isNominal(value.nominal) &&
  typeof value.oxygen_partial_pressure_nominal === "boolean" && typeof value.reference === "boolean" &&
  isObject(value.source) && typeof value.source.label === "string" && typeof value.source.url === "string";
const isValue = (value: unknown) => typeof value === "number" || typeof value === "string";
const isAtmosphere = (value: unknown) => isObject(value) &&
  atmosphereAxes.every((axis) => typeof value[axis] === "number");
const isMeasuredAtmosphere = (value: unknown) => isObject(value) && atmosphereAxes.every((axis) => isMeasured(value[axis]));

function isDiffPayload(value: unknown): value is DiffPayload {
  return isObject(value) && isObject(value.runs) && isRun(value.runs.a) && isRun(value.runs.b) &&
    Array.isArray(value.rows) && value.rows.every((row) => isObject(row) &&
      typeof row.id === "string" && typeof row.label === "string" && isValue(row.valueA) && isValue(row.valueB) &&
      typeof row.nominalA === "boolean" && typeof row.nominalB === "boolean" && typeof row.outcome === "boolean" &&
      (row.missingIn === null || row.missingIn === "A" || row.missingIn === "B" || row.missingIn === "both") &&
      diffStatuses.some((status) => status === row.status));
}

function isRankPayload(value: unknown): value is RankPayload {
  const isStudy = (study: unknown) => study === null || (isObject(study) && typeof study.id === "string" &&
    Array.isArray(study.safetyPillars) && study.safetyPillars.every((pillar) => typeof pillar === "string"));
  return isObject(value) && isRun(value.run) && isObject(value.run) && isMeasuredAtmosphere(value.run.atmosphere) &&
    isStudy(value.study) && isObject(value.profile) && typeof value.profile.name === "string" &&
    typeof value.profile.priority === "string" && isAtmosphere(value.target) &&
    typeof value.score === "number" && value.scoreMax === 100 &&
    ["atmosphere_pct", "flow_pct", "gravityBridge_pct", "bonus_pts"].every((key) => typeof value[key] === "number") &&
    Array.isArray(value.bounds);
}

export function parseInterpretRequest(body: unknown): InterpretRequest | null {
  if (!isObject(body) || !withinLimits(body)) return null;
  const { kind, payload, mode, lang } = body;
  if ((mode !== "engineer" && mode !== "student") || (lang !== "es" && lang !== "en")) return null;
  if (kind === "diff" && isDiffPayload(payload)) return { kind, payload, mode, lang };
  if (kind === "rank" && isRankPayload(payload)) return { kind, payload, mode, lang };
  return null;
}

export function isInterpretation(value: unknown): value is Interpretation {
  const strings = (item: unknown) => Array.isArray(item) && item.every((entry) => typeof entry === "string");
  return isObject(value) && strings(value.paragraphs) && strings(value.caveats) && strings(value.fieldsUsed) &&
    (value.paragraphs as string[]).length > 0;
}

export function interpretationKey(request: InterpretRequest) {
  if (request.kind === "diff") return `diff|${request.payload.runs.a.id}|${request.payload.runs.b.id}|${request.mode}|${request.lang}`;
  const { gravity_g, oxygen_pct, pressure_psia, flow_velocity_cm_s } = request.payload.target;
  const atmosphere = [gravity_g, oxygen_pct, pressure_psia, flow_velocity_cm_s].join(",");
  return `rank|${request.payload.run.id}|${request.payload.profile.id}|${atmosphere}|${request.mode}|${request.lang}`;
}
