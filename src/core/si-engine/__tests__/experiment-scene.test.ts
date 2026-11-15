import { expect, it } from "vitest";
import { runsById } from "../../../data/psi";
import { sceneEvidenceForRun } from "../experiment-scene";

it("usa el espesor y el flujo reportados y respeta la configuración en dos caras", () => {
  const run = runsById.get("SAFFIRE-VI-E6")!;
  expect(sceneEvidenceForRun(run)).toMatchObject({
    thickness_mm: run.thickness_mm, flow_cm_s: run.atmosphere.flow_velocity_cm_s, flame: "attached", twoFaces: true, showArrows: true,
  });
});

it("sigue el resultado descrito y omite la velocidad nominal", () => {
  const run = runsById.get("BASS-II-GMT45-T4")!;
  expect(sceneEvidenceForRun(run)?.flame).toBe("rounded");
  expect(sceneEvidenceForRun({ ...run, nominal: { fields: ["flow_velocity_cm_s"], basis: "Referencia" } }))
    .toMatchObject({ flow_cm_s: undefined, showArrows: false });
  expect(sceneEvidenceForRun(runsById.get("BASS-II-GMT175-T9")!)?.flame).toBe("none");
});

it("excluye perfiles de referencia y corridas de gotas", () => {
  const run = runsById.get("SAFFIRE-VI-E6")!;
  expect(sceneEvidenceForRun({ ...run, reference: true })).toBeNull();
  expect(sceneEvidenceForRun({ ...run, psiProfile: {} })).toBeNull();
  expect(sceneEvidenceForRun(runsById.get("FLEX-C10H101")!)).toBeNull();
});
