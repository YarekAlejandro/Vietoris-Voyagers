"use client";

import dynamic from "next/dynamic";
import { Box } from "lucide-react";
import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ExperimentSceneEvidence } from "../../core/si-engine/experiment-scene";

const ExperimentSceneCanvas = dynamic(() => import("./ExperimentSceneCanvas"), {
  ssr: false,
  loading: () => <p role="status" className="scene-loading">Cargando la escena 3D…</p>,
});

class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function SceneDiagram({ evidence }: { evidence: ExperimentSceneEvidence }) {
  const arrowEnd = 76 + Math.min(38, (evidence.flow_cm_s ?? 0) * 1.7);
  return <svg viewBox="0 0 320 174" className="scene-diagram" aria-hidden="true">
    <path d="M38 49 72 26h212l-34 23v91l34-23V26M38 49h212v91H38z" fill="#0d2237" stroke="#4d728d" strokeLinejoin="round" />
    <path d="m80 111 27-13h109l-26 13z" fill="#c5d3dc" />
    <path d="M80 111h110v5H80z" fill="#758da2" />
    {evidence.showArrows && [65, 84].map((y) => <path key={y} transform={`translate(0 ${y})`}
      d={`M58 0H${arrowEnd}m-7-6 7 6-7 6`} stroke="#78e8ed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
    {evidence.flame === "rounded" && <ellipse cx="129" cy="96" rx="15" ry="11" fill="#f3ac59" opacity=".68" />}
    {evidence.flame === "attached" && <path d="M111 102c5-10 3-18 17-21 8-1 20 0 29-7-6 13-20 27-46 28Z" fill="#ffb34a" />}
    {evidence.twoFaces && <path d="M112 117c11 7 22 13 42 9-8 9-25 11-42-9Z" fill="#eb8650" />}
  </svg>;
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
    <button type="button" className="quiet-button scene-toggle" aria-expanded={open} aria-controls={bodyId} onClick={toggleScene}>
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
          <span className="sr-only">Esquema de la muestra de {evidence.material} dentro de un conducto.</span>
          <figcaption id={captionId}>Representación ilustrativa de las condiciones del experimento; no es una predicción.</figcaption>
        </figure>
        <dl className="scene-readouts">
          <div><dt>Espesor</dt><dd>{evidence.thickness_mm !== undefined ? `${evidence.thickness_mm} mm` : "Sin dato"}</dd></div>
          <div><dt>Flujo</dt><dd>{evidence.flow_cm_s !== undefined ? `${evidence.flow_cm_s} cm/s` : "Sin medición"}</dd></div>
        </dl>
        {!smallScreen && <div className="scene-actions">
          <button className="quiet-button" type="button" onClick={() => setShow3D((value) => !value)}>{show3D ? "Ver en 2D" : "Ver en 3D"}</button>
          {show3D && <button className="quiet-button" type="button" onClick={() => setAlternate((value) => !value)}>Cambiar ángulo</button>}
        </div>}
      </>}
    </div>
  </section>;
}
