import type { EnvironmentPreset } from "../types/psi";

export const atmosphereControls = [
  { field: "gravity_g", label: "Gravedad", unit: "g", min: 0, max: 1, step: 0.001, decimals: 3 },
  { field: "oxygen_pct", label: "Oxígeno", unit: "% O₂", min: 15, max: 100, step: 0.1, decimals: 1 },
  { field: "pressure_psia", label: "Presión absoluta", unit: "psia", min: 3, max: 45, step: 0.1, decimals: 1 },
  { field: "flow_velocity_cm_s", label: "Flujo", unit: "cm/s", min: 0, max: 50, step: 0.1, decimals: 1 },
] as const;

export const missionPresets: readonly [EnvironmentPreset, ...EnvironmentPreset[]] = [
  {
    id: "iss", name: "ISS / Gateway",
    atmosphere: { gravity_g: 0, oxygen_pct: 21, pressure_psia: 14.7, flow_velocity_cm_s: 4.5 },
    priority: "DETECTION",
  },
  {
    id: "artemis", name: "Base lunar Artemis",
    atmosphere: { gravity_g: 0.165, oxygen_pct: 34, pressure_psia: 10.2, flow_velocity_cm_s: 6.5 },
    priority: "PREVENTION",
  },
  {
    id: "rover", name: "Rover lunar",
    atmosphere: { gravity_g: 0.165, oxygen_pct: 32, pressure_psia: 10.2, flow_velocity_cm_s: 10 },
    priority: "PREVENTION",
  },
  {
    id: "eva", name: "Traje EVA",
    atmosphere: { gravity_g: 0, oxygen_pct: 100, pressure_psia: 4.3, flow_velocity_cm_s: 15 },
    priority: "PREVENTION",
  },
  {
    id: "mining", name: "Minería / Tierra",
    atmosphere: { gravity_g: 1, oxygen_pct: 21, pressure_psia: 14.7, flow_velocity_cm_s: 25 },
    priority: "DETECTION",
  },
];
