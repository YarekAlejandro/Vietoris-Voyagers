import { Background, Controls, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { ExternalLink, Network } from "lucide-react";
import { buildKnowledgeGraph } from "../../core/si-engine/knowledge-graph";
import { investigationsById, psiDataset } from "../../data/psi";
import { useAetherStore } from "../../store/useAetherStore";
import type { Facility } from "../../types/psi";

const graph = buildKnowledgeGraph(psiDataset.investigations);
const facilityRows = { MSG: 0, CYGNUS: 1 } as const;
const nodes: Node<{ label: string; facility: Facility }>[] = [
  ...graph.facilities.map(({ id }) => ({
    id, data: { label: id === "CYGNUS" ? "Cygnus" : id, facility: id },
    type: "input", sourcePosition: Position.Bottom, className: "facility-node",
    position: { x: facilityRows[id] * 255, y: 0 },
  })),
  ...graph.investigations.map((study, index) => ({
    id: study.id, data: { label: study.id, facility: study.facility },
    type: "output", targetPosition: Position.Top, className: "study-node",
    position: { x: index * 170, y: 120 },
  })),
];
const edges: Edge[] = graph.edges.map((edge) => ({ ...edge, type: "smoothstep", focusable: false }));

export function KnowledgeGraphCanvas() {
  const facility = useAetherStore((state) => state.facility);
  const investigationId = useAetherStore((state) => state.investigationId);
  const setFacility = useAetherStore((state) => state.setFacility);
  const selectInvestigation = useAetherStore((state) => state.selectInvestigation);
  const study = investigationId ? investigationsById.get(investigationId) : undefined;

  function selectNode(node: Node<{ label: string; facility: Facility }>) {
    const investigation = investigationsById.get(node.id);
    if (investigation) selectInvestigation(investigation);
    else setFacility(facility === node.data.facility ? "all" : node.data.facility);
  }

  return (
    <section className="panel nexus" aria-labelledby="nexus-title">
      <div className="panel-heading">
        <h2 id="nexus-title"><Network size={17} aria-hidden /> PSI-Nexus</h2>
        <span className="panel-meta">{graph.investigations.length} investigaciones</span>
      </div>
      <div className="graph">
        <ReactFlow
          nodes={nodes.map((node) => ({
            ...node,
            selected: node.id === (investigationId ?? facility),
            className: facility === "all" || facility === node.data.facility ? node.className : `${node.className} muted-node`,
          }))}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.22, maxZoom: 1.2 }}
          colorMode="dark"
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_event, node) => selectNode(node)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const element = (event.target as HTMLElement).closest<HTMLElement>("[data-id].react-flow__node");
            const node = nodes.find(({ id }) => id === element?.dataset.id);
            if (node) selectNode(node);
          }}
        >
          <Background gap={20} size={1.3} color="#33435a" />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="graph-caption" aria-live="polite">
        {study ? <>
          <strong>{study.name}</strong>
          <p>{study.summary}</p>
          <a href={study.source.url} target="_blank" rel="noreferrer">{study.source.label} <ExternalLink size={11} aria-hidden /></a>
        </> : <>
          <span><i className="facility-dot" /> Instalación</span>
          <span><i className="study-dot" /> Investigación</span>
          <span className="graph-hint">Selecciona un nodo para filtrar las corridas.</span>
        </>}
      </div>
    </section>
  );
}
