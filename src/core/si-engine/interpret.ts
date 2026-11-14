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

/** Estados de `compareRuns`. Un estado nuevo hace fallar `diffStatus` (y sus pruebas) en lugar de pasar en silencio. */
export const diffStatuses = ["equal", "changed", "missing", "nominal"] as const;
export type DiffStatus = (typeof diffStatuses)[number];

export function diffStatus(status: string): DiffStatus {
  const known = diffStatuses.find((candidate) => candidate === status);
  if (!known) throw new Error(`Estado de diff desconocido: ${status}`);
  return known;
}

/** Ejes de la atmósfera que no se midieron y usan un valor nominal documentado. */
export type PayloadNominal = { fields: AtmosphereAxis[]; basis: string } | null;

export interface PayloadRun {
  id: string;
  label: string;
  investigationId: string;
  facility: string | Missing;
  gravity_g: number;
  oxygen_partial_pressure_psia: number;
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
  status: DiffStatus;
  delta: number | null;
  relativeDelta_pct: number | null;
}

export interface DiffPayload {
  runs: { a: PayloadRun; b: PayloadRun };
  rows: DiffPayloadRow[];
}

export interface RankPayload {
  run: Omit<PayloadRun, "facility"> & { atmosphere: Atmosphere; fuel: string; fuelCategory: string };
  profile: {
    id: string;
    name: string;
    targetFuel: string;
    priority: string;
    scoreWeights: EnvironmentPreset["scoreWeights"];
    distanceWeights: EnvironmentPreset["distanceWeights"];
  };
  target: Atmosphere & { oxygen_partial_pressure_psia: number };
  score: number;
  scoreMax: 100;
  atmosphereSimilarity: number;
  fuelMatch: boolean;
  pillarMatch: boolean;
  bounds: { axis: keyof Atmosphere; side: "inferior" | "superior"; outside: boolean }[];
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
    gravity_g: run.atmosphere.gravity_g,
    oxygen_partial_pressure_psia: oxygenPartialPressure_psia(run.atmosphere),
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
    rows: rows.map(({ field, valueA, valueB, nominalA, nominalB, status, delta, relativeDelta_pct }) => {
      const unit = "unit" in field ? field.unit : null;
      return {
        id: field.id,
        label: field.label,
        unit,
        deltaUnit: "deltaUnit" in field ? field.deltaUnit : unit,
        decimals: "decimals" in field ? field.decimals : null,
        valueA: valueA ?? "missing",
        valueB: valueB ?? "missing",
        nominalA,
        nominalB,
        status: diffStatus(status), // compareRuns lo infiere como string
        delta: delta ?? null,
        relativeDelta_pct: relativeDelta_pct ?? null,
      };
    }),
  };
}

export function buildRankPayload(result: RankResult, profile: EnvironmentPreset, target: Atmosphere): RankPayload {
  const { run } = result;
  return {
    run: {
      id: run.id,
      label: run.label,
      investigationId: run.investigationId,
      gravity_g: run.atmosphere.gravity_g,
      oxygen_partial_pressure_psia: oxygenPartialPressure_psia(run.atmosphere),
      oxygen_partial_pressure_nominal: partialPressureIsNominal(run),
      nominal: payloadNominal(run),
      source: { label: run.source.label, url: run.source.url },
      atmosphere: { ...run.atmosphere },
      fuel: run.fuel,
      fuelCategory: run.fuelCategory,
    },
    profile: {
      id: profile.id,
      name: profile.name,
      targetFuel: profile.targetFuel,
      priority: profile.priority,
      scoreWeights: { ...profile.scoreWeights },
      distanceWeights: { ...profile.distanceWeights },
    },
    target: { ...target, oxygen_partial_pressure_psia: oxygenPartialPressure_psia(target) },
    score: result.score,
    scoreMax: 100,
    atmosphereSimilarity: result.atmosphere,
    fuelMatch: result.fuelMatch,
    pillarMatch: result.pillarMatch,
    bounds: result.bounds.map((bound) => ({ ...bound })),
  };
}

// ---------- Plantilla determinista ----------

