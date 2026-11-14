import { create } from "zustand";
import { missionPresets } from "../data/mission_presets";
import { runsById } from "../data/psi";
import type { Atmosphere, EnvironmentPreset, EvidenceTopicId, Facility } from "../types/psi";

type Side = "a" | "b";
export type EvidenceSelection = { kind: "study" | "run"; id: string };

interface AetherState {
  profile: EnvironmentPreset;
  atmosphere: Atmosphere;
  mode: "engineer" | "student";
  facility: Facility | "all";
  topic: EvidenceTopicId | null;
  query: string;
  selection: EvidenceSelection | null;
  studyFilter: string | null;
  resultsView: "study" | "run" | null;
  inspectorView: "evidence" | "atmosphere";
  graphView: "relationships" | "overview" | "runs" | "conditions";
  comparison: Record<Side, string>;
  selectMission: (profile: EnvironmentPreset) => void;
  updateAtmosphere: (field: keyof Atmosphere, value: number) => void;
  setMode: (mode: AetherState["mode"]) => void;
  setFacility: (facility: AetherState["facility"]) => void;
  setTopic: (topic: EvidenceTopicId | null) => void;
  setQuery: (query: string) => void;
  clearFilters: () => void;
  inspect: (selection: EvidenceSelection) => void;
  setStudyFilter: (studyFilter: string | null) => void;
  setResultsView: (view: AetherState["resultsView"]) => void;
  setInspectorView: (view: AetherState["inspectorView"]) => void;
  setGraphView: (view: AetherState["graphView"]) => void;
  selectRun: (side: Side, runId: string) => void;
}

export const useAetherStore = create<AetherState>((set) => ({
  profile: missionPresets[0],
  atmosphere: missionPresets[0].atmosphere,
  mode: "engineer",
  facility: "all",
  topic: null,
  query: "",
  selection: { kind: "study", id: "SAFFIRE-VI" },
  studyFilter: null,
  resultsView: null,
  inspectorView: "evidence",
  graphView: "relationships",
  comparison: { a: "SAFFIRE-V-E6", b: "SAFFIRE-VI-E6" },
  selectMission: (profile) => set({ profile, atmosphere: profile.atmosphere }),
  updateAtmosphere: (field, value) => set(({ atmosphere }) => ({ atmosphere: { ...atmosphere, [field]: value } })),
  setMode: (mode) => set({ mode }),
  setFacility: (facility) => set({ facility, studyFilter: null, graphView: "relationships" }),
  setTopic: (topic) => set({ topic, studyFilter: null, graphView: "relationships" }),
  setQuery: (query) => set({
    query, selection: null, studyFilter: null, resultsView: null, graphView: "relationships", inspectorView: "evidence",
  }),
  clearFilters: () => set({ facility: "all", topic: null, studyFilter: null }),
  inspect: (selection) => set(({ studyFilter, graphView }) => {
    const isRun = selection.kind === "run";
    return {
      selection, resultsView: selection.kind, inspectorView: "evidence",
      graphView: graphView === "conditions" ? graphView : isRun ? "runs" : "relationships",
      studyFilter: isRun && runsById.get(selection.id)?.investigationId === studyFilter ? studyFilter : null,
    };
  }),
  setStudyFilter: (studyFilter) => set({
    studyFilter, resultsView: "run", selection: null, graphView: studyFilter ? "runs" : "relationships",
  }),
  setResultsView: (resultsView) => set({ resultsView, selection: null, studyFilter: null, graphView: "relationships" }),
  setInspectorView: (inspectorView) => set({ inspectorView }),
  setGraphView: (graphView) => set({ graphView }),
  selectRun: (side, runId) => set(({ comparison }) => ({ comparison: { ...comparison, [side]: runId } })),
}));
