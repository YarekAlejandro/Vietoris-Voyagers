import { describe, expect, it } from "vitest";
import { missionPresets } from "../../../data/mission_presets";
import { investigationsById, psiDataset, runsById } from "../../../data/psi";
import { computeFSRS, oxygenPartialPressure_psia, rankRuns } from "../fsrs-ranker";

const iss = missionPresets[0];

it("excluye del FSRS y las cotas las diferencias debidas a valores nominales", () => {
  const run = runsById.get("SAME-1")!;
  const editedNominal = { ...run, atmosphere: { ...run.atmosphere, oxygen_pct: 50, pressure_psia: 4.3 } };
  const [original] = rankRuns([run], investigationsById, iss, iss.atmosphere);
  const [edited] = rankRuns([editedNominal], investigationsById, iss, iss.atmosphere);
  expect(edited.score).toBe(original.score);
  expect(edited.bounds).toEqual(original.bounds);
  expect(edited.bounds.every(({ axis }) => axis !== "oxygen_pct" && axis !== "pressure_psia")).toBe(true);
});
const saffireV = runsById.get("SAFFIRE-V-E6")!;
const saffireVI = runsById.get("SAFFIRE-VI-E6")!;

describe("FSRS", () => {
  it("calcula la presión parcial de oxígeno en psia", () => {
    expect(oxygenPartialPressure_psia(iss.atmosphere)).toBeCloseTo(3.087);
  });

  it("acota al máximo el FSRS de una corrida coincidente con bonificación de presión", () => {
    const target = { ...iss.atmosphere, ...saffireV.atmosphere };
    const [result] = rankRuns([saffireV], investigationsById, iss, target);
    expect(result.score).toBe(100);
    expect(result.bonus_pts).toBe(10);
    expect(result.bounds).toEqual([]);
  });

  it("calcula cercanía al rango de un estudio y bonifica la evidencia pertinente", () => {
    const study = investigationsById.get("SAFFIRE-VI");
    const runs = [saffireVI, { ...saffireVI, atmosphere: { ...saffireVI.atmosphere, oxygen_pct: 34 } }];
    const atmosphere = { ...iss.atmosphere, ...saffireVI.atmosphere, oxygen_pct: 32 };
    expect(computeFSRS({ study, runs }, atmosphere)).toMatchObject({ atmosphere_pct: 100, bonus_pts: 25 });
  });

  it("aplica la bonificación de E-FIELD en gravedad parcial sin convertir el campo en gravedad experimental", () => {
    const study = investigationsById.get("E-FIELD");
    const run = runsById.get("E-FIELD-REF-PEAK")!;
    const target = { ...iss.atmosphere, gravity_g: 0.165 };
    expect(computeFSRS({ study, runs: [run] }, target)).toMatchObject({ atmosphere_pct: 0, bonus_pts: 22 });
    expect(computeFSRS({ study, runs: [run] }, { ...target, gravity_g: 0.401 }).bonus_pts).toBe(0);
    expect(rankRuns([run], investigationsById, iss, target)[0].bounds).toEqual([]);
  });

  it("marca los vecinos inferior y superior cuando el objetivo los separa", () => {
    const results = rankRuns([saffireV, saffireVI], investigationsById, iss, { ...iss.atmosphere, oxygen_pct: 29 });
    for (const { run, bounds } of results) {
      expect(bounds).toContainEqual({ axis: "oxygen_pct", side: run === saffireV ? "inferior" : "superior", outside: false });
    }
  });

  it("identifica el extremo medido que acota un objetivo fuera de rango", () => {
    const results = rankRuns([saffireV, saffireVI], investigationsById, iss, { ...iss.atmosphere, oxygen_pct: 100 });
    const oxygenBounds = results.flatMap(({ run, bounds }) => bounds.filter(({ axis }) => axis === "oxygen_pct").map((bound) => ({ run, ...bound })));
    expect(oxygenBounds).toEqual([{ run: saffireVI, axis: "oxygen_pct", side: "inferior", outside: true }]);
  });

  it("mantiene puntuaciones finitas y desempates deterministas para los cinco perfiles", () => {
    for (const preset of missionPresets) {
      const result = rankRuns(psiDataset.runs, investigationsById, preset, preset.atmosphere);
      expect(result).toEqual(rankRuns([...psiDataset.runs].reverse(), investigationsById, preset, preset.atmosphere));
      expect(result.every(({ score }) => Number.isFinite(score) && score >= 0 && score <= 100)).toBe(true);
    }
  });

  it("maneja un catálogo vacío", () => {
    expect(rankRuns([], investigationsById, iss, iss.atmosphere)).toEqual([]);
  });
});
