import { useMemo } from "react";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import { AudioLines, Boxes, FlaskConical, Network, Tag } from "lucide-react";
import { buildKnowledgeGraph, type GraphEdge, type GraphNode } from "../../core/si-engine/knowledge-graph";
import { runsById } from "../../data/psi";
import { evidenceTopics } from "../../data/psi_vocabulary";
import { useAetherStore, type EvidenceSelection } from "../../store/useAetherStore";
import type { ExperimentalRun, Investigation } from "../../types/psi";
import { ExperimentalCoveragePlot } from "../simulator/ExperimentalCoveragePlot";

type FlowEvidenceNode = Node<GraphNode & { context: string }, "evidence">;

const nodeIcons = { facility: Boxes, study: FlaskConical, topic: Tag, run: AudioLines };
const kindLabels = { facility: "Instalación", study: "Estudio", topic: "Tema", run: "Corrida" };
const relationLabels = {
  hosted: "Aloja",
  "studies-topic": "Estudia",
  "recorded-in": "Incluye corrida",
  precursor: "Estudio precursor",
  "shared-apparatus": "Equipo compartido",
} satisfies Record<GraphEdge["relation"], string>;
const fitOptions = { padding: 0.17, maxZoom: 1.15 };
const ariaLabels = {
  "controls.ariaLabel": "Controles del grafo",
  "controls.zoomIn.ariaLabel": "Acercar",
  "controls.zoomOut.ariaLabel": "Alejar",
  "controls.fitView.ariaLabel": "Ajustar a la vista",
};

function GraphCard({ data }: NodeProps<FlowEvidenceNode>) {
  const Icon = nodeIcons[data.kind];
  return (
    <div className="graph-card">
      {data.kind !== "facility" && <Handle type="target" position={Position.Left} isConnectable={false} />}
      {data.kind === "study" && <Handle id="bridge-in" type="target" position={Position.Top} isConnectable={false} />}
      <span className="graph-node-icon"><Icon size={15} aria-hidden /></span>
      <span className="graph-card-text"><strong>{data.label}</strong><small>{data.context}</small></span>
      {(data.kind === "facility" || data.kind === "study") && <Handle type="source" position={Position.Right} isConnectable={false} />}
      {data.kind === "study" && <Handle id="bridge-out" type="source" position={Position.Bottom} isConnectable={false} />}
    </div>
  );
}
const nodeTypes = { evidence: GraphCard } satisfies NodeTypes;

interface GraphProps {
  studies: readonly Investigation[];
  runs: readonly ExperimentalRun[];
  current: EvidenceSelection | null;
  searchActive: boolean;
}

