import { expect, it } from "vitest";
import { investigationsById, psiDataset, runsById } from "../../../data/psi";
import { evidenceTopics } from "../../../data/psi_vocabulary";

it("mantiene identificadores únicos, relaciones válidas y fuentes para las corridas normalizadas", () => {
  expect(investigationsById.size).toBe(psiDataset.investigations.length);
  expect(runsById.size).toBe(psiDataset.runs.length);
  for (const run of psiDataset.runs) {
    const study = investigationsById.get(run.investigationId);
    expect(study, run.id).toBeDefined();
    expect(run.source.url).toMatch(/^https:\/\//);
    expect(run.topics?.every((topic) => Object.hasOwn(evidenceTopics, topic)) ?? true).toBe(true);
    if (run.nominal) {
      expect(run.nominal.basis.length).toBeGreaterThan(0);
      expect(run.nominal.fields.every((field) => Number.isFinite(run.atmosphere[field]))).toBe(true);
    }
  }
  expect(runsById.get("FLEX-C10H101")?.atmosphere.pressure_psia).toBeCloseTo(534.2 * 14.6959488 / 760, 3);
});
