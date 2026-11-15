"use client";

import { useMemo } from "react";
import { compareRuns } from "../../core/si-engine/git-diff";
import { sceneComparison, type ExperimentSceneEvidence } from "../../core/si-engine/experiment-scene";
import { investigationsById, runsById } from "../../data/psi";
import { useAetherStore } from "../../store/useAetherStore";
import { SceneDiagram, SceneReadouts, type SceneStatuses } from "./ExperimentScene";

type Side = "a" | "b";

function SceneCard({ side, label, evidence, statuses, referenceDiameter_mm }: {
  side: Side; label: string; evidence: ExperimentSceneEvidence | null | undefined; statuses: SceneStatuses; referenceDiameter_mm?: number;
}) {
  return <article className="scene-card" data-side={side} aria-label={`Corrida ${side.toUpperCase()}: ${label}`}>
    <header><span className="scene-side-badge">{side.toUpperCase()}</span><strong>{label}</strong></header>
    {evidence
      ? <>
        <div className="scene-viewport"><SceneDiagram evidence={evidence} referenceDiameter_mm={referenceDiameter_mm} /></div>
        <SceneReadouts evidence={evidence} statuses={statuses} />
      </>
      : <p className="psi-note">Sin esquema: la corrida no reporta geometría.</p>}
  </article>;
}

export function SceneComparison() {
  const comparison = useAetherStore((state) => state.comparison);
  const runA = runsById.get(comparison.a);
  const runB = runsById.get(comparison.b);
  const scenes = useMemo(() => runA && runB ? sceneComparison(runA, runB) : undefined, [runA, runB]);
  const statuses = useMemo(() => {
    if (!runA || !runB) return {} as SceneStatuses;
    return Object.fromEntries(compareRuns(runA, runB, investigationsById).map(({ field, status }) => [field.id, status])) as SceneStatuses;
  }, [runA, runB]);

  if (!runA || !runB || !scenes) {
    return <div className="empty-evidence"><p>Elige las corridas A y B para ver su esquema.</p></div>;
  }

  return <div className="scene-compare">
    <div className="scene-compare-cards">
      <SceneCard side="a" label={runA.label} evidence={scenes.a} statuses={statuses} referenceDiameter_mm={scenes.scale.droplet_reference_mm} />
      <SceneCard side="b" label={runB.label} evidence={scenes.b} statuses={statuses} referenceDiameter_mm={scenes.scale.droplet_reference_mm} />
    </div>
    {scenes.a && scenes.b && !scenes.sameKind &&
      <p className="psi-note" role="status">Tipos de montaje distintos; compara las condiciones en la tabla.</p>}
    <p className="scene-legend">
      <span data-status="changed">Distinto</span> <span data-status="equal">Igual</span> <span data-status="missing">Sin dato o nominal</span>
      {" · "}Representación ilustrativa de las condiciones del experimento; no es una predicción.
    </p>
  </div>;
}
