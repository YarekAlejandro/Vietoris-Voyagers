import type { Atmosphere, EvidenceTopicId, ExperimentalRun, Facility, Investigation, SafetyPillar } from "../../types/psi";
import type { PsiIdentity, PsiProfile, PsiQuantity, RawPsiInvestigation } from "../../types/psi-live";

const facilityTerms: readonly [Facility, RegExp][] = [
  ["CIR", /\b(?:CIR|ACME|MDCA|Combustion Integrated Rack)\b/i],
  ["MSG", /\b(?:MSG|Microgravity Science Glovebox|SPICE|SLICE|BASS(?:-II)?)\b/i],
  ["CYGNUS", /\b(?:Cygnus|Saffire)\b/i],
  ["SUBORBITAL", /\b(?:New Shepard|sounding rocket|suborbital|LUCI)\b/i],
  ["LUNAR", /\b(?:Moon|lunar surface|CLPS|FM2|Artemis)\b/i],
];

function classifyFacility(raw: RawPsiInvestigation): Facility {
  const hardware = raw.hardware.join(" ");
  const explicit = facilityTerms.find(([, pattern]) => pattern.test(hardware));
  if (explicit) return explicit[0];
  if (/\b(?:ground|modeling|modelling|computational|terrestrial|en tierra)\b/i.test(raw.projectType ?? "")) return "GROUND";
  const fields = [raw.title, raw.acronym, raw.objective, raw.approach, raw.flightPlatform];
  for (const text of fields) {
    const match = facilityTerms.find(([, pattern]) => pattern.test(text ?? ""));
    if (match) return match[0];
  }
  return "UNCLASSIFIED";
}

const topicTerms: readonly [EvidenceTopicId, RegExp][] = [
  ["solids", /\b(?:solids?|PMMA|fabrics?|acrylic|solid fuels?)\b/i],
  ["flame-spread", /\b(?:flame|fire) (?:spread|propagation|growth)\b/i],
  ["low-flow", /\b(?:low (?:air)?flow|weak ventilation|quiescent)\b/i],
  ["reduced-pressure", /\b(?:low pressure|reduced pressure|depressurized)\b/i],
  ["smoke-detection", /\b(?:smoke|soot|dust|aerosols?)\b/i],
  ["cold-flames", /\b(?:cool|cold) flames?\b|\blow.temperature combustion\b/i],
  ["liquid-droplets", /\bdroplets?\b/i],
  ["electric-field", /\belectric[ -]fields?\b|\bionic wind\b/i],
  ["partial-gravity", /\b(?:partial gravity|lunar gravity|martian gravity|lunar surface|Mars)\b/i],
  ["extinction", /\b(?:extinction|extinguish(?:ment|ed|ing)?|quenching)\b/i],
  ["suppression", /\b(?:suppression|suppressants?)\b/i],
];

