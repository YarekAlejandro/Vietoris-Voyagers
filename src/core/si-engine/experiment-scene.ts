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
      co2_pct: run.co2_pct,
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
  // Estilos ilustrativos asociados a evidencia reportada; sin evidencia no se dibuja llama.
  const combustionEvidence = configuration.includes("llama en")
    || run.steady_flame_length_cm !== undefined || run.cabin_heat_added_kj !== undefined;
  const flame = /sin ignición|por soplado/.test(outcome) ? "none"
    : outcome.includes("extinción a bajo flujo") ? "rounded"
      : combustionEvidence ? "attached" : "unreported";

  return {
    kind: "solid", material, flow_cm_s, showArrows: concurrent && hasMeasuredFlow,
    thickness_mm: run.thickness_mm,
    width_cm: run.width_cm,
    flame,
    twoFaces: flame === "attached" && configuration.includes("dos caras"),
  } as const;
}

const ARROW_MIN_PX = 10;
const ARROW_MAX_PX = 60;
const ARROW_FULL_SCALE_CM_S = 60;

/** Largo de la flecha de flujo: escala logarítmica con tope, para distinguir 2.2, 5, 10, 20 y 47 cm/s. */
export function flowArrowLength_px(flow_cm_s: number | undefined) {
  const flow = Math.max(0, flow_cm_s ?? 0);
  const fraction = Math.min(1, Math.log1p(flow) / Math.log1p(ARROW_FULL_SCALE_CM_S));
  return ARROW_MIN_PX + (ARROW_MAX_PX - ARROW_MIN_PX) * fraction;
}

const PLATE_EDGE_GENERIC_PX = 5;
const PLATE_EDGE_MIN_PX = 3;
const PLATE_EDGE_MAX_PX = 16;
const PLATE_FULL_SCALE_MM = 10;

/** Grosor visible del canto de la placa; escala global de raíz cuadrada para comparar entre tarjetas. */
export function plateEdge_px(thickness_mm: number | undefined) {
  if (thickness_mm === undefined || !Number.isFinite(thickness_mm) || thickness_mm <= 0) return PLATE_EDGE_GENERIC_PX;
  const fraction = Math.min(1, Math.sqrt(thickness_mm / PLATE_FULL_SCALE_MM));
  return PLATE_EDGE_MIN_PX + (PLATE_EDGE_MAX_PX - PLATE_EDGE_MIN_PX) * fraction;
}

const DROPLET_MAX_RADIUS_PX = 40;

/** Radio de la gota respecto de un diámetro de referencia común (el mayor del par). */
export function dropletRadius_px(diameter_mm: number, referenceDiameter_mm: number) {
  return DROPLET_MAX_RADIUS_PX * diameter_mm / referenceDiameter_mm;
}

export function dropletReference_mm(...evidence: (ExperimentSceneEvidence | null | undefined)[]) {
  const diameters = evidence.flatMap((item) => item?.kind === "droplet"
    ? [item.initial_droplet_diameter_mm, item.extinction_droplet_diameter_mm] : [])
    .filter((value): value is number => value !== undefined);
  return diameters.length ? Math.max(...diameters) : undefined;
}

export function sceneComparison(runA: ExperimentalRun, runB: ExperimentalRun) {
  const a = sceneEvidenceForRun(runA);
  const b = sceneEvidenceForRun(runB);
  const sameKind = a !== null && b !== null && a.kind === b.kind;
  return { a, b, sameKind, scale: { droplet_reference_mm: sameKind ? dropletReference_mm(a, b) : undefined } };
}