const text = {
  es: {
    changed: (n: number, a: string, b: string) => `Entre ${a} (A) y ${b} (B) ${n === 1 ? "cambió una variable" : "cambiaron varias variables"}: `,
    noChange: (a: string, b: string) => `Entre ${a} (A) y ${b} (B) no cambió ninguna variable registrada.`,
    equal: "Se mantienen iguales: ",
    missing: "Sin dato en al menos una corrida: ",
    nominalRows: "Valor nominal, no medido: ",
    nominalBasis: (side: string, basis: string) => `Valor nominal en ${side}: ${basis}`,
    nominalAxes: (axes: string, basis: string) => `Valores nominales, no medidos (${axes}): ${basis} El FSRS no los pondera.`,
    nominalTag: "nominal",
    partial: { engineer: "La presión parcial de O₂ es", student: "La presión que aporta el oxígeno es" },
    partialPair: (a: string, b: string) => ` ${a} en A y ${b} en B.`,
    many: "Cambiaron varias variables a la vez; no se puede atribuir la diferencia de resultados a una sola.",
    gaps: (labels: string) => `Faltan datos en: ${labels}.`,
    zeroG: "Ambas corridas son de 0 g; no hay datos de gravedad parcial en PSI.",
    score: (label: string, score: string, max: string, profile: string) => `${label} obtiene ${score} de ${max} en FSRS para el perfil ${profile}.`,
    similarity: (pct: string, weight: string) => ` La similitud de atmósfera es ${pct} % (peso ${weight});`,
    fuel: (match: boolean, weight: string) => ` el material ${match ? "coincide" : "no coincide"} con el objetivo (peso ${weight})`,
    pillar: (match: boolean, weight: string) => ` y el pilar de seguridad ${match ? "coincide" : "no coincide"} (peso ${weight}).`,
    bounds: (list: string) => ` Además, la corrida es cota ${list}.`,
    bound: (side: string, axis: string, outside: boolean) => `${side} en ${axis}${outside ? " (objetivo fuera del rango medido)" : ""}`,
    conditions: (run: string, target: string) => `Condiciones medidas: ${run}. Objetivo: ${target}.`,
    gravity: (run: string, target: string) => `La corrida es de ${run} g y el objetivo es ${target} g; no hay datos de gravedad parcial en PSI.`,
    axes: { gravity_g: "gravedad", oxygen_pct: "oxígeno", pressure_psia: "presión", flow_velocity_cm_s: "flujo" },
    sides: { inferior: "inferior", superior: "superior" },
  },
  en: {
    changed: (n: number, a: string, b: string) => `Between ${a} (A) and ${b} (B), ${n === 1 ? "one variable changed" : "several variables changed"}: `,
    noChange: (a: string, b: string) => `Between ${a} (A) and ${b} (B), no recorded variable changed.`,
    equal: "Unchanged: ",
    missing: "Missing in at least one run: ",
    nominalRows: "Nominal value, not measured: ",
    nominalBasis: (side: string, basis: string) => `Nominal value in ${side}: ${basis}`,
    nominalAxes: (axes: string, basis: string) => `Nominal, unmeasured values (${axes}): ${basis} FSRS does not weight them.`,
    nominalTag: "nominal",
    partial: { engineer: "The O₂ partial pressure is", student: "The pressure contributed by oxygen is" },
    partialPair: (a: string, b: string) => ` ${a} in A and ${b} in B.`,
    many: "Several variables changed at once; the difference in outcomes cannot be attributed to a single one.",
    gaps: (labels: string) => `Missing data in: ${labels}.`,
    zeroG: "Both runs are at 0 g; PSI has no partial-gravity data.",
    score: (label: string, score: string, max: string, profile: string) => `${label} scores ${score} out of ${max} on FSRS for the ${profile} profile.`,
    similarity: (pct: string, weight: string) => ` Atmosphere similarity is ${pct} % (weight ${weight});`,
    fuel: (match: boolean, weight: string) => ` the material ${match ? "matches" : "does not match"} the target (weight ${weight})`,
    pillar: (match: boolean, weight: string) => ` and the safety pillar ${match ? "matches" : "does not match"} (weight ${weight}).`,
    bounds: (list: string) => ` The run also bounds the target ${list}.`,
    bound: (side: string, axis: string, outside: boolean) => `${side} in ${axis}${outside ? " (target outside the measured range)" : ""}`,
    conditions: (run: string, target: string) => `Measured conditions: ${run}. Target: ${target}.`,
    gravity: (run: string, target: string) => `The run is at ${run} g and the target is ${target} g; PSI has no partial-gravity data.`,
    axes: { gravity_g: "gravity", oxygen_pct: "oxygen", pressure_psia: "pressure", flow_velocity_cm_s: "flow" },
    sides: { inferior: "from below", superior: "from above" },
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

function atmosphereText(atmosphere: Atmosphere, nominal: readonly AtmosphereAxis[] = [], tag = "") {
  const mark = (axis: AtmosphereAxis) => (nominal.includes(axis) ? ` (${tag})` : "");
  return [
    `${atmosphere.gravity_g.toFixed(3)} g${mark("gravity_g")}`,
    `${atmosphere.oxygen_pct.toFixed(1)} % O₂${mark("oxygen_pct")}`,
    `${atmosphere.pressure_psia.toFixed(2)} psia${mark("pressure_psia")}`,
    `${atmosphere.flow_velocity_cm_s.toFixed(1)} cm/s${mark("flow_velocity_cm_s")}`,
  ].join(", ");
}

function diffTemplate(payload: DiffPayload, mode: InterpretMode, lang: InterpretLang): Interpretation {
  const t = text[lang];
  const { a, b } = payload.runs;
  const changed = payload.rows.filter(({ status }) => status === "changed");
  const equal = payload.rows.filter(({ status }) => status === "equal");
  const missing = payload.rows.filter(({ status }) => status === "missing");
  const nominal = payload.rows.filter(({ status }) => status === "nominal");
  // Una sola nota si A y B comparten la misma base nominal.
  const bases = a.nominal && b.nominal && a.nominal.basis === b.nominal.basis
    ? [t.nominalBasis("A/B", a.nominal.basis)]
    : [a.nominal && t.nominalBasis("A", a.nominal.basis), b.nominal && t.nominalBasis("B", b.nominal.basis)];

  const first = changed.length === 0
    ? t.noChange(a.label, b.label)
    : t.changed(changed.length, a.label, b.label) + changed.map((row) =>
      `${row.label} (${format(row.valueA, row.decimals, row.unit)} → ${format(row.valueB, row.decimals, row.unit)})`).join("; ") + ".";
  const second = [
    equal.length > 0 ? t.equal + equal.map(({ label }) => label).join(", ") + "." : "",
    missing.length > 0 ? t.missing + missing.map(({ label }) => label).join(", ") + "." : "",
    nominal.length > 0 ? t.nominalRows + nominal.map(({ label }) => label).join(", ") + "." : "",
    t.partial[mode] + t.partialPair(
      `${a.oxygen_partial_pressure_psia.toFixed(2)} psia${a.oxygen_partial_pressure_nominal ? ` (${t.nominalTag})` : ""}`,
      `${b.oxygen_partial_pressure_psia.toFixed(2)} psia${b.oxygen_partial_pressure_nominal ? ` (${t.nominalTag})` : ""}`),
  ].filter(Boolean).join(" ");

  const caveats = [
    changed.length > 1 ? t.many : "",
    missing.length > 0 ? t.gaps(missing.map(({ label }) => label).join(", ")) : "",
    ...(nominal.length > 0 ? bases.map((basis) => (basis ? sentence(basis) : "")) : []),
    a.gravity_g === 0 && b.gravity_g === 0 ? t.zeroG : "",
  ].filter((caveat): caveat is string => Boolean(caveat));

  return { paragraphs: [first, second], caveats, fieldsUsed: payload.rows.map(({ id }) => id) };
}

function rankTemplate(payload: RankPayload, lang: InterpretLang): Interpretation {
  const t = text[lang];
  const { run, profile, target } = payload;
  const { scoreWeights } = profile;
  const bounds = payload.bounds.map(({ axis, side, outside }) => t.bound(t.sides[side], t.axes[axis], outside));
  const first = t.score(run.label, payload.score.toFixed(1), String(payload.scoreMax), profile.name) +
    t.similarity((payload.atmosphereSimilarity * 100).toFixed(1), scoreWeights.atmosphere.toFixed(2)) +
    t.fuel(payload.fuelMatch, scoreWeights.fuel.toFixed(2)) +
    t.pillar(payload.pillarMatch, scoreWeights.pillar.toFixed(2)) +
    (bounds.length > 0 ? t.bounds(bounds.join(", ")) : "");
  const nominalAxes = run.nominal?.fields ?? [];
  const second = t.conditions(atmosphereText(run.atmosphere, nominalAxes, t.nominalTag), atmosphereText(target));
  const caveats = [
    run.nominal && nominalAxes.length > 0
      ? t.nominalAxes(nominalAxes.map((axis) => t.axes[axis]).join(", "), sentence(run.nominal.basis))
      : "",
    run.atmosphere.gravity_g !== target.gravity_g
      ? t.gravity(run.atmosphere.gravity_g.toFixed(3), target.gravity_g.toFixed(3))
      : "",
  ].filter(Boolean);
  return {
    paragraphs: [first, second],
    caveats,
    fieldsUsed: ["score", "atmosphereSimilarity", "fuelMatch", "pillarMatch", "bounds", "run.atmosphere", "target"],
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
const isRun = (value: unknown) => isObject(value) && typeof value.id === "string" && typeof value.label === "string" &&
  typeof value.oxygen_partial_pressure_psia === "number" && typeof value.gravity_g === "number" && isNominal(value.nominal) &&
  typeof value.oxygen_partial_pressure_nominal === "boolean" &&
  isObject(value.source) && typeof value.source.label === "string" && typeof value.source.url === "string";
const isValue = (value: unknown) => typeof value === "number" || typeof value === "string";
const isAtmosphere = (value: unknown) => isObject(value) &&
  atmosphereAxes.every((axis) => typeof value[axis] === "number");

function isDiffPayload(value: unknown): value is DiffPayload {
  return isObject(value) && isObject(value.runs) && isRun(value.runs.a) && isRun(value.runs.b) &&
    Array.isArray(value.rows) && value.rows.every((row) => isObject(row) &&
      typeof row.id === "string" && typeof row.label === "string" && isValue(row.valueA) && isValue(row.valueB) &&
      typeof row.nominalA === "boolean" && typeof row.nominalB === "boolean" &&
      diffStatuses.some((status) => status === row.status));
}

function isRankPayload(value: unknown): value is RankPayload {
  return isObject(value) && isRun(value.run) && isObject(value.run) && isAtmosphere(value.run.atmosphere) &&
    isObject(value.profile) && typeof value.profile.name === "string" && isObject(value.profile.scoreWeights) &&
    isAtmosphere(value.target) && typeof value.score === "number" && value.scoreMax === 100 && typeof value.atmosphereSimilarity === "number" &&
    typeof value.fuelMatch === "boolean" && typeof value.pillarMatch === "boolean" && Array.isArray(value.bounds);
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
