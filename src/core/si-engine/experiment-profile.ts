import { searchMaterials } from "../../data/psi_vocabulary";

export const numberFields = {
  oxygen_pct: { label: "Oxígeno", unit: "%", min: 15, max: 100, step: 0.1 },
  pressure_kpa: { label: "Presión absoluta", unit: "kPa", min: 0.001, max: 7000, step: 0.1 },
  flow_cm_s: { label: "Velocidad del flujo", unit: "cm/s", min: 0, max: 50, step: 0.1 },
  gravity_g: { label: "Gravedad", unit: "g", min: 0, max: 20, step: 0.001 },
  temperature_c: { label: "Temperatura ambiente", unit: "°C", min: -273.15, max: 2000, step: 0.1 },
  thickness_mm: { label: "Espesor", unit: "mm", min: 0.001, max: 5000, step: 0.01 },
  width_cm: { label: "Ancho de muestra", unit: "cm", min: 0.001, max: 5000, step: 0.01 },
  diameter_mm: { label: "Diámetro inicial de gota", unit: "mm", min: 0.001, max: 1000, step: 0.01 },
} as const;

export const textFields = {
  material: "Combustible o material",
  geometry: "Geometría de la muestra",
  ignition: "Fuente de ignición",
  diluent: "Diluyente",
  objective: "Objetivo del experimento",
} as const;

export const flowDirections = ["concurrente", "opuesto", "sin flujo"] as const;
type FlowDirection = (typeof flowDirections)[number];
export type NumberField = keyof typeof numberFields;
type TextField = keyof typeof textFields;
export type ProfileField = NumberField | TextField | "flowDirection";
export type ExperimentProfile = Partial<Record<NumberField, number> & Record<TextField, string> & { flowDirection: FlowDirection }>;
export type ProfileEvidence = Partial<Record<ProfileField, string>>;

export const profileFields: ProfileField[] = [
  "material", "geometry", "oxygen_pct", "pressure_kpa", "flow_cm_s", "flowDirection", "gravity_g",
  "temperature_c", "ignition", "diluent", "thickness_mm", "width_cm", "diameter_mm", "objective",
];
export const maxExperimentText = 1600;
export const maxProfileText = 360;
export const psiaToKpa = 6.894757;

export function isNumberField(key: string): key is NumberField {
  return Object.hasOwn(numberFields, key);
}

export function profileLabel(key: ProfileField) {
  return isNumberField(key) ? numberFields[key].label : key === "flowDirection" ? "Dirección del flujo" : textFields[key];
}

