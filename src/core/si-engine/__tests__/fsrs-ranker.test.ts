import { describe, expect, it } from "vitest";
import { missionPresets } from "../../../data/mission_presets";
import { investigationsById, psiDataset, runsById } from "../../../data/psi";
import { oxygenPartialPressure_psia, rankRuns } from "../fsrs-ranker";

const iss = missionPresets[0];
const saffireV = runsById.get("SAFFIRE-V-E6")!;
const saffireVI = runsById.get("SAFFIRE-VI-E6")!;

describe("FSRS", () => {
  it("calcula la presión parcial de oxígeno en psia", () => {
    expect(oxygenPartialPressure_psia(iss.atmosphere)).toBeCloseTo(3.087);
  });

  it("otorga 100 puntos a una corrida con coincidencia de atmósfera, material y pilar", () => {
    const [result] = rankRuns([saffireV], investigationsById, iss, saffireV.atmosphere);
    expect(result.score).toBe(100);
    expect(result.bounds).toEqual([]);
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
