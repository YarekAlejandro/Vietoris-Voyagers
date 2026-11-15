import type { EvidenceTopicId, ExperimentalRun, Facility, SafetyPillar } from "../types/psi";

export const facilities = {
  MSG: { label: "MSG", name: "Microgravity Science Glovebox", aliases: ["guantejera de microgravedad", "glovebox", "ducto SPICE"] },
  CYGNUS: { label: "Cygnus", name: "Vehículo Cygnus", aliases: ["cygnus spacecraft", "cargo spacecraft"] },
  CIR: { label: "CIR", name: "Combustion Integrated Rack", aliases: ["rack de combustión"] },
  ISS: { label: "Cabina ISS", name: "Estación Espacial Internacional", aliases: ["international space station"] },
  SUBORBITAL: { label: "Cohete suborbital (New Shepard)", name: "Cohete suborbital", aliases: ["sounding rocket", "New Shepard"] },
  LUNAR: { label: "Superficie lunar (planificado)", name: "Superficie lunar", aliases: ["lunar surface", "superficie lunar"] },
  GROUND: { label: "Estudio en tierra / modelado", name: "Investigación en tierra", aliases: ["ground investigation", "estudio terrestre"] },
  UNCLASSIFIED: { label: "Sin clasificar", name: "Instalación sin clasificar", aliases: [] },
} satisfies Record<Facility, { label: string; name: string; aliases: string[] }>;

export const pillarLabels = {
  PREVENTION: "Prevención",
  DETECTION: "Detección",
  SUPPRESSION: "Supresión",
} satisfies Record<SafetyPillar, string>;

export const evidenceTopics = {
  solids: { label: "Inflamabilidad de sólidos", aliases: [
    "combustión de sólidos", "combustibles sólidos", "materiales sólidos", "solid fuels", "solid flammability",
  ] },
  "flame-spread": { label: "Propagación de llama", aliases: [
    "propagación del fuego", "crecimiento de llama", "flame spread", "flame growth", "fire spread",
  ] },
  "low-flow": { label: "Flujo bajo", aliases: [
    "bajo flujo", "poca ventilación", "ventilación débil", "flujo lento", "ventilación baja", "low flow", "low airflow", "weak ventilation", "low ventilation",
  ] },
  extinction: { label: "Extinción de llama", aliases: [
    "extinción", "apagado de llama", "se apaga", "quenching", "blowoff", "blow off", "flame extinction", "flame extinguishment",
  ] },
  "reduced-pressure": { label: "Presión reducida", aliases: [
    "baja presión", "presión baja", "low pressure", "reduced pressure", "depressurized",
  ] },
  "cabin-heat": { label: "Calor en cabina", aliases: [
    "calor añadido", "energía térmica en cabina", "cabin heating", "cabin heat", "heat addition", "heat added",
  ] },
  "smoke-detection": { label: "Humo y polvo", aliases: [
    "humo y polvo", "detección de humo", "detectores de humo", "falsas alarmas", "falsa alarma", "tamaño de partículas", "humo", "polvo", "aerosoles",
    "smoke detection", "smoke detectors", "smoke particles", "smoke", "dust", "aerosol", "aerosols", "particle size", "false alarms", "false alarm",
  ] },
  "cold-flames": { label: "Llamas frías", aliases: [
    "llama fría", "combustión a baja temperatura", "oxidación a baja temperatura",
    "cool flame", "cool flames", "cold flame", "cold flames", "low-temperature combustion", "low temperature oxidation",
  ] },
  "electric-field": { label: "Campos eléctricos", aliases: [
    "campo eléctrico", "viento iónico", "electric field", "electric fields", "ionic wind", "electrohydrodynamics",
  ] },
  "liquid-droplets": { label: "Combustión de gotas", aliases: [
    "gotas líquidas", "gota líquida", "gotas", "gota", "droplet combustion", "liquid droplets", "droplets", "droplet",
  ] },
  suppression: { label: "Supresión con CO₂", aliases: [
    "supresión", "supresor", "supresores", "supresión con CO2", "dióxido de carbono", "CO2", "suppression", "carbon dioxide",
  ] },
  "partial-gravity": { label: "Gravedad parcial", aliases: [
    "partial gravity", "gravedad lunar", "lunar gravity", "gravedad marciana", "martian gravity",
  ] },
} satisfies Record<EvidenceTopicId, { label: string; aliases: string[] }>;

export const searchMaterials = [
  { id: "pmma", label: "PMMA", aliases: ["acrílico", "acrylic", "polimetilmetacrilato", "polymethyl methacrylate"] },
  { id: "sibal", label: "SIBAL", aliases: ["algodón y fibra de vidrio", "cotton and fiberglass", "cotton fiberglass"] },
  { id: "teflon", label: "Teflon", aliases: ["teflón", "PTFE", "politetrafluoroetileno"] },
  { id: "heptano", label: "Heptano", aliases: ["heptane", "n-heptane", "n-heptano"] },
  { id: "metanol", label: "Metanol", aliases: ["methanol", "alcohol metílico"] },
  { id: "lampwick", label: "Lampwick", aliases: ["mecha de lámpara", "lamp wick"] },
] as const;

export function topicsForRun(run: ExperimentalRun): readonly EvidenceTopicId[] {
  const topics = run.topics ?? [];
  const solid = run.fuelCategory === "SOLID_FABRIC" || run.fuelCategory === "SOLID_POLYMER";
  return solid && !topics.includes("solids") ? ["solids", ...topics] : topics;
}
