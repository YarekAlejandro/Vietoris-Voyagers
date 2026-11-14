import { describe, expect, it } from "vitest";
import { atmosphereControls } from "../../../data/mission_presets";
import { investigationsById, psiDataset, runsById } from "../../../data/psi";
import { facilities } from "../knowledge-graph";

const fuelCategories = ["SOLID_POLYMER", "SOLID_FABRIC", "AEROSOL_SMOKE_DUST", "LIQUID_DROPLET"];

describe("catálogo PSI", () => {
  it("usa ids únicos", () => {
    expect(investigationsById.size).toBe(psiDataset.investigations.length);
    expect(runsById.size).toBe(psiDataset.runs.length);
  });

  it("cita cada investigación y corrida, y usa instalaciones conocidas", () => {
    for (const study of psiDataset.investigations) {
      expect(Object.keys(facilities)).toContain(study.facility);
      expect(study.source.url).toMatch(/^https:\/\//);
    }
    for (const run of psiDataset.runs) {
      expect(investigationsById.has(run.investigationId)).toBe(true);
      expect(fuelCategories).toContain(run.fuelCategory);
      expect(run.source.url).toMatch(/^https:\/\//);
    }
  });

  it("mantiene cada atmósfera dentro del rango de los controles", () => {
    for (const run of psiDataset.runs) {
      for (const { field, min, max } of atmosphereControls) {
        expect(run.atmosphere[field], `${run.id}.${field}`).toBeGreaterThanOrEqual(min);
        expect(run.atmosphere[field], `${run.id}.${field}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it("explica cada valor nominal y solo lo usa en ejes de la atmósfera", () => {
    for (const run of psiDataset.runs.filter(({ nominal }) => nominal)) {
      expect(run.nominal!.basis.length).toBeGreaterThan(0);
      for (const axis of run.nominal!.fields) expect(Object.keys(run.atmosphere)).toContain(axis);
    }
  });

  it("convierte la presión de FLEX de mmHg a psia", () => {
    expect(runsById.get("FLEX-C10H101")!.atmosphere.pressure_psia).toBeCloseTo(534.2 * 14.6959488 / 760, 3);
  });
});
