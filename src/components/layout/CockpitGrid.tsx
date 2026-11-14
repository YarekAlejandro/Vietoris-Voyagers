"use client";

import { useMemo } from "react";
import { TopNavbar } from "./TopNavbar";
import { RankedDatasetList } from "../sidebar/RankedDatasetList";
import { EvidenceSearch } from "../sidebar/EvidenceSearch";
import { KnowledgeGraphCanvas } from "../nexus/KnowledgeGraphCanvas";
import { EvidenceInspector } from "../nexus/EvidenceInspector";
import { ExperimentGitDiff } from "../nexus/ExperimentGitDiff";
import { buildEvidenceIndex } from "../../core/si-engine/semantic-search";
import { rankRuns } from "../../core/si-engine/fsrs-ranker";
import { investigationsById, psiDataset } from "../../data/psi";
import { topicsForRun } from "../../data/psi_vocabulary";
import { useAetherStore, type EvidenceSelection } from "../../store/useAetherStore";

const evidenceIndex = buildEvidenceIndex(psiDataset);

export function CockpitGrid() {
  const profile = useAetherStore((state) => state.profile);
  const atmosphere = useAetherStore((state) => state.atmosphere);
  const query = useAetherStore((state) => state.query);
  const facility = useAetherStore((state) => state.facility);
  const topic = useAetherStore((state) => state.topic);
  const studyFilter = useAetherStore((state) => state.studyFilter);
  const selection = useAetherStore((state) => state.selection);
  const preferredView = useAetherStore((state) => state.resultsView);

  const search = useMemo(() => evidenceIndex.search(query), [query]);
  const rank = useMemo(() => rankRuns(psiDataset.runs, investigationsById, profile, atmosphere), [profile, atmosphere]);
  const studies = useMemo(() => psiDataset.investigations.filter((study) => (
    (facility === "all" || study.facility === facility) &&
    (!topic || study.topics.includes(topic)) &&
    (!search.active || search.studies.has(study.id))
  )).sort((a, b) => (search.studies.get(b.id)?.score ?? 0) - (search.studies.get(a.id)?.score ?? 0)),
  [facility, topic, search]);

  const visibleStudyIds = useMemo(() => new Set(studies.map(({ id }) => id)), [studies]);
  const availableRuns = useMemo(() => psiDataset.runs.filter((run) => (
    visibleStudyIds.has(run.investigationId) &&
    (!topic || topicsForRun(run).includes(topic)) &&
    (!search.active || search.runs.has(run.id))
  )), [visibleStudyIds, topic, search]);
  const scopedRuns = availableRuns.filter(({ investigationId }) => !studyFilter || investigationId === studyFilter);
  const availableRunIds = new Set(scopedRuns.map(({ id }) => id));
  const rankedRuns = rank.filter(({ run }) => availableRunIds.has(run.id))
    .sort((a, b) => (search.runs.get(b.run.id)?.score ?? 0) - (search.runs.get(a.run.id)?.score ?? 0));
  const matchingRunStudies = new Set(availableRuns.map(({ investigationId }) => investigationId));
  const view = preferredView ?? (search.active && rankedRuns.length > 0 && studies.every(({ id }) =>
    matchingRunStudies.has(id)) ? "run" : "study");
  const hasSelection = selection?.kind === "study"
    ? visibleStudyIds.has(selection.id)
    : selection?.kind === "run" && rankedRuns.some(({ run }) => run.id === selection.id);
  const fallbackId = view === "run" ? rankedRuns[0]?.run.id ?? studies[0]?.id : studies[0]?.id;
  const fallbackKind = view === "run" && rankedRuns.length ? "run" : "study";
  const current: EvidenceSelection | null = hasSelection ? selection : fallbackId ? { kind: fallbackKind, id: fallbackId } : null;

  return (
    <div className="cockpit">
      <TopNavbar />
      <EvidenceSearch search={search} />
      <main className="cockpit-grid">
        <RankedDatasetList studies={studies} rankedRuns={rankedRuns} search={search} current={current} view={view} />
        <KnowledgeGraphCanvas studies={studies} runs={scopedRuns} current={current} searchActive={search.active} />
        <EvidenceInspector current={current} search={search} availableRuns={availableRuns}
          rankedRun={rank.find(({ run }) => current?.kind === "run" && run.id === current.id)} />
        <ExperimentGitDiff />
      </main>
    </div>
  );
}
