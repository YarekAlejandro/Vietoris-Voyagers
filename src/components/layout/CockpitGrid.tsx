"use client";

import { TopNavbar } from "./TopNavbar";
import { RankedDatasetList } from "../sidebar/RankedDatasetList";
import { KnowledgeGraphCanvas } from "../nexus/KnowledgeGraphCanvas";
import { ExperimentGitDiff } from "../nexus/ExperimentGitDiff";
import { AtmosphereSliders } from "../simulator/AtmosphereSliders";

export function CockpitGrid() {
  return (
    <div className="cockpit">
      <TopNavbar />
      <main className="cockpit-grid">
        <RankedDatasetList />
        <KnowledgeGraphCanvas />
        <AtmosphereSliders />
        <ExperimentGitDiff />
      </main>
    </div>
  );
}
