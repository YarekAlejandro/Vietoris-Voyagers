import { expect, it } from "vitest";
import { missionPresets } from "../../../data/mission_presets";
import { investigationsById, psiDataset, runsById } from "../../../data/psi";
import { buildEvidenceBundle, validateInterpretation } from "../evidence-bundle";

const profile = missionPresets[0];
const run = runsById.get("SAFFIRE-V-E6")!;
const comparison = [run.id, "SAFFIRE-VI-E6"] as const;
const bundle = buildEvidenceBundle({
  scenario: profile.atmosphere, profile, investigations: investigationsById,
  runs: [...psiDataset.runs, { ...run, id: "nominal", reference: true }],
  comparison, focusIds: ["nominal", "SAME-1"],
});

const valid = {
  summary: "En los ensayos se documentaron condiciones distintas.",
  claims: [{ text: "Se publicaron 26,5 % O₂ y 10,40 psia.", runIds: [run.id] }],
  limitations: ["Cambiaron varias condiciones a la vez: la diferencia no puede atribuirse a una sola variable."],
};

it("incluye cobertura, comparación y citas, sin perfiles ni ejes nominales", () => {
  expect(bundle.coverage.status).toBe("directa");
  expect(bundle.confounded).toBe(true);
  expect(bundle.evidence.map(({ runId }) => runId)).not.toContain("nominal");
  expect(bundle.evidence.find(({ runId }) => runId === "SAME-1")?.conditions.map(({ field }) => field)).not.toContain("oxygen_pct");
});

it("aprueba cifras con unidades y redondeo respaldados por la corrida citada", () => {
  expect(validateInterpretation(valid, bundle)).toEqual(valid);
});

it.each(["Se publicaron 62 % O₂.", "Se publicaron 26,5 kPa.", "Se publicaron 26,5.", "El oxígeno provocó el cambio.", "El escenario es seguro."])(
  "rechaza afirmaciones incompatibles con el paquete %s", (text) => {
    expect(validateInterpretation({ ...valid, claims: [{ text, runIds: [run.id] }] }, bundle)).toBeNull();
  },
);

it("rechaza una cita inexistente", () => {
  expect(validateInterpretation({ ...valid, claims: [{ ...valid.claims[0], runIds: ["inventada"] }] }, bundle)).toBeNull();
});

it("limita las citas de A/B a la pareja y deja interpretar las dimensiones documentadas", () => {
  expect(bundle.comparison?.rows.find(({ field }) => field === "CO₂ de cabina")).toMatchObject({
    a: { availability: "missing" }, b: { availability: "missing" },
  });
  const text = "El espesor pasó de 5 mm en A a 10 mm en B.";
  expect(validateInterpretation({ ...valid, claims: [{ text, runIds: [...comparison] }] }, bundle)).not.toBeNull();
  expect(validateInterpretation({ ...valid, claims: [{ text, runIds: [comparison[0]] }] }, bundle)).toBeNull();
  expect(validateInterpretation({ ...valid, claims: [{ text: "Se describe la muestra.", runIds: ["SAME-1"] }] }, bundle)).toBeNull();
});
