import { useEffect, useId, useState, type CSSProperties } from "react";
import { geometryKey, type ExperimentProfile } from "../../core/si-engine/experiment-profile";
import styles from "./ObservationChamber.module.css";

const numbers = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });
const readouts = [
  ["oxygen_pct", "Oxígeno", "%"],
  ["pressure_kpa", "Presión", "kPa"],
  ["gravity_g", "Gravedad", "g"],
  ["flow_cm_s", "Flujo", "cm/s"],
] as const;

export function ObservationChamber({ profile }: { profile: ExperimentProfile }) {
  const id = useId();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const update = () => setPaused(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const { oxygen_pct, gravity_g, flow_cm_s, flowDirection } = profile;
  const ready = readouts.every(([key]) => Number.isFinite(profile[key])) && (flow_cm_s === 0 || Boolean(flowDirection));
  const gravity = Math.min(1, Math.max(0, gravity_g ?? 0));
  const oxygen = Math.min(1, Math.max(0, ((oxygen_pct ?? 15) - 15) / 45));
  const flow = flowDirection === "sin flujo" ? 0 : Math.min(1, Math.max(0, (flow_cm_s ?? 0) / 30));
  const opposite = flowDirection === "opuesto";
  const geometry = geometryKey(profile.geometry ?? (profile.material?.trim().toLowerCase() === "pmma" ? "placa" : ""));
  const style = {
    "--width": .80 + oxygen * .68 - flow * (opposite ? .16 : -.44),
    "--height": .78 + oxygen * .62 + gravity * .74 - flow * (opposite ? .4 : .08),
    "--inclination": `${flow * (opposite ? -13 : 44)}deg`,
    "--intensity": .56 + oxygen * .44,
    "--halo": .38 + oxygen * .46,
  } as CSSProperties;

  return <figure className={styles.chamber} style={style} data-paused={paused}>
    <div className={styles.instrument}>
      <svg viewBox="0 0 440 226" className={styles.viewport} aria-hidden="true">
        <defs>
          <pattern id={`${id}-grid`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 H 0 V 16" fill="none" stroke="var(--trazo)" opacity=".58" />
          </pattern>
          <clipPath id={`${id}-port`}><circle cx="220" cy="111" r="99" /></clipPath>
          <radialGradient id={`${id}-wash`}>
            <stop stopColor="var(--panel)" /><stop offset="1" stopColor="var(--camara)" />
          </radialGradient>
          <radialGradient id={`${id}-halo`}>
            <stop stopColor="var(--llama)" stopOpacity=".48" /><stop offset="1" stopColor="var(--llama)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-flame`} cx=".50" cy=".72" r=".68">
            <stop stopColor="var(--nucleo)" /><stop offset=".35" stopColor="var(--llama)" />
            <stop offset="1" stopColor="var(--llama)" stopOpacity=".12" />
          </radialGradient>
          <linearGradient id={`${id}-sample`} x2="0" y2="1">
            <stop stopColor="var(--luz)" /><stop offset="1" stopColor="var(--trazo)" />
          </linearGradient>
        </defs>
        <circle cx="220" cy="111" r="107" fill="none" stroke="var(--trazo)" strokeDasharray="2 5.1" />
        <circle cx="220" cy="111" r="99" fill={`url(#${id}-wash)`} stroke="var(--trazo)" />
        <g clipPath={`url(#${id}-port)`}>
          <rect x="120" y="12" width="200" height="199" fill={`url(#${id}-grid)`} />
          <path d="M121 111H319 M220 12V210" stroke="var(--niebla)" opacity=".30" strokeDasharray="3 6" />
          {!ready ? <path d="M220 155C199 154 182 141 181 119C180 96 198 77 220 77C243 77 261 96 259 119C258 141 240 154 220 155Z"
            fill="none" stroke="var(--niebla)" strokeDasharray="3 5" />
            : <g className={styles.ignition}>
              <ellipse cx="222" cy="119" rx="99" ry="87" fill={`url(#${id}-halo)`} className={styles.halo} />
              <g className={styles.plume}>
                <path d="M220 156C194 157 174 137 176 112C177 89 198 74 220 67C240 78 262 90 264 112C266 136 246 157 220 156Z"
                  fill={`url(#${id}-flame)`} stroke="var(--llama)" strokeOpacity=".65" />
                <path d="M220 155C208 155 198 146 199 134C201 121 211 115 220 112C228 117 240 123 241 134C242 146 232 155 220 155Z"
                  fill="var(--nucleo)" opacity=".83" />
              </g>
              <path className={styles.spark} d="M220 136V157M209 146H231M213 140L227 153M227 140L213 153" stroke="var(--nucleo)" strokeWidth="1.5" />
            </g>}
          <path d="M172 170H268" stroke="var(--niebla)" opacity=".44" />
          {geometry === "gota" ? <><path d="M220 158V171" stroke="var(--niebla)" /><circle cx="220" cy="155" r="6" fill={`url(#${id}-sample)`} /></>
            : geometry === "lámina" ? <rect x="191" y="155" width="58" height="6" rx="1" fill={`url(#${id}-sample)`} />
              : <rect x="209" y="155" width="22" height="7" rx="2" fill={`url(#${id}-sample)`} />}
        </g>
        <path d="M107 111H131M309 111H333M220 3V18M220 204V219" stroke="var(--niebla)" opacity=".65" />
      </svg>
      <dl className={styles.readings}>
        {readouts.map(([key, label, unit]) => <div key={key}>
          <dt>{label}</dt><dd>{profile[key] === undefined ? "—" : numbers.format(profile[key])} <span>{unit}</span></dd>
        </div>)}
      </dl>
    </div>
    <figcaption>
      <span className={styles.state}><i aria-hidden />{ready ? "Perfil en observación" : "Cámara en reposo"}</span>
      <span>Visualización cualitativa de la geometría esperada. No es una simulación ni un dato de PSI.</span>
    </figcaption>
  </figure>;
}
