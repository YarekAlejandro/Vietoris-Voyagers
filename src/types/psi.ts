import type { ImportedPsiEvidence, PsiIdentity, PsiProfile } from "./psi-live";

export type SafetyPillar = "PREVENTION" | "DETECTION" | "SUPPRESSION";
export type FuelCategory = "SOLID_POLYMER" | "SOLID_FABRIC" | "AEROSOL_SMOKE_DUST" | "LIQUID_DROPLET" | "GAS";
export type Facility = "MSG" | "CYGNUS" | "CIR" | "ISS" | "SUBORBITAL" | "LUNAR" | "GROUND" | "UNCLASSIFIED";
export type EvidenceTopicId =
  | "solids" | "flame-spread" | "low-flow" | "extinction" | "reduced-pressure"
  | "cabin-heat" | "smoke-detection" | "cold-flames" | "electric-field" | "liquid-droplets" | "suppression"
  | "partial-gravity";

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
  priority: SafetyPillar;
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
  topics: readonly EvidenceTopicId[];
  summary: string;
  source: Citation;
  psi?: PsiIdentity;
  importedPsi?: ImportedPsiEvidence;
}

export interface ExperimentalRun {
  id: string;
  investigationId: string;
  label: string;
  atmosphere: Partial<Atmosphere>;
  reference?: true;
  fuel?: string;
  fuelCategory?: FuelCategory;
  configuration?: string;
  psiProfile?: PsiProfile;
  topics?: readonly EvidenceTopicId[];
  width_cm?: number;
  thickness_mm?: number;
  initial_flow_velocity_cm_s?: number;
  outcome?: string;
  cabin_heat_added_kj?: number;
  steady_flame_length_cm?: number;
  weight_loss_rate_mg_min?: number;
  heater_resistance_ratio?: number;
  heating_duration_s?: number;
  aging_time_s?: number;
  co2_pct?: number;
  initial_droplet_diameter_mm?: number;
  extinction_droplet_diameter_mm?: number;
  burning_rate_mm2_s?: number;
  burn_time_s?: number;
  electric_field_kv_cm?: number;
  jet_velocity_cm_s?: number;
  nominal?: { fields: readonly (keyof Atmosphere)[]; basis: string };
  source: Citation;
}

export interface PsiDataset {
  investigations: Investigation[];
  runs: ExperimentalRun[];
}
