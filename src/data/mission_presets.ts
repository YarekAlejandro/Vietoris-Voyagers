import type { EnvironmentPreset } from "../types/psi";

export const atmosphereControls = [
  { field: "gravity_g", label: "Gravedad", unit: "g", min: 0, max: 1, step: 0.001, decimals: 3 },
  { field: "oxygen_pct", label: "Oxígeno", unit: "% O₂", min: 15, max: 100, step: 0.1, decimals: 1 },
  { field: "pressure_psia", label: "Presión absoluta", unit: "psia", min: 3, max: 45, step: 0.1, decimals: 1 },
  { field: "flow_velocity_cm_s", label: "Flujo", unit: "cm/s", min: 0, max: 50, step: 0.1, decimals: 1 },
] as const;

const lunarWeights = {
  distanceWeights: { gravity: 0.35, oxygen: 0.30, partialPressure: 0.20, flow: 0.15 },
  scoreWeights: { atmosphere: 0.50, fuel: 0.30, pillar: 0.20 },
} as const;

export const missionPresets: readonly [EnvironmentPreset, ...EnvironmentPreset[]] = [
  {
    id: "iss", name: "ISS / Gateway",
    atmosphere: { gravity_g: 0, oxygen_pct: 21, pressure_psia: 14.7, flow_velocity_cm_s: 4.5 },
    targetFuel: "SOLID_POLYMER", priority: "DETECTION",
    distanceWeights: { gravity: 0.30, oxygen: 0.25, partialPressure: 0.15, flow: 0.30 },
    scoreWeights: { atmosphere: 0.50, fuel: 0.25, pillar: 0.25 },
  },
  {
    id: "artemis", name: "Base lunar Artemis",
    atmosphere: { gravity_g: 0.165, oxygen_pct: 34, pressure_psia: 8.2, flow_velocity_cm_s: 6.5 },
    targetFuel: "SOLID_POLYMER", priority: "PREVENTION",
    ...lunarWeights,
  },
  {
    id: "rover", name: "Rover lunar",
    atmosphere: { gravity_g: 0.165, oxygen_pct: 30, pressure_psia: 10.2, flow_velocity_cm_s: 5 },
    targetFuel: "SOLID_POLYMER", priority: "PREVENTION",
    ...lunarWeights,
  },
  {
    id: "eva", name: "Traje EVA",
    atmosphere: { gravity_g: 0.165, oxygen_pct: 100, pressure_psia: 4.3, flow_velocity_cm_s: 15 },
    targetFuel: "SOLID_FABRIC", priority: "PREVENTION",
    distanceWeights: { gravity: 0.15, oxygen: 0.45, partialPressure: 0.25, flow: 0.15 },
    scoreWeights: { atmosphere: 0.55, fuel: 0.25, pillar: 0.20 },
  },
  {
    id: "mining", name: "Minería terrestre",
    atmosphere: { gravity_g: 1, oxygen_pct: 21, pressure_psia: 14.7, flow_velocity_cm_s: 25 },
    targetFuel: "AEROSOL_SMOKE_DUST", priority: "DETECTION",
    distanceWeights: { gravity: 0.10, oxygen: 0.25, partialPressure: 0.15, flow: 0.50 },
    scoreWeights: { atmosphere: 0.35, fuel: 0.30, pillar: 0.35 },
  },
];
