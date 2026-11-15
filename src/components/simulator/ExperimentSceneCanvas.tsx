"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { ExperimentSceneEvidence } from "../../core/si-engine/experiment-scene";

function ContextMonitor({ onLost }: { onLost: () => void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    canvas.addEventListener("webglcontextlost", onLost);
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [canvas, onLost]);
  return null;
}

export default function ExperimentSceneCanvas({ evidence, alternate, fallback }: {
  evidence: ExperimentSceneEvidence;
  alternate: boolean;
  fallback: ReactNode;
}) {
  const [lost, setLost] = useState(false);
  const markContextLost = useCallback(() => setLost(true), []);
  // Las escalas siguientes pertenecen al dibujo. No representan dimensiones del aparato.
  const sheetHeight = evidence.thickness_mm === undefined ? 0.035 : Math.min(0.17, 0.025 + evidence.thickness_mm * 0.01);
  const sheetWidth = evidence.width_cm === undefined ? 0.9 : Math.min(1.3, 0.55 + evidence.width_cm * 0.02);
  const flowLength = Math.min(1.1, 0.2 + (evidence.flow_cm_s ?? 0) * 0.035);

  if (lost) return fallback;
  return <Canvas fallback={fallback} camera={{ position: [3.8, 2.9, 4.8], fov: 40 }}
    dpr={1} frameloop="demand" gl={{ antialias: true, powerPreference: "low-power" }}>
    <ContextMonitor onLost={markContextLost} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[1, 4, 3]} intensity={2} />
    <group rotation-y={alternate ? 1.2 : 0}>
      {[-0.66, 0.66].flatMap((y) => [-0.92, 0.92].map((z) =>
        <mesh key={`${y}:${z}`} position={[0, y, z]}>
          <boxGeometry args={[4.5, 0.025, 0.025]} />
          <meshStandardMaterial color="#5888a4" />
        </mesh>))}
      {[-2.23, 2.23].map((x) => <group key={x} position={[x, 0, 0]}>
        {[-0.92, 0.92].map((z) => <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[0.025, 1.32, 0.025]} />
          <meshStandardMaterial color="#5888a4" />
        </mesh>)}
        {[-0.66, 0.66].map((y) => <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.025, 0.025, 1.84]} />
          <meshStandardMaterial color="#5888a4" />
        </mesh>)}
      </group>)}
      <mesh position={[0.35, -0.22, 0]}>
        <boxGeometry args={[2.15, sheetHeight, sheetWidth]} />
        <meshStandardMaterial color="#bfd2e2" roughness={0.65} />
      </mesh>
      {evidence.showArrows && [-0.55, 0, 0.55].map((z) => <group key={z} position={[-1.9, 0.31, z]}>
        <mesh position-x={flowLength / 2}>
          <boxGeometry args={[flowLength, 0.018, 0.018]} />
          <meshBasicMaterial color="#88eff3" />
        </mesh>
        <mesh position-x={flowLength} rotation-z={-Math.PI / 2}>
          <coneGeometry args={[0.065, 0.15, 8]} />
          <meshBasicMaterial color="#88eff3" />
        </mesh>
      </group>)}
      {evidence.flame !== "none" && <mesh position={[-0.58, -0.11 + sheetHeight / 2, 0]}
        scale={evidence.flame === "rounded" ? [0.2, 0.13, 0.19] : [0.49, 0.14, 0.26]} rotation-z={0.19}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshBasicMaterial color={evidence.flame === "rounded" ? "#ffbd73" : "#ffad45"} transparent opacity={0.79} />
      </mesh>}
      {evidence.twoFaces && <mesh position={[-0.55, -0.34 - sheetHeight / 2, 0]} scale={[0.42, 0.08, 0.25]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshBasicMaterial color="#ff8c50" transparent opacity={0.72} />
      </mesh>}
    </group>
  </Canvas>;
}
