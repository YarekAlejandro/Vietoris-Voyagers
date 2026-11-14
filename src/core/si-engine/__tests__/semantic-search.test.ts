import { expect, it } from "vitest";
import { psiDataset, runsById } from "../../../data/psi";
import { buildEvidenceIndex } from "../semantic-search";

const index = buildEvidenceIndex(psiDataset);

it("recupera las mismas fichas con sinónimos en español e inglés", () => {
  const spanish = index.search("Quiero estudios de oxidación a baja temperatura");
  const english = index.search("cool flames");
  expect([...spanish.studies.keys()].sort()).toEqual(["CFI", "CFI-G", "FLEX"]);
  expect([...english.studies.keys()].sort()).toEqual([...spanish.studies.keys()].sort());
  expect(spanish.runs.size).toBe(0);
  expect(spanish.studies.get("FLEX")?.reasons).toContain("Llamas frías");
});

it("exige a la vez material y contexto experimental", () => {
  const result = index.search("Acrilico a baja presion");
  expect([...result.runs.keys()]).toEqual(["SAFFIRE-V-E6", "SAFFIRE-VI-E6", "SAFFIRE-VI-E8"]);
  expect(result.concepts).toEqual(["PMMA", "Presión reducida"]);
  expect(result.studies.get("SAFFIRE-VI")?.reasons).toContain("Evidencia en una corrida");
});

it("mantiene resultados por corrida para fenómenos observados", () => {
  const result = index.search("¿Dónde se apaga la llama con poca ventilación?");
  expect([...result.runs.keys()]).toEqual(["BASS-II-GMT45-T4", "BASS-II-GMT100-T13", "BASS-II-GMT178-T14"]);
  expect(result.runs.has("BASS-II-GMT190-T21")).toBe(false);
});

it("permite buscar identificadores de varias investigaciones", () => {
  const results = index.search("SAME vs DAFT");
  expect([...results.studies.keys()].sort()).toEqual(["DAFT", "SAME"]);
  expect(index.search("event horizon").studies.size).toBe(0);
  expect(index.search("   ? ").active).toBe(false);
});

it("conserva consultas por códigos y evita propagar una coincidencia a otras corridas", () => {
  const result = index.search("GMT175-T10");
  expect([...result.studies.keys()]).toEqual(["BASS-II"]);
  expect([...result.runs.keys()]).toEqual(["BASS-II-GMT175-T10"]);
  expect(runsById.get("BASS-II-GMT175-T10")?.outcome).toBe("Sin ignición");
});
