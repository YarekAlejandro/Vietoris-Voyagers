// Valores iniciales heurísticos, no científicos. Ajustables para explorar el catálogo.
export const coverageTolerances = { oxygen_pp: 3, pressure_kpa: 10, flow_cm_s: 5 };
export const gravityClasses = [
  { gravity_g: 0, label: "Microgravedad" },
  { gravity_g: 0.165, label: "Lunar" },
  { gravity_g: 0.38, label: "Marciana" },
  { gravity_g: 1, label: "Terrestre" },
] as const;
