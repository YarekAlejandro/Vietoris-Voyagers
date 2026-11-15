"use client";

import dynamic from "next/dynamic";
import { Box } from "lucide-react";
import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { dropletRadius_px, flowArrowLength_px, plateEdge_px, type ExperimentSceneEvidence } from "../../core/si-engine/experiment-scene";

const ExperimentSceneCanvas = dynamic(() => import("./ExperimentSceneCanvas"), {
  ssr: false,
  loading: () => <p role="status" className="scene-loading">Cargando la escena 3D…</p>,
});

class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const value = (v: number | undefined, unit: string) => v === undefined ? "sin dato" : `${v} ${unit}`;

export function sceneAriaLabel(evidence: ExperimentSceneEvidence) {
  const flow = evidence.flow_cm_s === undefined ? "flujo sin medición" : `flujo ${evidence.flow_cm_s} cm/s`;
  if (evidence.kind === "solid") {
    const flame = evidence.flame === "unreported" ? "resultado sin dato"
      : evidence.flame === "none" ? "sin llama" : evidence.flame === "rounded" ? "llama redondeada de bajo flujo"
        : evidence.twoFaces ? "llama en dos caras" : "llama en una cara";
    return `Esquema de ${evidence.material}: espesor ${value(evidence.thickness_mm, "mm")}, ancho ${value(evidence.width_cm, "cm")}, ${flow}, ${flame}.`;
  }
  if (evidence.kind === "droplet") {
    return `Esquema de gota de ${evidence.material}: diámetro inicial ${evidence.initial_droplet_diameter_mm} mm, diámetro de extinción ${value(evidence.extinction_droplet_diameter_mm, "mm")}, CO₂ ${value(evidence.co2_pct, "%")}.`;
  }
  return `Esquema de pirólisis sin llama de ${evidence.material}: calentamiento ${value(evidence.heating_duration_s, "s")}, envejecimiento ${value(evidence.aging_time_s, "s")}, ${flow}.`;
}

export function SceneDiagram({ evidence, referenceDiameter_mm }: { evidence: ExperimentSceneEvidence; referenceDiameter_mm?: number }) {
  return <svg viewBox="0 0 320 174" className="scene-diagram" role="img" aria-label={sceneAriaLabel(evidence)}>
    {evidence.kind === "solid" ? <SolidDiagram evidence={evidence} />
      : evidence.kind === "droplet" ? <DropletDiagram evidence={evidence} referenceDiameter_mm={referenceDiameter_mm} />
        : <AerosolDiagram evidence={evidence} />}
  </svg>;
}

