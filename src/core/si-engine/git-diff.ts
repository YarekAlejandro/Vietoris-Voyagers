import type { ExperimentalRun, Investigation } from "../../types/psi";

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
] as const;

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
    const status = valueA === undefined || valueB === undefined ? "missing" : valueA === valueB ? "equal" : "changed";

    let delta: number | undefined;
    let relativeDelta_pct: number | undefined;
    if (status === "changed" && typeof valueA === "number" && typeof valueB === "number") {
      delta = valueB - valueA;
      relativeDelta_pct = valueA === 0 ? undefined : 100 * delta / Math.abs(valueA);
    }

    return { field, valueA, valueB, status, delta, relativeDelta_pct };
  });
}