const digits = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`;
const startNumber = String.raw`(?<![\w.+\-–—])`;
function interval(unit: string) {
  return String.raw`(?<min>${digits})(?:\s*(?<firstUnit>${unit})?\s*(?:[-–—]|\bto\b|\band\b(?=\s*${digits}\s*(?:${unit})))\s*(?<max>${digits}))?`;
}
const oxygen = String.raw`(?:oxygen|o[2₂])(?![a-z0-9])`;
const percent = String.raw`(?:%|percent\b)`;
const pressure = String.raw`(?:psia|psi|kpa)`;
const speed = String.raw`(?:cm\s*\/\s*s)\b`;
const gravity = String.raw`g\b`;
const airflow = /\b(?:air\s*flow|oxidizer flow|co[- ]?flow|ventilation|flow (?:velocity|velocities|speed))\b/i;
const limitOnly = /(?:above|below|less than|more than|as high as|up to|over|under|at least|at most|[<>≤≥])\s*$/i;
const predicted = /\b(?:will be (?:examined|investigated|tested|studied|evaluated)|could impose)\b/i;

type Axis = keyof Atmosphere;
type QuantityRule = {
  axis: Axis;
  unit: PsiQuantity["unit"];
  patterns: readonly RegExp[];
  max: number;
};
const rules: readonly QuantityRule[] = [
  { axis: "oxygen_pct", unit: "% O₂", max: 100, patterns: [
    new RegExp(String.raw`${startNumber}${interval(percent)}\s*${percent}\s*(?:of\s+|\(\s*)?${oxygen}`, "gi"),
    new RegExp(String.raw`\b${oxygen}\s*(?:(?:concentration|content|levels?|fraction)\s*)?(?:(?:(?:rang(?:es?|ed|ing)|varies|varied)\s+)?(?:between|from|of|at)\s*|[:=]\s*)?${interval(percent)}\s*${percent}`, "gi"),
  ] },
  { axis: "pressure_psia", unit: "psia", max: 1000, patterns: [
    new RegExp(String.raw`${startNumber}${interval(pressure)}\s*(?<unit>${pressure})(?![\w/])`, "gi"),
  ] },
  { axis: "flow_velocity_cm_s", unit: "cm/s", max: 1000, patterns: [
    new RegExp(String.raw`${startNumber}${interval(speed)}\s*${speed}`, "gi"),
  ] },
  { axis: "gravity_g", unit: "g", max: 20, patterns: [
    new RegExp(String.raw`${startNumber}${interval(gravity)}(?<gap>\s*)${gravity}`, "gi"),
  ] },
];

function inPsia(value: number, unit: string | undefined) {
  return unit?.toLowerCase() === "kpa" ? value / 6.894757 : value;
}

function readQuantity(clause: string, { axis, unit, max, patterns }: QuantityRule, field: string): PsiQuantity | undefined {
  if (predicted.test(clause)) return;
  for (const pattern of patterns) {
    for (const { groups, index, 0: matched } of clause.matchAll(pattern)) {
      if (!groups?.min || index === undefined) continue;
      const before = clause.slice(Math.max(0, index - 65), index);
      const after = clause.slice(index + matched.length, index + matched.length + 38);
      if (limitOnly.test(before)) continue;
      if (axis === "flow_velocity_cm_s" && (!airflow.test(before + after) ||
          /\b(?:spread|burning|propagation|flame front)(?:\s+(?:rate|speed|velocity))?\s+(?:of|at)\s*$/i.test(before))) continue;
      if (axis === "pressure_psia" && /\b(?:gauge|manometric|differential)\b/i.test(before + after)) continue;
      if (axis === "gravity_g" && groups.gap && !/\b(?:gravity|microgravity|gravedad|acceleration)\b/i.test(before + after)) continue;
      if (/\band\b/i.test(matched) && !/\bbetween\b/i.test(before + matched)) continue;

      const convert = axis === "pressure_psia" ? inPsia : (value: number) => value;
      const minimum = convert(Number(groups.min), groups.firstUnit ?? groups.unit);
      const maximum = groups.max ? convert(Number(groups.max), groups.unit) : minimum;
      if (minimum < 0 || maximum < minimum || maximum > max || (axis === "pressure_psia" && minimum === 0)) continue;
      return {
        value: minimum === maximum ? minimum : [minimum, maximum],
        source: "abstract-regex", unit, confidence: "media",
        evidence: `${field} · …${before.slice(-38)}${matched}${after.slice(0, 26)}…`,
      };
    }
  }
}

function extractProfile(raw: RawPsiInvestigation): PsiProfile | null {
  if (raw.researchArea.toLowerCase() !== "combustion science") return null;
  const profile: PsiProfile = { ...raw.tableProfile };
  const fields = [["Enfoque", raw.approach], ["Objetivo", raw.objective], ["Hipótesis", raw.hypothesis]] as const;
  for (const rule of rules) {
    if (profile[rule.axis]) continue;
    for (const [name, text] of fields) {
      if (!text) continue;
      const clauses = text.split(/(?<=[.!?])\s+(?=[A-Z])|\r?\n/);
      const quantity = clauses.map((clause) => readQuantity(clause, rule, name)).find(Boolean);
      if (!quantity) continue;
      profile[rule.axis] = quantity;
      break;
    }
  }
  return Object.keys(profile).length ? profile : null;
}

export function psiIdentity(raw: RawPsiInvestigation, lastSeenAt?: string): PsiIdentity {
  return {
    accession: raw.accession, officialUrl: raw.sourceUrl, doi: raw.doi, license: raw.license,
    publications: raw.publications, ...(lastSeenAt ? { lastSeenAt } : {}),
  };
}

export function mapLivePsiToStudy(raw: RawPsiInvestigation, origin: "live" | "snapshot" = "live", lastSeenAt?: string): Investigation {
  const text = [raw.title, raw.keywords, raw.objective, raw.approach].join(" ");
  const topics = topicTerms.filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
  const safetyPillars: SafetyPillar[] = [];
  if (topics.some((topic) => topic === "solids" || topic === "flame-spread")) safetyPillars.push("PREVENTION");
  if (topics.includes("smoke-detection")) safetyPillars.push("DETECTION");
  if (topics.some((topic) => topic === "suppression" || topic === "extinction")) safetyPillars.push("SUPPRESSION");
  const profile = extractProfile(raw);
  return {
    id: raw.accession, name: raw.title, facility: classifyFacility(raw), safetyPillars, topics,
    summary: raw.objective ?? raw.approach ?? raw.hypothesis ?? raw.title,
    source: { label: "NASA Physical Sciences Informatics", url: raw.sourceUrl },
    psi: psiIdentity(raw, lastSeenAt),
    importedPsi: {
      origin, acronym: raw.acronym, projectType: raw.projectType, researchArea: raw.researchArea,
      hardware: raw.hardware, keywords: raw.keywords, flightPlatform: raw.flightPlatform, profile,
      fsrs: { status: profile ? "calculable" : "sin-datos-suficientes" },
    },
  };
}

export function buildPsiProfileRun(study: Investigation): ExperimentalRun | undefined {
  const profile = study.importedPsi?.profile;
  if (!profile) return;
  const atmosphere: Partial<Atmosphere> = {};
  for (const [axis, quantity] of Object.entries(profile)) {
    if (typeof quantity.value === "number") atmosphere[axis as Axis] = quantity.value;
  }
  return {
    id: `psi-profile:${study.id}`, investigationId: study.id, atmosphere, psiProfile: profile,
    label: `${study.importedPsi?.acronym ?? study.id} · Perfil NASA PSI${study.importedPsi?.origin === "live" ? " Live" : ""}`,
    topics: study.topics, source: study.source,
  };
}

export function formatPsiQuantity({ value, unit }: PsiQuantity, decimals: number) {
  const formatted = typeof value === "number" ? value.toFixed(decimals) : value.map((item) => item.toFixed(decimals)).join("–");
  return `${formatted} ${unit}`;
}
