export type SafetyPillar = "PREVENTION" | "DETECTION" | "SUPPRESSION";
export type FuelCategory = "SOLID_POLYMER" | "SOLID_FABRIC" | "AEROSOL_SMOKE_DUST";
export type Facility = "MSG" | "CYGNUS";

export interface Atmosphere {
  gravity_g: number;
  oxygen_pct: number;
  pressure_psia: number;
  flow_velocity_cm_s: number;
}

export interface EnvironmentPreset {
  id: string;
  name: string;
  atmosphere: Atmosphere;
  targetFuel: FuelCategory;
  priority: SafetyPillar;
  distanceWeights: { gravity: number; oxygen: number; partialPressure: number; flow: number };
  scoreWeights: { atmosphere: number; fuel: number; pillar: number };
}

export interface Citation {
  label: string;
  url: string;
}

export interface Investigation {
  id: string;
  name: string;
  facility: Facility;
  safetyPillars: readonly SafetyPillar[];
  summary: string;
  source: Citation;
}

export interface ExperimentalRun {
  id: string;
  investigationId: string;
  label: string;
  atmosphere: Atmosphere;
  fuel: string;
  fuelCategory: FuelCategory;
  configuration: string;
  width_cm?: number;
  thickness_mm?: number;
  initial_flow_velocity_cm_s?: number;
  outcome?: string;
  cabin_heat_added_kj?: number;
  steady_flame_length_cm?: number;
  source: Citation;
}

export interface PsiDataset {
  investigations: Investigation[];
  runs: ExperimentalRun[];
}