export function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseExperimentProfile(input: unknown): ExperimentProfile | null {
  if (!plainObject(input)) return null;
  const entries: [string, string | number][] = [];
  for (const [field, value] of Object.entries(input)) {
    if (isNumberField(field)) {
      const { min, max } = numberFields[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
      entries.push([field, value]);
    } else if (field === "flowDirection") {
      if (!flowDirections.includes(value as FlowDirection)) return null;
      entries.push([field, value as FlowDirection]);
    } else {
      if (!Object.hasOwn(textFields, field) || typeof value !== "string" || !value.trim() ||
        value.length > maxProfileText || /[\x00-\x08\x0b-\x1f]/.test(value)) return null;
      entries.push([field, value.trim()]);
    }
  }
  return Object.fromEntries(entries);
}

export function normalizedWords(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function containsPhrase(text: string, phrase: string) {
  return Boolean(phrase) && ` ${text} `.includes(` ${phrase} `);
}

export function materialKey(value: string) {
  const normalized = normalizedWords(value);
  return searchMaterials.find(({ id, aliases }) =>
    id === normalized || aliases.some((alias) => normalizedWords(alias) === normalized))?.id ?? normalized;
}

export function geometryKey(value: string) {
  const key = normalizedWords(value);
  if (/\b(?:gotas?|droplets?)\b/.test(key)) return "gota";
  if (/\b(?:tela|tejido|textil|lamina|placa|pelicula|tira|sheet|film|fabric|plate|cloth)\b/.test(key)) return "lámina";
  if (/\b(?:cilindr\w*|cylinder|barra|rod)\b/.test(key)) return "cilindro";
  return key;
}

const numericLiteral = String.raw`[+−-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)`;
const numericUnits: Record<NumberField, string> = {
  oxygen_pct: String.raw`%|por\s+ciento`,
  pressure_kpa: String.raw`kpa|psia|atm`,
  flow_cm_s: String.raw`cm\s*\/\s*s|cm\s*s⁻¹|m\s*\/\s*s`,
  gravity_g: String.raw`g`,
  temperature_c: String.raw`°\s*[cf]|kelvin|k`,
  thickness_mm: String.raw`mm|cm`, width_cm: String.raw`cm|mm`, diameter_mm: String.raw`mm|cm`,
};

const numberContext: Partial<Record<NumberField, RegExp>> = {
  oxygen_pct: /\b(?:o2|oxigeno|oxygen)\b/,
  flow_cm_s: /\b(?:flujo|flow|ventilacion|ventilation)\b/,
  gravity_g: /\b(?:gravedad|gravity|microgravedad|microgravity)\b/,
  thickness_mm: /\b(?:espesor|grosor|thickness)\b/,
  width_cm: /\b(?:ancho|anchura|width)\b/,
  diameter_mm: /\b(?:diametro|diameter)\b/,
};

function nearbyClause(quote: string, text: string) {
  const offset = text.indexOf(quote);
  const before = text.slice(0, offset).split(/[;,\n]|[.!?]\s+/).at(-1) ?? "";
  const after = text.slice(offset + quote.length).split(/[;,\n]|[.!?]\s+/)[0] ?? "";
  return `${before}${quote}${after}`;
}

function isExplicitSetting(field: NumberField, context: string) {
  const requirement = numberContext[field];
  if (requirement && !requirement.test(normalizedWords(context))) return false;
  if (/\d\s*[-–—]\s*\d|\b(?:entre|between)\s+\d|\d\s*(?:%|g|kpa|mm|cm)?\s+(?:o|or)\s+\d/i.test(context)) return false;
  return !/\b(?:baj[ao]r?|sub[eo]|reducir|aumentar|disminuir|incrementar)\b[^.;\n]{0,40}\ben\s+[+−-]?\d+(?:[.,]\d+)?\s*%/i.test(context);
}

function numericalValue(field: NumberField, quote: string) {
  // Una dimensión sin unidad, un intervalo o un incremento relativo no son un punto de consigna.
  if (/\d\s*[-–—]\s*\d|\b(?:entre|between|aproximadamente|about)\b[^.;]*\by\b[^.;]*\d/i.test(quote)) return undefined;
  const pattern = new RegExp(`(?<![\\p{L}\\d.,])(${numericLiteral})\\s*(${numericUnits[field]})(?![\\p{L}\\d/])`, "giu");
  const matches = [...quote.matchAll(pattern)];
  if (matches.length !== 1) return undefined;
  const [, raw, unitRaw] = matches[0];
  const unit = unitRaw.toLowerCase().replace(/\s/g, "");
  let value = Number(raw.replace(",", ".").replace("−", "-"));
  if (field === "pressure_kpa" && unit === "psia") value *= psiaToKpa;
  if (field === "pressure_kpa" && unit === "atm") value *= 101.325;
  if (field === "flow_cm_s" && unit === "m/s") value *= 100;
  if (field === "temperature_c" && unit === "°f") value = (value - 32) * 5 / 9;
  if (field === "temperature_c" && (unit === "k" || unit === "kelvin")) value -= 273.15;
  if ((field === "thickness_mm" || field === "diameter_mm") && unit === "cm") value *= 10;
  if (field === "width_cm" && unit === "mm") value /= 10;
  return Number(value.toFixed(6));
}

function flowDirection(quote: string): FlowDirection | undefined {
  if (/\b(?:sin flujo|flujo nulo|no flow|quiescent|quiescente)\b/i.test(quote)) return "sin flujo";
  if (/\b(?:opuesto|contracorriente|opposed|counterflow)\b/i.test(quote)) return "opuesto";
  if (/\b(?:concurrente|concurrent|co[- ]?flow)\b/i.test(quote)) return "concurrente";
}

export interface ProfileProposal {
  profile: ExperimentProfile;
  evidence: ProfileEvidence;
  cleared: ProfileField[];
}

export const extractionSchema = {
  type: "object", additionalProperties: false,
  properties: {
    changes: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { field: { type: "string", enum: profileFields }, quote: { type: "string" }, action: { type: "string", enum: ["set", "clear"] } },
        required: ["field", "quote", "action"],
      },
    },
  },
  required: ["changes"],
};

