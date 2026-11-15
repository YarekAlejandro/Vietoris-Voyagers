import { create } from "zustand";
import { missionPresets } from "../data/mission_presets";
import type { InterpretationResult } from "../core/si-engine/interpret";
import { mergeSyncedPsiRecords, type SyncedPsiRecord } from "../core/si-engine/merge-psi-catalog";
import type { Atmosphere, EnvironmentPreset, EvidenceTopicId, Facility } from "../types/psi";
import type { NtrsRecord, PsiArea, PsiSearchResponse } from "../types/psi-live";

type Side = "a" | "b";
export type EvidenceSelection = { kind: "study" | "run"; id: string };

interface AetherState {
  profile: EnvironmentPreset;
  atmosphere: Atmosphere;
  mode: "engineer" | "student";
  facility: Facility | "all";
  topic: EvidenceTopicId | null;
  query: string;
  includeStudyRuns: boolean;
  selection: EvidenceSelection | null;
  studyFilter: string | null;
  resultsView: "study" | "run" | null;
  inspectorView: "evidence" | "atmosphere" | "radar";
  graphView: "relationships" | "overview" | "runs" | "conditions" | "scene";
  comparison: Record<Side, string>;
  psiArea: PsiArea;
  psiRecords: ReadonlyMap<string, SyncedPsiRecord>;
  psiCatalog: {
    area: PsiArea; count: number; disciplines: number; status: PsiSearchResponse["status"]; fetchedAt: string; snapshotGeneratedAt?: string;
  } | null;
  psiLookup: { area: PsiArea; term: string; accessions: ReadonlySet<string>; literature: NtrsRecord[] } | null;
  ntrsCatalog: NtrsRecord[];
  /** Caché de interpretaciones por clave `kind|ids|mode|lang` (ver `interpretationKey`). */
  interpretations: Record<string, InterpretationResult>;
  setInterpretation: (key: string, result: InterpretationResult) => void;
  selectMission: (profile: EnvironmentPreset) => void;
  updateAtmosphere: (field: keyof Atmosphere, value: number) => void;
  setMode: (mode: AetherState["mode"]) => void;
  setFacility: (facility: AetherState["facility"]) => void;
  setTopic: (topic: EvidenceTopicId | null) => void;
  setQuery: (query: string, includeStudyRuns?: boolean) => void;
  clearFilters: () => void;
  inspect: (selection: EvidenceSelection, investigationId?: string) => void;
  setStudyFilter: (studyFilter: string | null) => void;
  setResultsView: (view: AetherState["resultsView"]) => void;
  setInspectorView: (view: AetherState["inspectorView"]) => void;
  setGraphView: (view: AetherState["graphView"]) => void;
  selectRun: (side: Side, runId: string) => void;
  setPsiArea: (area: PsiArea) => void;
  receivePsi: (area: PsiArea, term: string, response: PsiSearchResponse) => void;
}

export const useAetherStore = create<AetherState>((set) => ({
  profile: missionPresets[0],
  atmosphere: missionPresets[0].atmosphere,
  mode: "engineer",
  facility: "all",
  topic: null,
  query: "",
  includeStudyRuns: false,
  selection: { kind: "study", id: "SAFFIRE-VI" },
  studyFilter: null,
  resultsView: null,
  inspectorView: "evidence",
  graphView: "relationships",
  comparison: { a: "SAFFIRE-V-E6", b: "SAFFIRE-VI-E6" },
  psiArea: "combustion",
  psiRecords: new Map(),
  psiCatalog: null,
  psiLookup: null,
  ntrsCatalog: [],
  interpretations: {},
  setInterpretation: (key, result) => set(({ interpretations }) => ({ interpretations: { ...interpretations, [key]: result } })),
  selectMission: (profile) => set({ profile, atmosphere: profile.atmosphere }),
  updateAtmosphere: (field, value) => set(({ atmosphere }) => ({ atmosphere: { ...atmosphere, [field]: value } })),
  setMode: (mode) => set({ mode }),
  setFacility: (facility) => set({ facility, studyFilter: null, graphView: "relationships" }),
  setTopic: (topic) => set({ topic, studyFilter: null, graphView: "relationships" }),
  setQuery: (query, includeStudyRuns = false) => set(({ inspectorView }) => ({
    query, includeStudyRuns, selection: null, studyFilter: null, resultsView: null, graphView: "relationships",
    inspectorView: inspectorView === "radar" ? "radar" : "evidence",
  })),
  clearFilters: () => set({ facility: "all", topic: null, studyFilter: null }),
  inspect: (selection, investigationId) => set(({ studyFilter, graphView }) => {
    const isRun = selection.kind === "run";
    return {
      selection, resultsView: selection.kind, inspectorView: "evidence",
      graphView: graphView === "conditions" || graphView === "scene" ? graphView : isRun ? "runs" : "relationships",
      studyFilter: isRun && investigationId === studyFilter ? studyFilter : null,
    };
  }),
  setStudyFilter: (studyFilter) => set({
    studyFilter, resultsView: "run", selection: null, graphView: studyFilter ? "runs" : "relationships",
  }),
  setResultsView: (resultsView) => set({ resultsView, selection: null, studyFilter: null, graphView: "relationships" }),
  setInspectorView: (inspectorView) => set({ inspectorView }),
  setGraphView: (graphView) => set({ graphView }),
  selectRun: (side, runId) => set(({ comparison }) => ({ comparison: { ...comparison, [side]: runId } })),
  setPsiArea: (psiArea) => set({ psiArea, facility: "all", topic: null, studyFilter: null, graphView: "relationships" }),
  receivePsi: (area, term, response) => set((state) => {
    if (state.psiArea !== area || (term && state.query.trim() !== term)) return state;
    const psiRecords = mergeSyncedPsiRecords(state.psiRecords, response);
    if (term) {
      return {
        psiRecords,
        psiLookup: {
          area, term, literature: response.literature,
          accessions: new Set(response.sources.psi.ok ? response.investigations.map(({ accession }) => accession) : []),
        },
      };
    }
    return {
      psiRecords,
      ntrsCatalog: response.sources.ntrs.ok ? response.literature : state.ntrsCatalog,
      psiCatalog: {
        area, count: response.investigations.length, status: response.status, fetchedAt: response.fetchedAt,
        disciplines: new Set(response.investigations.map((record) => record.researchArea)).size,
        snapshotGeneratedAt: response.snapshotGeneratedAt,
      },
    };
  }),
}));
