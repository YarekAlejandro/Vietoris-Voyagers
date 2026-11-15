"use client";

import { useCallback, useMemo, useState } from "react";
import { TopNavbar } from "./TopNavbar";
import { RankedDatasetList } from "../sidebar/RankedDatasetList";
import { EvidenceSearch } from "../sidebar/EvidenceSearch";
import { KnowledgeGraphCanvas } from "../nexus/KnowledgeGraphCanvas";
import { EvidenceInspector } from "../nexus/EvidenceInspector";
import { ExperimentGitDiff } from "../nexus/ExperimentGitDiff";
import { AssistantSpotlight, type SpotlightRequest } from "../assistant/AssistantSpotlight";
import { EvidenceAssistant, type AssistantConversationContext } from "../assistant/EvidenceAssistant";
import { buildEvidenceIndex } from "../../core/si-engine/semantic-search";
import { answerPageQuestion, type AssistantPointer, type PageAssistantAnswer, type PageAssistantContext } from "../../core/si-engine/page-assistant";
import type { AssistantGroundingInput } from "../../core/si-engine/assistant-grounding";
import { computeFSRS, rankRuns } from "../../core/si-engine/fsrs-ranker";
import { mergePsiCatalog } from "../../core/si-engine/merge-psi-catalog";
import { computeCoverage } from "../../core/si-engine/scenario-coverage";
import { psiDataset } from "../../data/psi";
import { missionPresets } from "../../data/mission_presets";
import { topicsForRun } from "../../data/psi_vocabulary";
import { usePsiLiveSync } from "../../hooks/usePsiLiveSync";
import { isCombustion } from "../../lib/psi/records";
import { useAetherStore, type EvidenceSelection } from "../../store/useAetherStore";
import type { ExperimentalRun } from "../../types/psi";

const assistantPanels = {
  search: ["#evidence-query", "Búsqueda semántica"],
  catalog: ["#ranking-title", "Catálogo de evidencia"],
  graph: ["#nexus-title", "PSI-Nexus"],
  inspector: ["#assistant-evidence-record", "Ficha de evidencia"],
  coverage: ["#assistant-coverage", "Cobertura del escenario"],
  comparison: ["#comparison-title", "Comparación experimental"],
  atmosphere: ["#assistant-atmosphere", "Atmósfera"],
  scene: ["#assistant-scene", "Escena del experimento"],
  interpret: ["#assistant-interpret", "Interpretar"],
} as const satisfies Record<AssistantPointer["target"], readonly [string, string]>;

async function requestAssistantAnswer(input: AssistantGroundingInput): Promise<PageAssistantAnswer | null> {
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10500),
    });
    if (!response.ok) return null;
    const { answer } = await response.json();
    return typeof answer?.text === "string" && Array.isArray(answer.pointers) ? answer : null;
  } catch {
    return null;
  }
}

