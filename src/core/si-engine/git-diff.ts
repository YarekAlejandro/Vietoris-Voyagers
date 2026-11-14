import type { ExperimentalRun, Investigation } from "../../types/psi";

export const supplementalFields = [
  { id: "weight_loss_rate_mg_min", label: "Tasa de pérdida de masa", unit: "mg/min", decimals: 1 },
  { id: "heater_resistance_ratio", label: "Resistencia relativa del calentador", unit: "Rt/R₀", decimals: 3 },
  { id: "heating_duration_s", label: "Tiempo de calentamiento", unit: "s", decimals: 0 },
  { id: "aging_time_s", label: "Envejecimiento del humo", unit: "s", decimals: 0 },
  { id: "co2_pct", label: "Dióxido de carbono", unit: "% CO₂", deltaUnit: "pp", decimals: 1 },
  { id: "initial_droplet_diameter_mm", label: "Diámetro inicial de gota", unit: "mm", decimals: 2 },
  { id: "extinction_droplet_diameter_mm", label: "Diámetro al extinguirse la llama visible", unit: "mm", decimals: 2 },
  { id: "burning_rate_mm2_s", label: "Tasa de quemado K", unit: "mm²/s", decimals: 2 },
  { id: "burn_time_s", label: "Tiempo de quemado", unit: "s", decimals: 1 },
  { id: "electric_field_kv_cm", label: "Campo eléctrico", unit: "kV/cm", decimals: 2 },
  { id: "jet_velocity_cm_s", label: "Velocidad del chorro", unit: "cm/s", decimals: 1 },
] as const;

export const diffFields = [
  { id: "facility", label: "Instalación" },
  { id: "fuel", label: "Material" },
  { id: "configuration", label: "Configuración" },
  { id: "gravity_g", label: "Gravedad", unit: "g", decimals: 3 },
  { id: "oxygen_pct", label: "Oxígeno", unit: "% O₂", deltaUnit: "pp", decimals: 1 },
  { id: "pressure_psia", label: "Presión absoluta", unit: "psia", decimals: 2 },
  { id: "flow_velocity_cm_s", label: "Flujo de referencia", unit: "cm/s", decimals: 1 },
  { id: "initial_flow_velocity_cm_s", label: "Flujo inicial", unit: "cm/s", decimals: 1 },
  { id: "width_cm", label: "Ancho de muestra", unit: "cm", decimals: 1 },
  { id: "thickness_mm", label: "Espesor", unit: "mm", decimals: 2 },
  { id: "outcome", label: "Resultado observado" },
  { id: "steady_flame_length_cm", label: "Longitud de llama estable", unit: "cm", decimals: 1 },
  { id: "cabin_heat_added_kj", label: "Calor añadido a cabina (estim.)", unit: "kJ", decimals: 0 },
  ...supplementalFields,
] as const;

const outcomeFields = new Set<(typeof diffFields)[number]["id"]>([
  "outcome", "steady_flame_length_cm", "cabin_heat_added_kj",
  "extinction_droplet_diameter_mm", "burning_rate_mm2_s", "burn_time_s",
]);

export function compareRuns(
  a: ExperimentalRun,
  b: ExperimentalRun,
  investigations: ReadonlyMap<string, Investigation>,
) {
  const left = { ...a, ...a.atmosphere, facility: investigations.get(a.investigationId)?.facility };
  const right = { ...b, ...b.atmosphere, facility: investigations.get(b.investigationId)?.facility };

  return diffFields.map((field) => {
    const valueA = left[field.id];
    const valueB = right[field.id];
    const nominalA = a.nominal?.fields.some((axis) => axis === field.id) ?? false;
    const nominalB = b.nominal?.fields.some((axis) => axis === field.id) ?? false;
    const status = valueA === undefined || valueB === undefined ? "missing"
      : nominalA || nominalB ? "nominal"
        : valueA === valueB ? "equal" : "changed";

    let delta: number | undefined;
    let relativeDelta_pct: number | undefined;
    if (status === "changed" && typeof valueA === "number" && typeof valueB === "number") {
      delta = valueB - valueA;
      relativeDelta_pct = valueA === 0 ? undefined : 100 * delta / Math.abs(valueA);
    }

    const outcome = outcomeFields.has(field.id);
    const order = outcome ? 0 : status === "changed" ? 1 : status === "equal" ? 3 : 2;
    return { field, valueA, valueB, nominalA, nominalB, status, delta, relativeDelta_pct, outcome, order };
  }).sort((a, b) => a.order - b.order);
}
