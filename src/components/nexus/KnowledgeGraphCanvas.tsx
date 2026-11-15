import { useMemo, useState } from "react";
import { Background, BaseEdge, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type EdgeProps, type Node, type NodeProps, type NodeTypes, type XYPosition } from "@xyflow/react";
import { AudioLines, Boxes, FlaskConical, Network, Tag } from "lucide-react";
import { buildKnowledgeGraph, type GraphEdge, type GraphNode } from "../../core/si-engine/knowledge-graph";
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
  analogy: "Analogía experimental",
} satisfies Record<GraphEdge["relation"], string>;
const bridgeFilters = [
  { label: "Gas ↔ Sólido", title: "BRE · BASS-II · Saffire", studies: ["BRE", "BASS-II", "SAFFIRE-I", "SAFFIRE-IV-V", "SAFFIRE-VI"] },
  { label: "Humo ↔ Polvo", title: "SAME · SAME-R · DAFT", studies: ["SAME", "SAME-R", "DAFT"] },
  { label: "Gravedad parcial y alto O₂", title: "E-FIELD · CFI-G · FLEX", studies: ["E-FIELD", "CFI-G", "FLEX"] },
];
const isBridge = (relation: GraphEdge["relation"]) => relation === "precursor" || relation === "shared-apparatus" || relation === "analogy";