export function CockpitGrid({ assistantAiEnabled }: { assistantAiEnabled: boolean }) {
  const [expandedPanel, setExpandedPanel] = useState<"graph" | "comparison" | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightRequest | null>(null);
  const [assistantSide, setAssistantSide] = useState<"left" | "right">("right");
  const toggleGraph = useCallback(() => setExpandedPanel((panel) => panel === "graph" ? null : "graph"), []);
  const toggleComparison = useCallback(() => setExpandedPanel((panel) => panel === "comparison" ? null : "comparison"), []);
  const profile = useAetherStore((state) => state.profile);
  const atmosphere = useAetherStore((state) => state.atmosphere);
  const coverage = useMemo(() => computeCoverage(atmosphere, psiDataset.runs), [atmosphere]);
  const query = useAetherStore((state) => state.query);
  const includeStudyRuns = useAetherStore((state) => state.includeStudyRuns);
  const facility = useAetherStore((state) => state.facility);
  const topic = useAetherStore((state) => state.topic);
  const studyFilter = useAetherStore((state) => state.studyFilter);
  const selection = useAetherStore((state) => state.selection);
  const preferredView = useAetherStore((state) => state.resultsView);
  const area = useAetherStore((state) => state.psiArea);
  const psiRecords = useAetherStore((state) => state.psiRecords);
  const lookup = useAetherStore((state) => state.psiLookup);
  const radar = useAetherStore((state) => state.ntrsCatalog);
  const sync = usePsiLiveSync();

  const dataset = useMemo(() => mergePsiCatalog(psiDataset, psiRecords), [psiRecords]);
  const { studiesById, runsById, runsByStudy, evidenceIndex } = useMemo(() => {
    const runsByStudy = new Map<string, ExperimentalRun[]>();
    for (const run of dataset.runs) {
      const runs = runsByStudy.get(run.investigationId);
      if (runs) runs.push(run);
      else runsByStudy.set(run.investigationId, [run]);
    }
    return {
      studiesById: new Map(dataset.investigations.map((study) => [study.id, study])),
      runsById: new Map(dataset.runs.map((run) => [run.id, run])),
      runsByStudy,
      evidenceIndex: buildEvidenceIndex(dataset),
    };
  }, [dataset]);
  const lookupResults = lookup?.term === query.trim() && lookup.area === area ? lookup : null;
  const search = useMemo(() => {
    const local = evidenceIndex.search(query);
    if (!lookupResults?.accessions.size) return local;
    const studies = new Map(local.studies);
    for (const study of dataset.investigations) {
      if (study.psi && lookupResults.accessions.has(study.psi.accession) && !studies.has(study.id)) {
        studies.set(study.id, { reasons: ["Coincidencia del catálogo NASA PSI"], score: 0 });
      }
    }
    return { ...local, active: true, studies };
  }, [evidenceIndex, query, lookupResults, dataset.investigations]);
  const literature = [...new Map([...(lookupResults?.literature ?? []), ...radar].map((record) => [record.id, record])).values()];
  const rank = useMemo(() => rankRuns(dataset.runs, studiesById, profile, atmosphere), [dataset.runs, studiesById, profile, atmosphere]);
  const studyScores = useMemo(() => new Map(dataset.investigations.flatMap((study) => {
    const runs = runsByStudy.get(study.id)?.filter((run) => !run.reference) ?? [];
    return study.importedPsi?.fsrs.status === "sin-datos-suficientes" || !runs.length
      ? [] : [[study.id, computeFSRS({ study, runs }, atmosphere, profile.priority)] as const];
  })), [dataset.investigations, runsByStudy, profile.priority, atmosphere]);
  const areaStudies = useMemo(() => dataset.investigations.filter((study) => (
    !study.importedPsi || area === "all" || isCombustion(study.importedPsi)
  )), [dataset.investigations, area]);
  const studies = useMemo(() => areaStudies.filter((study) => (
    (facility === "all" || study.facility === facility) &&
    (!topic || study.topics.includes(topic)) &&
    (!search.active || search.studies.has(study.id))
  )),
  [areaStudies, facility, topic, search]);

  const visibleStudyIds = useMemo(() => new Set(studies.map(({ id }) => id)), [studies]);
  const availableRuns = useMemo(() => dataset.runs.filter((run) => (
    visibleStudyIds.has(run.investigationId) &&
    (!topic || topicsForRun(run).includes(topic)) &&
    (!search.active || includeStudyRuns || run.psiProfile || search.runs.has(run.id))
  )), [dataset.runs, visibleStudyIds, topic, search, includeStudyRuns]);
  const scopedRuns = availableRuns.filter(({ investigationId }) => !studyFilter || investigationId === studyFilter);
  const availableRunIds = new Set(scopedRuns.map(({ id }) => id));
  const rankedRuns = rank.filter(({ run }) => availableRunIds.has(run.id));
  const matchingRunStudies = new Set(availableRuns.map(({ investigationId }) => investigationId));
  const view = preferredView ?? (search.active && rankedRuns.length > 0 && studies.every(({ id }) =>
    matchingRunStudies.has(id)) ? "run" : "study");
  const hasSelection = selection?.kind === "study"
    ? visibleStudyIds.has(selection.id)
    : selection?.kind === "run" && rankedRuns.some(({ run }) => run.id === selection.id);
  const fallbackId = view === "run" ? rankedRuns[0]?.run.id ?? studies[0]?.id : studies[0]?.id;
  const fallbackKind = view === "run" && rankedRuns.length ? "run" : "study";
  const current: EvidenceSelection | null = hasSelection ? selection : fallbackId ? { kind: fallbackKind, id: fallbackId } : null;

  function pointTo(pointer: AssistantPointer, navigate: boolean) {
    const state = useAetherStore.getState();
    const { target, selection: requested, comparison, profileId, atmosphereField, evidenceField } = pointer;
    const [selector, label] = assistantPanels[target];
    const panel = target === "graph" ? "graph" : target === "comparison" || target === "interpret" ? "comparison" : null;
    const studyId = requested?.kind === "run" ? runsById.get(requested.id)?.investigationId : requested?.id;
    if (requested && (!studyId || !studiesById.has(studyId))) return;
    const visible = !requested || (requested.kind === "run" ? availableRunIds.has(requested.id) : visibleStudyIds.has(requested.id));

    if (!navigate && (!visible || (expandedPanel && expandedPanel !== panel) ||
      (profileId && profileId !== state.profile.id) ||
      (comparison && (comparison.a !== state.comparison.a || comparison.b !== state.comparison.b)))) {
      setSpotlight(null);
      return;
    }

    if (expandedPanel && expandedPanel !== panel) setExpandedPanel(null);
    if (!visible && studyId) {
      if (!areaStudies.some((study) => study.id === studyId)) state.setPsiArea("all");
      state.clearFilters();
      state.setQuery("");
    }
    if (requested) state.inspect(requested, studyId);
    if (comparison && runsById.has(comparison.a) && runsById.has(comparison.b)) {
      if (comparison.a !== state.comparison.a || comparison.b !== state.comparison.b) useAetherStore.setState({ comparison });
    }
    if (profileId && profileId !== state.profile.id) {
      const preset = missionPresets.find(({ id }) => id === profileId);
      if (preset) state.selectMission(preset);
    }
    if (target === "graph" && requested) state.setGraphView(requested.kind === "run" ? "runs" : "overview");
    if (target === "inspector" || target === "scene" || (target === "coverage" && state.inspectorView === "radar")) state.setInspectorView("evidence");
    if (target === "atmosphere" && (navigate || atmosphereField)) state.setInspectorView("atmosphere");

    const nodeSelector = target === "graph" && requested
      ? `.react-flow__node[data-id="${CSS.escape(`${requested.kind}:${requested.id}`)}"]` : null;
    const fieldSelector = atmosphereField ? `#${CSS.escape(atmosphereField)}`
      : evidenceField ? `#assistant-field-${CSS.escape(evidenceField)}` : null;
    const inspectorTarget = target === "inspector" || target === "scene" || target === "coverage" || target === "atmosphere";
    setAssistantSide(inspectorTarget ? "left" : "right");
    setSpotlight({
      selector: nodeSelector ?? fieldSelector ?? selector, label, focus: navigate,
      fallback: nodeSelector || fieldSelector ? selector : inspectorTarget ? "#inspector-title" : target === "interpret" ? "#comparison-title" : undefined,
    });
  }

  function askAssistant(question: string, { previousQuestion, previousSelection }: AssistantConversationContext) {
    const areaStudyIds = new Set(areaStudies.map(({ id }) => id));
    const stateAtQuestion = useAetherStore.getState();
    const context: PageAssistantContext = {
      studies: areaStudies, runs: dataset.runs.filter(({ investigationId }) => areaStudyIds.has(investigationId)),
      search: evidenceIndex.search, coverage, profile, atmosphere, selection: previousSelection ?? current, comparison: stateAtQuestion.comparison,
      sceneEnabled: process.env.NEXT_PUBLIC_EXPERIMENT_SCENE !== "false",
    };
    const local = answerPageQuestion(question, context);
    const localPointer = local.pointers[0];
    const directControl = localPointer?.target === "scene" || localPointer?.target === "atmosphere" ||
      (localPointer?.target === "graph" && Boolean(localPointer.selection));
    if (assistantAiEnabled && navigator.onLine && !directControl) {
      return requestAssistantAnswer({
        question, previousQuestion, selection: context.selection ?? undefined, comparison: context.comparison,
        profileId: profile.id, atmosphere,
      }).then((answer) => {
        const latest = useAetherStore.getState();
        const isSameView = latest.selection === stateAtQuestion.selection && latest.query === stateAtQuestion.query &&
          latest.inspectorView === stateAtQuestion.inspectorView && latest.comparison === stateAtQuestion.comparison && latest.profile === profile;
        const exactReadout = answer && localPointer?.evidenceField && answer.pointers[0]?.target === "inspector" &&
          answer.pointers[0]?.selection?.id === localPointer.selection?.id;
        const result: PageAssistantAnswer = !answer ? { ...local, origin: "local" }
          : exactReadout ? { ...answer, pointers: [localPointer, ...answer.pointers.slice(1)] } : answer;
        if (isSameView && result.pointers[0] && !result.unanswered) pointTo(result.pointers[0], false);
        return result;
      });
    }
    if (localPointer && !local.unanswered) pointTo(localPointer, false);
    else setSpotlight(null);
    return local;
  }

  return (
    <>
      <div className="cockpit">
        <TopNavbar sync={sync} />
        <EvidenceSearch search={search} />
        <main className="cockpit-grid">
          <RankedDatasetList studies={studies} rankedRuns={rankedRuns} studyScores={studyScores} studiesById={studiesById}
            runsByStudy={runsByStudy} search={search} current={current} view={view} />
          <KnowledgeGraphCanvas studies={studies} runs={scopedRuns} current={current} searchActive={search.active}
            expanded={expandedPanel === "graph"} onToggleSize={toggleGraph} />
          <EvidenceInspector study={current ? studiesById.get(runsById.get(current.id)?.investigationId ?? current.id) : undefined}
            run={current?.kind === "run" ? runsById.get(current.id) : undefined}
            search={search} availableRuns={availableRuns} literature={literature} coverage={coverage}
            rankedRun={rank.find(({ run }) => current?.kind === "run" && run.id === current.id)} />
          <ExperimentGitDiff runs={dataset.runs} runsById={runsById} studiesById={studiesById} areaStudies={areaStudies}
            expanded={expandedPanel === "comparison"} onToggleSize={toggleComparison} />
        </main>
      </div>
      <AssistantSpotlight request={spotlight} />
      <EvidenceAssistant onAsk={askAssistant} onNavigate={(pointer) => pointTo(pointer, true)} side={assistantSide} />
    </>
  );
}
