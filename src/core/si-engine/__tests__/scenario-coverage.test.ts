import { expect, it } from "vitest";
import { psiDataset, runsById } from "../../../data/psi";
import { missionPresets } from "../../../data/mission_presets";
import { computeCoverage } from "../scenario-coverage";

const run = runsById.get("BASS-II-GMT45-T4")!;
const scenario = { ...missionPresets[0].atmosphere, ...run.atmosphere };

it("identifica la cobertura directa de una corrida medida y muestra su procedencia", () => {
  const result = computeCoverage(scenario, psiDataset.runs);
  expect(result.status).toBe("directa");
  expect(result.withinTolerance).toBeGreaterThan(0);
  expect(result.closest).toMatchObject({ runId: run.id, source: run.source,
    gap: { oxygen_pp: 0, pressure_kpa: 0, flow_cm_s: 0, gravity: "Microgravedad" } });
});

it("distingue coincidencias parciales y escenarios extremos fuera del oxígeno observado", () => {
  expect(computeCoverage({ ...scenario, flow_velocity_cm_s: 100 }, [run]).status).toBe("parcial");
  expect(computeCoverage({ ...scenario, oxygen_pct: 100 }, psiDataset.runs).status).toBe("ninguna");
});

it("excluye perfiles y no utiliza los ejes nominales de una corrida documentada", () => {
  const result = computeCoverage(scenario, [
    { ...run, id: "ref", reference: true }, { ...run, id: "profile", psiProfile: {} },
    { ...run, nominal: { fields: ["pressure_psia"], basis: "Valor de referencia" } },
  ]);
  expect(result.withinTolerance).toBe(0);
  expect(result.candidates.map(({ runId }) => runId)).toEqual([run.id]);
  expect(result.closest?.gap.pressure_kpa).toBeNull();
});
