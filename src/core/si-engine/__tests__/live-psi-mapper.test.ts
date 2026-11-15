import { expect, it } from "vitest";
import bassII from "../../../../fixtures/psi/PSI-25.json";
import flex from "../../../../fixtures/psi/PSI-69.json";
import ground from "../../../../fixtures/psi/PSI-142.json";
import { missionPresets } from "../../../data/mission_presets";
import { parsePsiDetail } from "../../../lib/psi/psi-api";
import type { RawPsiInvestigation } from "../../../types/psi-live";
import { computeFSRS, rankRuns } from "../fsrs-ranker";
import { compareRuns } from "../git-diff";
import { buildKnowledgeGraph } from "../knowledge-graph";
import { buildPsiProfileRun, mapLivePsiToStudy } from "../live-psi-mapper";

it.each([
  [bassII, "MSG", "solids"],
  [flex, "CIR", "liquid-droplets"],
  [ground, "GROUND", "cold-flames"],
] as const)("mapea la ficha real $accession sin inventar atmósfera", (fixture, facility, topic) => {
  const record = parsePsiDetail(fixture);
  const study = mapLivePsiToStudy(record);
  expect(study).toMatchObject({ id: fixture.accession, facility, psi: { license: "CC0-1.0", doi: fixture.doi } });
  expect(study.topics).toContain(topic);
  expect(study.importedPsi).toMatchObject({ profile: null, fsrs: { status: "sin-datos-suficientes" } });
  expect(buildPsiProfileRun(study)).toBeUndefined();
});

const synthetic: RawPsiInvestigation = {
  accession: "PSI-9001", title: "Synthetic combustion example", acronym: "SYNTHETIC", projectType: null,
  researchArea: "Combustion Science", objective: null, approach: null, hypothesis: null, hardware: [],
  doi: null, license: null, publications: [], releaseDate: null,
  sourceUrl: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-9001",
};

it("synthetic: omite escenarios lunares cualitativos, porcentajes de material y velocidades de llama", () => {
  const study = mapLivePsiToStudy({
    ...synthetic, title: "Synthetic Fire Safety on the Lunar Surface",
    approach: "At lunar gravity, a 75% cotton fabric had a flame spread rate of 2 cm/s. Oxygen stayed below 22%.",
  });
  expect(study.facility).toBe("LUNAR");
  expect(study.topics).toContain("partial-gravity");
  expect(study.importedPsi?.profile).toBeNull();
  expect(buildPsiProfileRun(study)).toBeUndefined();
});

it("synthetic: conserva un intervalo, convierte kPa y comparte el perfil entre FSRS, grafo y A/B", () => {
  const study = mapLivePsiToStudy({
    ...synthetic, title: "Synthetic study of cool flames in ACME",
    hardware: ["Microgravity Science Glovebox"],
    approach: "Experiments used an oxygen concentration from 21–34 %. The chamber pressure was 101.325 kPa. Airflow ranged from 2 cm/s to 8 cm/s. Tests ran at 0.16g.",
  });
  expect(study.facility).toBe("MSG");
  expect(study.importedPsi?.profile).toMatchObject({
    oxygen_pct: { value: [21, 34], unit: "% O₂", source: "abstract-regex", confidence: "media" },
    flow_velocity_cm_s: { value: [2, 8], unit: "cm/s" },
    gravity_g: { value: 0.16, unit: "g" },
  });
  const run = buildPsiProfileRun(study)!;
  expect(run.atmosphere.pressure_psia).toBeCloseTo(14.696, 3);
  expect(run.atmosphere.oxygen_pct).toBeUndefined();
  expect(run.fuel).toBeUndefined();

  const studies = new Map([[study.id, study]]);
  const [preset] = missionPresets;
  const target = { ...preset.atmosphere, oxygen_pct: 28, flow_velocity_cm_s: 5 };
  expect(computeFSRS({ study, runs: [run] }, target).flow_pct).toBe(100);
  expect(rankRuns([run], studies, preset, target)[0].bounds).toEqual([]);
  const rows = compareRuns(run, { investigationId: study.id, atmosphere: {} }, studies);
  expect(rows.find(({ field }) => field.id === "oxygen_pct")).toMatchObject({ valueA: "21.0–34.0 % O₂", status: "missing" });
  expect(buildKnowledgeGraph([study], [run]).edges.map(({ target }) => target)).toContain("topic:cold-flames");
});
