import { expect, it } from "vitest";
import { runsById } from "../../../data/psi";
import { flowArrowLength_px, sceneComparison, sceneEvidenceForRun } from "../experiment-scene";

it("usa el espesor y el flujo reportados y respeta la configuración en dos caras", () => {
  const run = runsById.get("SAFFIRE-VI-E6")!;
  expect(sceneEvidenceForRun(run)).toMatchObject({
    kind: "solid", thickness_mm: run.thickness_mm, flow_cm_s: run.atmosphere.flow_velocity_cm_s,
    flame: "attached", twoFaces: true, showArrows: true,
  });
});

it("sigue el resultado descrito y omite la velocidad nominal", () => {
  const run = runsById.get("BASS-II-GMT45-T4")!;
  expect(sceneEvidenceForRun(run)).toMatchObject({ kind: "solid", flame: "rounded" });
  expect(sceneEvidenceForRun({ ...run, nominal: { fields: ["flow_velocity_cm_s"], basis: "Referencia" } }))
    .toMatchObject({ flow_cm_s: undefined, showArrows: false });
  expect(sceneEvidenceForRun(runsById.get("BASS-II-GMT175-T9")!)).toMatchObject({ kind: "solid", flame: "none" });
});

it("distingue los diámetros medidos de la gota del flujo nominal", () => {
  const run = runsById.get("FLEX-C10H101")!;
  expect(sceneEvidenceForRun(run)).toMatchObject({
    kind: "droplet", initial_droplet_diameter_mm: 3.57, extinction_droplet_diameter_mm: 3.43,
    flow_cm_s: undefined, showArrows: false,
  });
  expect(sceneEvidenceForRun(runsById.get("FLEX-196F001")!)).toMatchObject({
    kind: "droplet", initial_droplet_diameter_mm: 3.39, extinction_droplet_diameter_mm: undefined,
  });
  expect(sceneEvidenceForRun({ ...run, initial_droplet_diameter_mm: undefined })).toBeNull();
});

it("representa pirólisis sin llama y distingue el flujo medido de cero del flujo desconocido", () => {
  const run = runsById.get("SAME-R-101")!;
  expect(sceneEvidenceForRun(run)).toMatchObject({
    kind: "aerosol", flow_cm_s: 0, showArrows: false, heating_duration_s: 60, aging_time_s: 29,
  });
  expect(sceneEvidenceForRun(runsById.get("SAME-1")!)).toMatchObject({
    kind: "aerosol", flow_cm_s: 5, showArrows: true, heating_duration_s: undefined, aging_time_s: 60,
  });
  expect(sceneEvidenceForRun({ ...run, nominal: { fields: ["flow_velocity_cm_s"], basis: "Referencia" } }))
    .toMatchObject({ flow_cm_s: undefined, showArrows: false });
});

it("excluye perfiles nominales e inferidos incluso cuando hay un montaje reconocido", () => {
  const run = runsById.get("FLEX-C10H101")!;
  expect(sceneEvidenceForRun({ ...run, reference: true })).toBeNull();
  expect(sceneEvidenceForRun({ ...run, psiProfile: {} })).toBeNull();
  expect(sceneEvidenceForRun(runsById.get("BRE-REF-QUIET")!)).toBeNull();
});

it("no dibuja llama sin evidencia de combustión reportada", () => {
  expect(sceneEvidenceForRun(runsById.get("SAFFIRE-VI-E5")!)).toMatchObject({ kind: "solid", flame: "unreported", twoFaces: false });
  expect(sceneEvidenceForRun(runsById.get("SAFFIRE-I-1")!)).toMatchObject({ flame: "attached" });
  expect(sceneEvidenceForRun(runsById.get("SAFFIRE-VI-E6")!)).toMatchObject({ flame: "attached", twoFaces: true });
});

it("incluye el CO₂ reportado de la gota", () => {
  expect(sceneEvidenceForRun(runsById.get("FLEX-C10H101")!)).toMatchObject({ kind: "droplet", co2_pct: 30 });
});

it("escala el largo de la flecha de flujo de forma monótona y con tope", () => {
  const [low, mid, high] = [2.2, 20, 47].map(flowArrowLength_px);
  expect(low).toBeLessThan(mid);
  expect(mid).toBeLessThan(high);
  expect(flowArrowLength_px(1e6)).toBe(flowArrowLength_px(1e9));
  expect(flowArrowLength_px(undefined)).toBe(flowArrowLength_px(0));
});

it("compara esquemas solo cuando ambos lados son del mismo tipo", () => {
  const get = (id: string) => runsById.get(id)!;
  expect(sceneComparison(get("SAFFIRE-V-E6"), get("SAFFIRE-VI-E6"))).toMatchObject({ sameKind: true });
  expect(sceneComparison(get("SAFFIRE-VI-E6"), get("FLEX-C10H101"))).toMatchObject({ sameKind: false });
  expect(sceneComparison(get("SAFFIRE-VI-E6"), get("BRE-REF-QUIET"))).toMatchObject({ b: null, sameKind: false });
});
