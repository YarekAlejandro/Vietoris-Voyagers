import { evidenceTopics, facilities } from "../../data/psi_vocabulary";
import type { EvidenceTopicId, ExperimentalRun, Facility, Investigation } from "../../types/psi";

export const studyBridges = [
  {
    source: "BRE", target: "BASS-II", relation: "analogy",
    title: "BRE ↔ BASS-II",
    description: "BRE emula la combustión de materiales con un quemador de gas. BASS-II observa sólidos reales dentro de un ducto de flujo.",
    citation: { label: "NASA · Studying Combustion and Fire Safety", url: "https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/" },
  },
  {
    source: "SPICE", target: "SLICE", relation: "shared-apparatus",
    title: "SPICE ↔ SLICE",
    description: "SLICE utilizó hardware de SPICE para estudiar la estabilidad y la estructura de llamas con flujo coaxial.",
    citation: { label: "NASA NTRS · Gaseous Diffusion Flames (MSG)", url: "https://ntrs.nasa.gov/citations/20130000582" },
  },
  {
    source: "SPICE", target: "BASS-II", relation: "precursor",
    title: "SPICE → programa BASS",
    description: "BASS adaptó el hardware de flujo de SPICE. BASS-II continuó con ensayos en un ducto con ventilador dentro del MSG.",
    citation: { label: "NASA · Burning and Suppression of Solids", url: "https://www.nasa.gov/wp-content/uploads/2025/07/burning-and-suppression-of-solids-bass.pdf" },
  },
  {
    source: "FLEX", target: "CFI-G", relation: "analogy",
    title: "FLEX ↔ CFI-G",
    description: "Las llamas frías observadas en gotas en el CIR motivaron la investigación con combustibles gaseosos.",
    citation: { label: "NASA NTRS · ACME 2021, § 3.6", url: "https://ntrs.nasa.gov/citations/20210021781" },
  },
  {
    source: "DAFT", target: "SAME", relation: "precursor",
    title: "DAFT → SAME",
    description: "DAFT verificó un contador de partículas para los estudios de humo de SAME.",
    citation: { label: "NASA NTRS · Particle and Smoke Detection on ISS", url: "https://ntrs.nasa.gov/citations/20070031686" },
  },
  {
    source: "SAME", target: "SAME-R", relation: "precursor",
    title: "SAME → SAME-R",
    description: "SAME-R repitió y amplió SAME con otros materiales y condiciones de flujo.",
    citation: { label: "NASA PSI-101 · SAME-R", url: "https://doi.org/10.60555/2np7-jv14" },
  },
  {
    source: "FLEX", target: "FLEX-2", relation: "shared-apparatus",
    title: "FLEX ↔ FLEX-2",
    description: "Ambos estudios utilizaron el equipo MDCA del CIR para estudiar combustibles líquidos.",
    citation: { label: "NASA Glenn · Operaciones del CIR", url: "https://gipoc.grc.nasa.gov/wp/fcf-cir/mdca/cfi/" },
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
  | { id: string; kind: "study"; entityId: string; label: string; psiOrigin?: "live" | "snapshot" }
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
    ...studies.map(({ id, importedPsi }): GraphNode => ({
      id: `study:${id}`, kind: "study", entityId: id, label: importedPsi?.acronym ?? id, psiOrigin: importedPsi?.origin,
    })),
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
