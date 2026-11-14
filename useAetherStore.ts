export type PersonaMode = 'engineer' | 'explorer'; // 'engineer' = ecuaciones y datos crudos | 'explorer' = educativo y spin-offs terrestres
export type BridgeFilter = 'ALL' | 'GAS_SOLID_BRE_BASS' | 'SMOKE_DUST_SAME_DAFT' | 'HARDWARE_CIR_MSG' | 'COOL_FLAMES_CFI_FLEX';

export interface EnvironmentVector {
  presetId: string;
  gravity_g: number;           // 0.00 a 1.00 g
  oxygen_pct: number;          // 15.0 a 100.0 %
  pressure_psia: number;       // 4.3 a 14.7 psia
  flow_velocity_cm_s: number;  // 0.0 a 50.0 cm/s
  targetFuel: 'SOLID' | 'LIQUID' | 'GAS' | 'ANY';
  safetyPillar: 'PREVENTION' | 'DETECTION' | 'SUPPRESSION' | 'ALL';
}

export interface AetherStoreState {
  environment: EnvironmentVector;
  personaMode: PersonaMode;
  activeBridge: BridgeFilter;
  selectedExperimentIds: [string, string]; // Par activo para el Git-Diff Experimental [Exp_A, Exp_B]
  inspectedRunId: string | null;
  
  // Actions
  setEnvironmentParam: <K EnvironmentVector extends keyof>(key: K, value: EnvironmentVector[K]) => void;
  applyMissionPreset: (presetId: string) => void;
  setPersonaMode: (mode: PersonaMode) => void;
  setActiveBridge: (bridge: BridgeFilter) => void;
  selectExperimentForDiff: (slot: 0 | 1, experimentId: string) => void;
}