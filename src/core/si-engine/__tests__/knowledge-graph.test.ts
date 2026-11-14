import { expect, it } from "vitest";
import { psiDataset } from "../../../data/psi";
import { buildKnowledgeGraph } from "../knowledge-graph";

it("vincula cada investigación con una instalación catalogada", () => {
  const graph = buildKnowledgeGraph(psiDataset.investigations);
  const facilities = new Set(graph.facilities.map(({ id }) => id));
  expect([...facilities].sort()).toEqual(["CIR", "CYGNUS", "MSG"]);
  expect(graph.edges).toHaveLength(psiDataset.investigations.length);
  expect(graph.edges.every(({ source, target }) => facilities.has(source) &&
    graph.investigations.some(({ id, facility }) => id === target && facility === source))).toBe(true);
});