export function validateProfileProposal(output: unknown, text: string, current: ExperimentProfile): ProfileProposal | null {
  if (!plainObject(output) || Object.keys(output).length !== 1 || !Array.isArray(output.changes) || output.changes.length > profileFields.length) return null;
  const profile: Record<string, string | number> = { ...current };
  const evidence: ProfileEvidence = {};
  const cleared: ProfileField[] = [];
  for (const change of output.changes) {
    if (!plainObject(change) || Object.keys(change).length !== 3 || !profileFields.includes(change.field as ProfileField) ||
      typeof change.quote !== "string" || !change.quote.trim() || change.quote.length > maxProfileText ||
      !text.includes(change.quote.trim()) || (change.action !== "set" && change.action !== "clear")) return null;
    const field = change.field as ProfileField;
    const quote = change.quote.trim();
    const context = nearbyClause(quote, text);
    if (evidence[field] !== undefined) return null;
    evidence[field] = quote;
    if (change.action === "clear") {
      if (!/\b(?:quita|quitar|elimina|eliminar|olvida|olvidar|sin especificar|no especificad[oa]|no sabemos|remove|unset|unknown)\b/i.test(quote)) return null;
      const marker = isNumberField(field) ? numberContext[field] : undefined;
      const named = containsPhrase(normalizedWords(quote), normalizedWords(profileLabel(field)));
      if (!named && !marker?.test(normalizedWords(quote))) return null;
      delete profile[field];
      cleared.push(field);
      continue;
    }
    if (/\b(?:no\s+(?:us[aeo]|usar|quiero|utiliz\w*|inclu\w*)|descart\w*|excepto|without using)\b/i.test(context)) return null;
    const value = isNumberField(field) ? (isExplicitSetting(field, context) ? numericalValue(field, quote) : undefined)
      : field === "flowDirection" ? flowDirection(quote) : quote;
    if (value === undefined) return null;
    profile[field] = value;
  }
  const normalized = parseExperimentProfile(profile);
  return normalized && { profile: normalized, evidence, cleared };
}

const dimensionName: Partial<Record<NumberField, string>> = {
  thickness_mm: "espesor|grosor|thickness", width_cm: "ancho|anchura|width", diameter_mm: "diámetro(?: inicial)?|diameter",
};

export function localProfileProposal(text: string, current: ExperimentProfile): ProfileProposal {
  const changes: { field: ProfileField; quote: string; action: "set" }[] = [];
  const add = (field: ProfileField, match?: string) => {
    if (match) changes.push({ field, quote: match, action: "set" });
  };
  for (const field of Object.keys(numberFields) as NumberField[]) {
    const dimension = dimensionName[field];
    const prefix = dimension ? `(?:${dimension})\\s*(?:de|[:=])?\\s*` : "";
    const pattern = new RegExp(`${prefix}${numericLiteral}\\s*(?:${numericUnits[field]})(?![\\p{L}\\d/])`, "giu");
    const matches = [...text.matchAll(pattern)];
    if (matches.length === 1) {
      const match = matches[0];
      const before = text.slice(Math.max(0, match.index - 25), match.index);
      if (!/\b(?:entre|hasta|menos de|más de|en)\s*$/i.test(before)) add(field, match[0]);
    }
  }
  const material = searchMaterials.flatMap(({ label, aliases }) => [label, ...aliases])
    .sort((a, b) => b.length - a.length).find((name) => containsPhrase(normalizedWords(text), normalizedWords(name)));
  if (material) add("material", text.match(new RegExp(material.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))?.[0]);
  add("geometry", text.match(/\b(?:gota aislada|isolated droplet|gota|lámina|placa|película|tira|cilindro)\b/i)?.[0]);
  add("flowDirection", text.match(/\b(?:sin flujo|no flow|flujo (?:concurrente|opuesto)|contracorriente|concurrente|opuesto)\b/i)?.[0]);
  add("objective", text.match(/(?:objetivo\s*[:=]|quiero (?:analizar|medir|estudiar|observar|evaluar|comparar))\s*([^\n.!?]+)/i)?.[1]?.trim());
  for (const [field, label] of [["ignition", "ignición"], ["diluent", "diluyente"]] as const) {
    add(field, text.match(new RegExp(`(?:${label})\\s*[:=]\\s*([^,;.!?\\n]+)`, "i"))?.[1]?.trim());
  }
  // La lectura local ignora una coincidencia individual inválida y conserva el perfil anterior.
  return changes.reduce<ProfileProposal>((proposal, change) => {
    const next = validateProfileProposal({ changes: [change] }, text, proposal.profile);
    return next ? { profile: next.profile, evidence: { ...proposal.evidence, ...next.evidence }, cleared: [] } : proposal;
  }, { profile: current, evidence: {}, cleared: [] });
}

export function localRefinementProposal(text: string, current: ExperimentProfile): ProfileProposal | null {
  // Una pregunta condicional de consigna sí propone un cambio para revisión.
  if (!/^¿?\s*(?:y\s+)?si\s+(?:bajo|subo|reduzco|aumento|disminuyo|incremento|ajusto|cambio|modifico|pongo)\b/i.test(text.trim())) return null;
  const proposal = localProfileProposal(text, current);
  return Object.keys(proposal.evidence).length ? proposal : null;
}
