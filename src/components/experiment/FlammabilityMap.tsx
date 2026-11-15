import type { ExperimentProfile } from "../../core/si-engine/experiment-profile";
import { recordedRunProfile, type ExperimentRecommendation } from "../../core/si-engine/experiment-retrieval";
import { runsById } from "../../data/psi";
import styles from "./ExperimentAssistant.module.css";

const numbers = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });
const xTicks = [0, 25, 50, 75, 100];
const yTicks = [0, 10, 20, 30, 40, 50];
const left = 53, right = 453, top = 16, bottom = 201;

export function measuredMapValues(item: ExperimentRecommendation) {
  const run = item.run && runsById.get(item.run.id);
  const recorded = run ? recordedRunProfile(run) : null;
  const read = (field: "oxygen_pct" | "flow_cm_s") => {
    const row = item.parameters.find((parameter) => parameter.field === field);
    return row ? (typeof row.recorded === "number" ? row.recorded : undefined) : recorded?.[field];
  };
  return { oxygen_pct: read("oxygen_pct"), flow_cm_s: read("flow_cm_s") };
}

function hasCoordinates(values: Pick<ExperimentProfile, "oxygen_pct" | "flow_cm_s">): values is { oxygen_pct: number; flow_cm_s: number } {
  return typeof values.oxygen_pct === "number" && Number.isFinite(values.oxygen_pct) &&
    typeof values.flow_cm_s === "number" && Number.isFinite(values.flow_cm_s);
}

interface MapProps {
  profile: ExperimentProfile;
  items: { item: ExperimentRecommendation; values: ReturnType<typeof measuredMapValues> }[];
  active: string | null;
  onHighlight: (accession: string | null) => void;
}

export function FlammabilityMap({ profile, items, active, onHighlight }: MapProps) {
  const plotted = items.flatMap(({ item, values }, index) =>
    hasCoordinates(values) ? [{ item, rank: index + 1, ...values }] : []);
  const hasProfile = hasCoordinates(profile);
  const maxFlow = Math.max(50, Math.ceil(Math.max(
    hasProfile ? profile.flow_cm_s : 0, ...plotted.map(({ flow_cm_s }) => flow_cm_s),
  ) / 50) * 50);
  const x = (oxygen_pct: number) => left + oxygen_pct / 100 * (right - left);
  const y = (flow_cm_s: number) => bottom - flow_cm_s / maxFlow * (bottom - top);
  const positions: [number, number][] = hasProfile ? [[x(profile.oxygen_pct), y(profile.flow_cm_s)]] : [];
  const offsets = [[0, 0], [0, -26], [25, 0], [-25, 0], [0, 26], [25, -26], [-25, -26], [25, 26], [-25, 26], [0, -51], [50, 0], [-50, 0], [0, 51], [50, -25], [-50, -25], [50, 25], [-50, 25]];

  return <figure className={styles.map} aria-labelledby="experiment-map-title">
    <figcaption id="experiment-map-title">
      <strong>Mapa de inflamabilidad</strong>
      <span>Condiciones registradas · sin zonas ni curvas inferidas</span>
    </figcaption>
    <svg viewBox="0 0 480 248" role="group" aria-label="Oxígeno frente a velocidad del flujo">
      {xTicks.map((tick) => <g key={tick} aria-hidden="true">
        <path className={styles.gridLine} d={`M${x(tick)} ${top}V${bottom}`} />
        <text className={styles.axisText} x={x(tick)} y={bottom + 19} textAnchor="middle">{tick}</text>
      </g>)}
      {yTicks.map((tick) => <g key={tick} aria-hidden="true">
        <path className={styles.gridLine} d={`M${left} ${y(tick * maxFlow / 50)}H${right}`} />
        <text className={styles.axisText} x={left - 9} y={y(tick * maxFlow / 50) + 4} textAnchor="end">{tick * maxFlow / 50}</text>
      </g>)}
      <path className={styles.plotAxis} d={`M${left} ${top}V${bottom}H${right}`} />
      <text className={styles.axisText} x={(left + right) / 2} y="243" textAnchor="middle">Oxígeno (%)</text>
      <text className={styles.axisText} x="16" y="108" textAnchor="middle" transform="rotate(-90 16 108)">Velocidad del flujo (cm/s)</text>
      {hasProfile && <g className={styles.profilePoint} transform={`translate(${x(profile.oxygen_pct)}, ${y(profile.flow_cm_s)})`}
        role="img" aria-label={`Tu perfil: ${numbers.format(profile.oxygen_pct)} % de oxígeno y ${numbers.format(profile.flow_cm_s)} cm/s`}>
        <path d="M0 -8L8 0L0 8L-8 0Z" />
      </g>}
      {plotted.map(({ item, rank, oxygen_pct, flow_cm_s }) => {
        const cx = x(oxygen_pct), cy = y(flow_cm_s);
        const candidates = offsets.map(([dx, dy]): [number, number] =>
          [Math.min(right + 7, Math.max(left, cx + dx)), Math.min(bottom + 2, Math.max(top, cy + dy))]);
        const [px, py] = candidates.find(([ax, ay]) => positions.every(([bx, by]) => Math.hypot(ax - bx, ay - by) >= 23)) ?? [cx, cy];
        positions.push([px, py]);
        return <a key={item.accession} href={`#experiment-result-${item.accession}`} className={styles.plotPoint}
          data-highlighted={active === item.accession}
          aria-label={`Resultado ${rank}, ${item.title}: ${numbers.format(oxygen_pct)} % de oxígeno y ${numbers.format(flow_cm_s)} cm/s`}
          onMouseEnter={() => onHighlight(item.accession)} onMouseLeave={() => onHighlight(null)}
          onFocus={() => onHighlight(item.accession)} onBlur={() => onHighlight(null)}>
          {(cx !== px || cy !== py) && <><path d={`M${cx} ${cy}L${px} ${py}`} /><circle cx={cx} cy={cy} r="2" /></>}
          <circle cx={px} cy={py} r="11" />
          <text x={px} y={py} textAnchor="middle" dominantBaseline="central" aria-hidden="true">{rank}</text>
        </a>;
      })}
    </svg>
    <div className={styles.mapLegend}>
      <span><i aria-hidden /> Tu perfil</span>
      {items.length > 0 && <span><i aria-hidden /> Corridas de PSI</span>}
    </div>
    {!hasProfile && <p>Completa el oxígeno y el flujo para ubicar tu perfil.</p>}
    {items.length > plotted.length && <p>El mapa omite los resultados sin una medición de oxígeno o de flujo.</p>}
  </figure>;
}
