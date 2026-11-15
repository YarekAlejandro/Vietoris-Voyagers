import type { ExperimentalRun } from "../../types/psi";

export type ExperimentSceneEvidence = NonNullable<ReturnType<typeof sceneEvidenceForRun>>;

export function sceneEvidenceForRun(run: ExperimentalRun) {
  if (run.reference || run.psiProfile ||
      (run.fuelCategory !== "SOLID_POLYMER" && run.fuelCategory !== "SOLID_FABRIC")) return null;

  const configuration = run.configuration?.toLowerCase() ?? "";
  const outcome = run.outcome?.toLowerCase() ?? "";
  const concurrent = configuration.includes("concurrente");
  const flow_cm_s = run.nominal?.fields.includes("flow_velocity_cm_s") ? undefined : run.atmosphere.flow_velocity_cm_s;
  // Estilos ilustrativos asociados a descripciones de la corrida, sin inferir un régimen por umbral.
  const flame = /sin ignición|por soplado/.test(outcome) ? "none"
    : outcome.includes("extinción a bajo flujo") ? "rounded"
      : concurrent ? "attached" : "none";

  return {
    material: run.fuel ?? "Material sin dato",
    thickness_mm: run.thickness_mm,
    width_cm: run.width_cm,
    flow_cm_s,
    showArrows: concurrent && flow_cm_s !== undefined && flow_cm_s > 0,
    flame,
    twoFaces: flame === "attached" && configuration.includes("dos caras"),
  } as const;
}
