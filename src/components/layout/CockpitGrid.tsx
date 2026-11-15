"use client";

import { useMemo } from "react";
import { TopNavbar } from "./TopNavbar";
import { RankedDatasetList } from "../sidebar/RankedDatasetList";
import { EvidenceSearch } from "../sidebar/EvidenceSearch";
import { KnowledgeGraphCanvas } from "../nexus/KnowledgeGraphCanvas";
import { EvidenceInspector } from "../nexus/EvidenceInspector";
import { ExperimentGitDiff } from "../nexus/ExperimentGitDiff";
import { buildEvidenceIndex } from "../../core/si-engine/semantic-search";
import { computeFSRS, rankRuns } from "../../core/si-engine/fsrs-ranker";
import { mergePsiCatalog } from "../../core/si-engine/merge-psi-catalog";
import { psiDataset } from "../../data/psi";
import { topicsForRun } from "../../data/psi_vocabulary";
import { usePsiLiveSync } from "../../hooks/usePsiLiveSync";
import { isCombustion } from "../../lib/psi/records";
import { useAetherStore, type EvidenceSelection } from "../../store/useAetherStore";
import type { ExperimentalRun } from "../../types/psi";

export function CockpitGrid() {
  const profile = useAetherStore((state) => state.profile);
  const atmosphere = useAetherStore((state) => state.atmosphere);
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
  const studyScores = useMemo(() => new Map(dataset.investigations.flatMap((study) => (
    study.importedPsi?.fsrs.status === "sin-datos-suficientes" ? []
      : [[study.id, computeFSRS({ study, runs: runsByStudy.get(study.id) ?? [] }, atmosphere, profile.priority)] as const]
  ))), [dataset.investigations, runsByStudy, profile.priority, atmosphere]);
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

  return (
    <div className="cockpit">
      <TopNavbar sync={sync} />
      <EvidenceSearch search={search} />
      <main className="cockpit-grid">
        <RankedDatasetList studies={studies} rankedRuns={rankedRuns} studyScores={studyScores} studiesById={studiesById}
          runsByStudy={runsByStudy} search={search} current={current} view={view} />
        <KnowledgeGraphCanvas studies={studies} runs={scopedRuns} current={current} searchActive={search.active} />
        <EvidenceInspector study={current ? studiesById.get(runsById.get(current.id)?.investigationId ?? current.id) : undefined}
          run={current?.kind === "run" ? runsById.get(current.id) : undefined}
          search={search} availableRuns={availableRuns} literature={literature}
          rankedRun={rank.find(({ run }) => current?.kind === "run" && run.id === current.id)} />
        <ExperimentGitDiff runs={dataset.runs} runsById={runsById} studiesById={studiesById} areaStudies={areaStudies} />
      </main>
    </div>
  );
}
