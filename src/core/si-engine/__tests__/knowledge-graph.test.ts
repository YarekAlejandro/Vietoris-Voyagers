import { expect, it } from "vitest";
import { psiDataset } from "../../../data/psi";
import { buildKnowledgeGraph } from "../knowledge-graph";

const { investigations, runs } = psiDataset;

it("vincula cada estudio con su instalación y mantiene el grafo cerrado", () => {
  const graph = buildKnowledgeGraph(investigations, runs);
  const nodeIds = new Set(graph.nodes.map(({ id }) => id));
  expect(nodeIds.size).toBe(graph.nodes.length);
  expect(graph.edges.every(({ source, target }) => nodeIds.has(source) && nodeIds.has(target))).toBe(true);
  expect(graph.edges.filter(({ relation }) => relation === "hosted")).toHaveLength(investigations.length);
  expect(graph.edges).toContainEqual(expect.objectContaining({
    source: "study:DAFT", target: "study:SAME", relation: "precursor",
  }));
  expect(graph.edges).toContainEqual(expect.objectContaining({
    source: "study:BRE", target: "topic:solids", relation: "studies-topic",
  }));
});

it("filtra por tema y conserva el vínculo documentado entre estudios pertinentes", () => {
  const graph = buildKnowledgeGraph(investigations, runs, { topic: "smoke-detection" });
  const studies = graph.nodes.filter(({ kind }) => kind === "study").map(({ entityId }) => entityId);
  expect(studies.sort()).toEqual(["DAFT", "SAME"]);
  expect(graph.nodes.filter(({ kind }) => kind === "topic").map(({ entityId }) => entityId)).toEqual(["smoke-detection"]);
  expect(graph.edges.filter(({ relation }) => relation === "precursor")).toHaveLength(1);
});

it("muestra únicamente corridas disponibles de la investigación seleccionada", () => {
  const availableRuns = runs.filter(({ id }) => id !== "SAFFIRE-VI-E5");
  const graph = buildKnowledgeGraph(investigations, availableRuns, { runStudy: "SAFFIRE-VI" });
  expect(graph.nodes.map(({ id }) => id)).toEqual([
    "facility:CYGNUS", "study:SAFFIRE-VI", "run:SAFFIRE-VI-E6", "run:SAFFIRE-VI-E8",
  ]);
  expect(graph.edges.filter(({ relation }) => relation === "recorded-in").every(({ source }) => source === "study:SAFFIRE-VI")).toBe(true);
});