function BridgeEdge({ sourceX, sourceY, targetX, targetY, markerEnd, label }: EdgeProps) {
  const laneX = Math.max(sourceX, targetX) + 34;
  const path = `M ${sourceX} ${sourceY} C ${laneX} ${sourceY}, ${laneX} ${targetY}, ${targetX} ${targetY}`;
  return <BaseEdge path={path} markerEnd={markerEnd} label={label} labelX={laneX - 7} labelY={(sourceY + targetY) / 2}
    labelBgStyle={{ fill: "#0b0f19", fillOpacity: 0.92 }} />;
}
const edgeTypes = { bridge: BridgeEdge };
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
      {data.kind === "study" && <Handle id="bridge-in" className="bridge-in" type="target" position={Position.Right} isConnectable={false} />}
      <span className="graph-node-icon"><Icon size={15} aria-hidden /></span>
      <span className="graph-card-text"><strong title={data.label}>{data.label}</strong><small>{data.context}</small></span>
      {(data.kind === "facility" || data.kind === "study") && <Handle type="source" position={Position.Right} isConnectable={false} />}
      {data.kind === "study" && <Handle id="bridge-out" className="bridge-out" type="source" position={Position.Right} isConnectable={false} />}
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
  const clearFilters = useAetherStore((state) => state.clearFilters);
  const setQuery = useAetherStore((state) => state.setQuery);
  const [bridge, setBridge] = useState<string | null>(null);
  const [dragged, setDragged] = useState<Record<string, XYPosition>>({});
  const bridgeFilter = graphView === "relationships" && !searchActive && !topic && facility === "all"
    ? bridgeFilters.find(({ label }) => label === bridge) : undefined;
  const graphRuns = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs]);
  const currentStudyId = current?.kind === "run" ? graphRuns.get(current.id)?.investigationId : current?.id;
  const currentRunCount = runs.filter(({ investigationId }) => investigationId === currentStudyId).length;
  const showConditions = graphView === "conditions";
  const runStudy = graphView === "runs" && currentRunCount > 0 ? currentStudyId : undefined;
  const highlightedId = runStudy && current?.kind === "run" ? `run:${current.id}` : `study:${currentStudyId}`;

  const graph = useMemo(() => {
    const study = studies.find(({ id }) => id === currentStudyId);
    const related = bridgeFilter ? studies.filter(({ id }) => bridgeFilter.studies.includes(id))
      : graphView === "relationships" && study && !topic && !searchActive
      ? studies.filter((candidate) => candidate.id === study.id || candidate.topics.some((id) => study.topics.includes(id)))
      : studies;
    return buildKnowledgeGraph(related, runs, { topic: topic ?? undefined, runStudy });
  }, [studies, runs, currentStudyId, topic, runStudy, graphView, searchActive, bridgeFilter]);

  const { nodes, edges } = useMemo(() => {
    const layouts = ["facility", "study", runStudy ? "run" : "topic"] as const;
    const nodes: FlowEvidenceNode[] = layouts.flatMap((kind, column) => {
      const items = graph.nodes.filter((node) => node.kind === kind);
      return items.map((node, row): FlowEvidenceNode => {
        const highlighted = node.id === highlightedId;
        const context = node.kind === "run" ? graphRuns.get(node.entityId)?.fuel ?? "Perfil PSI"
          : node.kind === "study" && node.psiOrigin ? `${node.psiOrigin === "live" ? "LIVE PSI" : "Snapshot"} · ${node.entityId}`
            : kindLabels[node.kind];
        return {
          id: node.id, type: "evidence",
          position: dragged[node.id] ?? { x: column * 236, y: (row - (items.length - 1) / 2) * 67 },
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
      const bridge = isBridge(relation);
      const highlighted = [edge.source, edge.target].includes(highlightedId);
      return {
        ...edge,
        type: bridge ? "bridge" : "bezier",
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
  }, [graph, runStudy, highlightedId, facility, topic, dragged, graphRuns]);

  function selectNode({ data }: FlowEvidenceNode) {
    if (data.kind === "facility") setFacility(facility === data.entityId ? "all" : data.entityId);
    if (data.kind === "topic") setTopic(topic === data.entityId ? null : data.entityId);
    if (data.kind === "run") inspect({ kind: "run", id: data.entityId }, graphRuns.get(data.entityId)?.investigationId);
    if (data.kind === "study") inspect({ kind: "study", id: data.entityId });
  }

  return (
    <section className="panel nexus" aria-labelledby="nexus-title">
      <div className="panel-heading graph-heading">
        <h2 id="nexus-title"><Network size={17} aria-hidden /> PSI-Nexus</h2>
        <div className="segments" role="group" aria-label="Vista del grafo">
          <button type="button" aria-pressed={graphView === "relationships"} onClick={() => { setBridge(null); setGraphView("relationships"); }}>Relaciones</button>
          <button type="button" aria-pressed={graphView === "overview"} onClick={() => setGraphView("overview")}>General</button>
          <button type="button" aria-pressed={Boolean(runStudy)} disabled={currentRunCount === 0} onClick={() => setGraphView("runs")}>Corridas</button>
          <button type="button" aria-pressed={showConditions} disabled={runs.length === 0} onClick={() => setGraphView("conditions")}>Condiciones</button>
        </div>
      </div>
      {graphView === "relationships" && <div className="bridge-filters" role="group" aria-label="Puentes científicos">
        {bridgeFilters.map(({ label, title }) => <button type="button" key={label} title={title}
          aria-pressed={bridgeFilter?.label === label} onClick={() => {
            clearFilters();
            setQuery("");
            setDragged({});
            setBridge(bridgeFilter?.label === label ? null : label);
          }}>{label}</button>)}
      </div>}
      <div className="graph">
        {showConditions ? <ExperimentalCoveragePlot runs={runs} current={current} /> : nodes.length > 0 ? (
          <ReactFlow
            key={nodes.map(({ id }) => id).join("|")}
            nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            fitView fitViewOptions={fitOptions}
            colorMode="dark" minZoom={nodes.length > 35 ? 0.08 : 0.25} maxZoom={1.8}
            nodesDraggable nodesConnectable={false} edgesFocusable={false}
            onNodesChange={(changes) => {
              const moved = changes.flatMap((change) => change.type === "position" && change.position ? [[change.id, change.position] as const] : []);
              if (moved.length) setDragged((positions) => ({ ...positions, ...Object.fromEntries(moved) }));
            }}
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
        {graph.edges.some(({ relation }) => isBridge(relation)) &&
          <span><i className="bridge-line" /> Vínculo documentado</span>}
        {bridgeFilter?.label === "Humo ↔ Polvo" && <a href="https://www.youtube.com/watch?v=_43Ei9eQVww" target="_blank" rel="noreferrer">Alarma de Artemis II · NASA</a>}
        {topic && <span className="graph-context">{evidenceTopics[topic].label}</span>}
      </div>}
    </section>
  );
}
