import { evidenceTopics, facilities } from "../../data/psi_vocabulary";
import type { EvidenceTopicId, ExperimentalRun, Facility, Investigation } from "../../types/psi";

export const studyBridges = [
  {
    source: "DAFT", target: "SAME", relation: "precursor",
    title: "DAFT → SAME",
    description: "DAFT verificó un contador de partículas para los estudios de humo de SAME.",
    citation: { label: "NASA NTRS · Particle and Smoke Detection on ISS", url: "https://ntrs.nasa.gov/citations/20070031686" },
  },
  {
    source: "FLEX", target: "CFI", relation: "shared-apparatus",
    title: "FLEX ↔ CFI",
    description: "Ambos utilizaron el Multi-user Droplet Combustion Apparatus (MDCA) en el CIR.",
    citation: { label: "NASA Glenn · Operaciones del CIR", url: "https://gipoc.grc.nasa.gov/wp/fcf-cir/mdca/cfi/" },
  },
] as const;

export type GraphNode =
  | { id: string; kind: "facility"; entityId: Facility; label: string }
  | { id: string; kind: "study"; entityId: string; label: string }
  | { id: string; kind: "topic"; entityId: EvidenceTopicId; label: string }
  | { id: string; kind: "run"; entityId: string; label: string };

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: "hosted" | "studies-topic" | "recorded-in" | (typeof studyBridges)[number]["relation"];
};

export function buildKnowledgeGraph(
  investigations: readonly Investigation[],
  runs: readonly ExperimentalRun[],
  options: { topic?: EvidenceTopicId; runStudy?: string } = {},
) {
  const { topic, runStudy } = options;
  const studies = investigations.filter((study) => (
    (!topic || study.topics.includes(topic)) && (!runStudy || study.id === runStudy)
  ));
  const facilityIds = [...new Set(studies.map((study) => study.facility))];
  const topicIds = runStudy || !studies.length ? [] : topic ? [topic] : [...new Set(studies.flatMap((study) => study.topics))];
  const visibleTopicIds = new Set(topicIds);
  const studyIds = new Set(studies.map(({ id }) => id));
  const visibleRuns = runStudy && studyIds.has(runStudy)
    ? runs.filter((run) => run.investigationId === runStudy)
    : [];
  const nodes: GraphNode[] = [
    ...facilityIds.map((id): GraphNode => ({ id: `facility:${id}`, kind: "facility", entityId: id, label: facilities[id].label })),
    ...studies.map(({ id }): GraphNode => ({ id: `study:${id}`, kind: "study", entityId: id, label: id })),
    ...topicIds.map((id): GraphNode => ({ id: `topic:${id}`, kind: "topic", entityId: id, label: evidenceTopics[id].label })),
    ...visibleRuns.map(({ id, label }): GraphNode => ({ id: `run:${id}`, kind: "run", entityId: id, label })),
  ];
  const edges: GraphEdge[] = [
    ...studies.map(({ id, facility }): GraphEdge => ({
      id: `hosted:${id}`, source: `facility:${facility}`, target: `study:${id}`, relation: "hosted",
    })),
    ...studies.flatMap(({ id, topics }) => topics.filter((item) => visibleTopicIds.has(item))
      .map((topic): GraphEdge => ({
        id: `topic:${id}:${topic}`, source: `study:${id}`, target: `topic:${topic}`, relation: "studies-topic",
      }))),
    ...studyBridges.filter(({ source, target }) => studyIds.has(source) && studyIds.has(target))
      .map(({ source, target, relation }): GraphEdge => ({
        id: `bridge:${source}:${target}`, source: `study:${source}`, target: `study:${target}`, relation,
      })),
    ...visibleRuns.map(({ id, investigationId }): GraphEdge => ({
      id: `run:${id}`, source: `study:${investigationId}`, target: `run:${id}`, relation: "recorded-in",
    })),
  ];

  return { nodes, edges };
}
