import { create } from "zustand";
import { missionPresets } from "../data/mission_presets";
import type { Atmosphere, EnvironmentPreset, Facility } from "../types/psi";

type Side = "a" | "b";

interface AetherState {
  profile: EnvironmentPreset;
  atmosphere: Atmosphere;
  mode: "engineer" | "student";
  facility: Facility | "all";
  investigationId: string | null;
  comparison: Record<Side, string>;
  selectMission: (profile: EnvironmentPreset) => void;
  updateAtmosphere: (field: keyof Atmosphere, value: number) => void;
  setMode: (mode: AetherState["mode"]) => void;
  setFacility: (facility: AetherState["facility"]) => void;
  selectInvestigation: (study: { id: string; facility: Facility }) => void;
  selectRun: (side: Side, runId: string) => void;
}

export const useAetherStore = create<AetherState>((set) => ({
  profile: missionPresets[0],
  atmosphere: missionPresets[0].atmosphere,
  mode: "engineer",
  facility: "all",
  investigationId: null,
  comparison: { a: "SAFFIRE-V-E6", b: "SAFFIRE-VI-E6" },
  selectMission: (profile) => set({ profile, atmosphere: profile.atmosphere }),
  updateAtmosphere: (field, value) => set(({ atmosphere }) => ({ atmosphere: { ...atmosphere, [field]: value } })),
  setMode: (mode) => set({ mode }),
  setFacility: (facility) => set({ facility, investigationId: null }),
  selectInvestigation: (study) => set(({ investigationId }) => ({
    facility: study.facility,
    investigationId: investigationId === study.id ? null : study.id,
  })),
  selectRun: (side, runId) => set(({ comparison }) => ({ comparison: { ...comparison, [side]: runId } })),
}));
