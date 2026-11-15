import type { ExperimentalRun } from "../../types/psi";

export type ExperimentSceneEvidence = NonNullable<ReturnType<typeof sceneEvidenceForRun>>;

export function sceneEvidenceForRun(run: ExperimentalRun) {
  if (run.reference || run.psiProfile) return null;

  const configuration = run.configuration?.toLowerCase() ?? "";
  const flow_cm_s = run.nominal?.fields.includes("flow_velocity_cm_s") ? undefined : run.atmosphere.flow_velocity_cm_s;
  const hasMeasuredFlow = flow_cm_s !== undefined && flow_cm_s > 0;
  const material = run.fuel ?? "Material sin dato";

  if (run.fuelCategory === "LIQUID_DROPLET" && configuration.includes("gota aislada")) {
    const initial_droplet_diameter_mm = run.initial_droplet_diameter_mm;
    if (initial_droplet_diameter_mm === undefined || !Number.isFinite(initial_droplet_diameter_mm) || initial_droplet_diameter_mm <= 0) return null;

    return {
      kind: "droplet", material, flow_cm_s, showArrows: false,
      initial_droplet_diameter_mm,
      extinction_droplet_diameter_mm: run.extinction_droplet_diameter_mm,
    } as const;
  }

  if (run.fuelCategory === "AEROSOL_SMOKE_DUST" && configuration.includes("pirólisis sin llama")) {
    return {
      kind: "aerosol", material, flow_cm_s, showArrows: hasMeasuredFlow,
      heating_duration_s: run.heating_duration_s,
      aging_time_s: run.aging_time_s,
    } as const;
  }

  if (run.fuelCategory !== "SOLID_POLYMER" && run.fuelCategory !== "SOLID_FABRIC") return null;

  const outcome = run.outcome?.toLowerCase() ?? "";
  const concurrent = configuration.includes("concurrente");
  // Estilos ilustrativos asociados a descripciones de la corrida, sin inferir un régimen por umbral.
  const flame = /sin ignición|por soplado/.test(outcome) ? "none"
    : outcome.includes("extinción a bajo flujo") ? "rounded"
      : concurrent ? "attached" : "none";

  return {
    kind: "solid", material, flow_cm_s, showArrows: concurrent && hasMeasuredFlow,
    thickness_mm: run.thickness_mm,
    width_cm: run.width_cm,
    flame,
    twoFaces: flame === "attached" && configuration.includes("dos caras"),
  } as const;
}