function SolidDiagram({ evidence }: { evidence: Extract<ExperimentSceneEvidence, { kind: "solid" }> }) {
  const arrowEnd = 58 + flowArrowLength_px(evidence.flow_cm_s);
  const edge = plateEdge_px(evidence.thickness_mm);
  return <>
    <path d="M38 49 72 26h212l-34 23v91l34-23V26M38 49h212v91H38z" fill="#0d2237" stroke="#4d728d" strokeLinejoin="round" />
    <path d="m80 111 27-13h109l-26 13z" fill="#c5d3dc" />
    <path d={`M80 111h110v${edge}H80z`} fill="#758da2" />
    {evidence.thickness_mm !== undefined && <text x="194" y={111 + edge / 2} dominantBaseline="middle" fontSize="10" fill="#acbed4">{evidence.thickness_mm} mm</text>}
    {evidence.showArrows && [65, 84].map((y) => <path key={y} className="flow-arrow" transform={`translate(0 ${y})`}
      d={`M58 0H${arrowEnd}m-7-6 7 6-7 6`} stroke="#78e8ed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
    {evidence.flame === "rounded" && <ellipse cx="129" cy="96" rx="15" ry="11" fill="#f3ac59" opacity=".68" />}
    {evidence.flame === "attached" && <path d="M111 102c5-10 3-18 17-21 8-1 20 0 29-7-6 13-20 27-46 28Z" fill="#ffb34a" />}
    {evidence.twoFaces && <path transform={`translate(0 ${edge - 5})`} d="M112 117c11 7 22 13 42 9-8 9-25 11-42-9Z" fill="#eb8650" />}
  </>;
}

function DropletDiagram({ evidence, referenceDiameter_mm }: { evidence: Extract<ExperimentSceneEvidence, { kind: "droplet" }>; referenceDiameter_mm?: number }) {
  const initial_mm = evidence.initial_droplet_diameter_mm;
  const extinction_mm = evidence.extinction_droplet_diameter_mm;
  const reference_mm = Math.max(referenceDiameter_mm ?? 0, initial_mm, extinction_mm ?? 0);
  const initialRadius = dropletRadius_px(initial_mm, reference_mm);
  return <>
    <circle cx={extinction_mm === undefined ? 160 : 99} cy="84" r={initialRadius} fill="#50bccd" stroke="#a9f0fc" strokeWidth="2" />
    {extinction_mm !== undefined && <circle cx="221" cy="84" r={dropletRadius_px(extinction_mm, reference_mm)}
      fill="#24566f" stroke="#a9f0fc" strokeWidth="2" />}
  </>;
}

function AerosolDiagram({ evidence }: { evidence: Extract<ExperimentSceneEvidence, { kind: "aerosol" }> }) {
  const arrowLength = flowArrowLength_px(evidence.flow_cm_s);
  return <>
    <rect x="34" y="38" width="252" height="98" rx="12" fill="#0d2237" stroke="#63869e" />
    <rect x="61" y="105" width="61" height="10" rx="3" fill="#8098aa" />
    <rect x="70" y="93" width="43" height="12" rx="3" fill="#db9e6c" />
    <rect x="130" y="51" width="131" height="70" rx="9" fill="#142d42" stroke="#4d728d" />
    {[[150, 77], [166, 91], [185, 67], [185, 104], [207, 84], [228, 69], [238, 98]].map(([x, y]) =>
      <circle key={`${x}:${y}`} cx={x} cy={y} r="3" fill="#b9e0ec" />)}
    {evidence.showArrows && <path className="flow-arrow" d={`M51 70h${arrowLength}m-7-6 7 6-7 6`} stroke="#78e8ed" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" fill="none" />}
  </>;
}

export type SceneStatuses = Partial<Record<string, "equal" | "changed" | "missing" | "nominal">>;

function SceneReadout({ field, label, value, unit, statuses }: {
  field: string; label: string; value: number | undefined; unit: string; statuses?: SceneStatuses;
}) {
  return <div data-status={statuses?.[field]}><dt>{label}</dt><dd>{value === undefined ? "Sin dato" : `${value} ${unit}`}</dd></div>;
}

export function SceneReadouts({ evidence, statuses }: { evidence: ExperimentSceneEvidence; statuses?: SceneStatuses }) {
  return <dl className="scene-readouts">
    {evidence.kind === "solid" && <>
      <SceneReadout field="thickness_mm" label="Espesor" value={evidence.thickness_mm} unit="mm" statuses={statuses} />
      <SceneReadout field="width_cm" label="Ancho" value={evidence.width_cm} unit="cm" statuses={statuses} />
      {evidence.flame === "unreported" && <div><dt>Llama</dt><dd>Resultado sin dato</dd></div>}
    </>}
    {evidence.kind === "droplet" && <>
      <SceneReadout field="initial_droplet_diameter_mm" label="Diámetro inicial" value={evidence.initial_droplet_diameter_mm} unit="mm" statuses={statuses} />
      <SceneReadout field="extinction_droplet_diameter_mm" label="Diámetro al extinguirse la llama visible" value={evidence.extinction_droplet_diameter_mm} unit="mm" statuses={statuses} />
      <SceneReadout field="co2_pct" label="CO₂" value={evidence.co2_pct} unit="%" statuses={statuses} />
    </>}
    {evidence.kind === "aerosol" && <>
      <SceneReadout field="heating_duration_s" label="Calentamiento" value={evidence.heating_duration_s} unit="s" statuses={statuses} />
      <SceneReadout field="aging_time_s" label="Envejecimiento del aerosol" value={evidence.aging_time_s} unit="s" statuses={statuses} />
    </>}
    <div data-status={statuses?.flow_velocity_cm_s}><dt>Flujo</dt><dd>{evidence.flow_cm_s === undefined ? "Sin medición" : `${evidence.flow_cm_s} cm/s`}</dd></div>
  </dl>;
}

export function ExperimentScene({ evidence }: { evidence: ExperimentSceneEvidence }) {
  const [open, setOpen] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [smallScreen, setSmallScreen] = useState(false);
  const [alternate, setAlternate] = useState(false);
  const figure = useRef<HTMLElement>(null);
  const bodyId = useId();
  const captionId = useId();
  const diagram = <SceneDiagram evidence={evidence} />;
  const fallback = <>{diagram}<p className="scene-fallback">Vista 2D disponible. WebGL no está disponible en este navegador.</p></>;

  useEffect(() => {
    if (open) figure.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function toggleScene() {
    if (!open) {
      const compact = window.matchMedia("(max-width: 767px)").matches;
      setSmallScreen(compact);
      setShow3D(!compact);
    }
    setOpen(!open);
  }

  return <section className="experiment-scene">
    <button id="assistant-scene" type="button" className="quiet-button scene-toggle" aria-expanded={open} aria-controls={bodyId} onClick={toggleScene}>
      <Box size={15} aria-hidden="true" /> Escena del experimento
    </button>
    <div id={bodyId} hidden={!open}>
      {open && <>
        <figure ref={figure} aria-labelledby={captionId}>
          <div className="scene-viewport">
            {show3D ? <SceneErrorBoundary fallback={fallback}>
              <ExperimentSceneCanvas evidence={evidence} alternate={alternate} fallback={fallback} />
            </SceneErrorBoundary> : diagram}
          </div>
          <figcaption id={captionId}>
            <span className="sr-only">Muestra de {evidence.material}. </span>
            {evidence.kind === "solid" && <span className="sr-only">Lámina dentro de un conducto. </span>}
            {evidence.kind === "droplet" && <p>Gota aislada en el MDCA.{evidence.extinction_droplet_diameter_mm !== undefined && " Inicio a la izquierda y extinción de llama visible a la derecha."}</p>}
            {evidence.kind === "aerosol" && <p>Pirólisis sin llama. Las partículas se muestran como símbolos.</p>}
            Representación ilustrativa de las condiciones del experimento; no es una predicción.
          </figcaption>
        </figure>
        <SceneReadouts evidence={evidence} />
        {!smallScreen && <div className="scene-actions">
          <button className="quiet-button" type="button" onClick={() => setShow3D((value) => !value)}>{show3D ? "Ver en 2D" : "Ver en 3D"}</button>
          {show3D && <button className="quiet-button" type="button" onClick={() => setAlternate((value) => !value)}>Cambiar ángulo</button>}
        </div>}
      </>}
    </div>
  </section>;
}