export function KnowledgeGraphCanvas({ studies, runs, current, searchActive }: GraphProps) {
  const facility = useAetherStore((state) => state.facility);
  const topic = useAetherStore((state) => state.topic);
  const graphView = useAetherStore((state) => state.graphView);
  const setGraphView = useAetherStore((state) => state.setGraphView);
  const setFacility = useAetherStore((state) => state.setFacility);
  const setTopic = useAetherStore((state) => state.setTopic);
  const inspect = useAetherStore((state) => state.inspect);
  const currentStudyId = current?.kind === "run" ? runsById.get(current.id)?.investigationId : current?.id;
  const currentRunCount = runs.filter(({ investigationId }) => investigationId === currentStudyId).length;
  const showConditions = graphView === "conditions";
  const runStudy = graphView === "runs" && currentRunCount > 0 ? currentStudyId : undefined;
  const highlightedId = runStudy && current?.kind === "run" ? `run:${current.id}` : `study:${currentStudyId}`;

  const graph = useMemo(() => {
    const study = studies.find(({ id }) => id === currentStudyId);
    const related = graphView === "relationships" && study && !topic && !searchActive
      ? studies.filter((candidate) => candidate.topics.some((id) => study.topics.includes(id)))
      : studies;
    return buildKnowledgeGraph(related, runs, { topic: topic ?? undefined, runStudy });
  }, [studies, runs, currentStudyId, topic, runStudy, graphView, searchActive]);

  const { nodes, edges } = useMemo(() => {
    const layouts = ["facility", "study", runStudy ? "run" : "topic"] as const;
    const nodes: FlowEvidenceNode[] = layouts.flatMap((kind, column) => {
      const items = graph.nodes.filter((node) => node.kind === kind);
      return items.map((node, row): FlowEvidenceNode => {
        const highlighted = node.id === highlightedId;
        const context = node.kind === "run" ? runsById.get(node.entityId)?.fuel ?? "Corrida" : kindLabels[node.kind];
        return {
          id: node.id, type: "evidence",
          position: { x: column * 219, y: (row - (items.length - 1) / 2) * 67 },
          initialWidth: 167, initialHeight: 56,
          data: { ...node, context },
          className: `graph-node graph-node-${node.kind}${highlighted ? " graph-node-active" : ""}`,
          ariaLabel: `${kindLabels[node.kind]}: ${node.label}`,
          ariaRole: "button",
          domAttributes: { "aria-pressed": highlighted || node.id === `facility:${facility}` || node.id === `topic:${topic}` },
        };
      });
    });
    const edges: Edge[] = graph.edges.map(({ relation, ...edge }) => {
      const bridge = relation === "precursor" || relation === "shared-apparatus";
      const highlighted = [edge.source, edge.target].includes(highlightedId);
      return {
        ...edge,
        type: bridge ? "smoothstep" : "bezier",
        sourceHandle: bridge ? "bridge-out" : undefined,
        targetHandle: bridge ? "bridge-in" : undefined,
        markerEnd: relation === "precursor" ? { type: MarkerType.ArrowClosed, color: "#d7abf0" } : undefined,
        className: `${bridge ? "graph-bridge" : ""}${highlighted ? " graph-edge-active" : ""}`,
        ariaLabel: relationLabels[relation],
        label: bridge && graph.nodes.length <= 10 ? relationLabels[relation] : undefined,
        focusable: false,
        selectable: false,
        zIndex: highlighted || bridge ? 1 : 0,
      };
    });
    return { nodes, edges };
  }, [graph, runStudy, highlightedId, facility, topic]);

  function selectNode({ data }: FlowEvidenceNode) {
    if (data.kind === "facility") setFacility(facility === data.entityId ? "all" : data.entityId);
    if (data.kind === "topic") setTopic(topic === data.entityId ? null : data.entityId);
    if (data.kind === "run" || data.kind === "study") inspect({ kind: data.kind, id: data.entityId });
  }

  return (
    <section className="panel nexus" aria-labelledby="nexus-title">
      <div className="panel-heading graph-heading">
        <h2 id="nexus-title"><Network size={17} aria-hidden /> PSI-Nexus</h2>
        <div className="segments" role="group" aria-label="Vista del grafo">
          <button type="button" aria-pressed={graphView === "relationships"} onClick={() => setGraphView("relationships")}>Relaciones</button>
          <button type="button" aria-pressed={graphView === "overview"} onClick={() => setGraphView("overview")}>General</button>
          <button type="button" aria-pressed={Boolean(runStudy)} disabled={currentRunCount === 0} onClick={() => setGraphView("runs")}>Corridas</button>
          <button type="button" aria-pressed={showConditions} disabled={runs.length === 0} onClick={() => setGraphView("conditions")}>Condiciones</button>
        </div>
      </div>
      <div className="graph">
        {showConditions ? <ExperimentalCoveragePlot runs={runs} current={current} /> : nodes.length > 0 ? (
          <ReactFlow
            key={nodes.map(({ id }) => id).join("|")}
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            fitView fitViewOptions={fitOptions}
            colorMode="dark" minZoom={0.25} maxZoom={1.8}
            nodesDraggable={false} nodesConnectable={false} edgesFocusable={false}
            elementsSelectable={false} zoomOnScroll={false} panOnDrag
            defaultMarkerColor="#8097b5"
            onNodeClick={(_event, node) => selectNode(node)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              const element = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node[data-id]");
              const node = nodes.find(({ id }) => id === element?.dataset.id);
              if (!node) return;
              event.preventDefault();
              selectNode(node);
            }}
            ariaLabelConfig={ariaLabels}
          >
            <Background gap={20} size={1.5} color="#35445c" />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>
        ) : (
          <div className="empty-evidence empty-graph"><Network size={30} aria-hidden /><p>Las conexiones aparecerán aquí al encontrar evidencia.</p></div>
        )}
      </div>
      {showConditions ? <div className="graph-caption">
        <span><i className="study-dot" /> Corrida registrada</span>
        <span><i className="run-dot" /> Comparación A/B</span>
        <span><i className="facility-dot" /> Escenario de misión</span>
        <span className="graph-context">Cobertura experimental</span>
      </div> : <div className="graph-caption">
        <span><i className="facility-dot" /> Instalación</span>
        <span><i className="study-dot" /> Estudio</span>
        {runStudy ? <span><i className="run-dot" /> Corrida</span> : <span><i className="topic-dot" /> Tema</span>}
        {graph.edges.some(({ relation }) => relation === "precursor" || relation === "shared-apparatus") &&
          <span><i className="bridge-line" /> Vínculo documentado</span>}
        {topic && <span className="graph-context">{evidenceTopics[topic].label}</span>}
      </div>}
    </section>
  );
}
