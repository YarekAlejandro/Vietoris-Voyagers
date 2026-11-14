import { useState } from "react";
import { useAetherStore, type EvidenceSelection } from "../../store/useAetherStore";
import type { Atmosphere, ExperimentalRun } from "../../types/psi";

const xPx = { start: 56, end: 556 };
const yPx = { top: 16, bottom: 229 };
const flowTicks_cm_s = [0, 10, 20, 30, 40, 50];
const oxygenTicks_pct = [15, 20, 25, 30, 35, 40, 50, 75, 100];

export function ExperimentalCoveragePlot({ runs, current }: {
  runs: readonly ExperimentalRun[];
  current: EvidenceSelection | null;
}) {
  const atmosphere = useAetherStore((state) => state.atmosphere);
  const comparison = useAetherStore((state) => state.comparison);
  const inspect = useAetherStore((state) => state.inspect);
  const [hovered, setHovered] = useState<string | null>(null);
  const oxygenMax_pct = Math.min(100, Math.ceil(Math.max(31, atmosphere.oxygen_pct, ...runs.map((run) => run.atmosphere.oxygen_pct)) / 5) * 5);
  const flowMax_cm_s = Math.ceil(Math.max(50, ...runs.map((run) => run.atmosphere.flow_velocity_cm_s)) / 10) * 10;
  const oxygenMin_pct = Math.min(15, ...runs.map((run) => run.atmosphere.oxygen_pct));
  const toX = (flow_cm_s: number) => xPx.start + flow_cm_s / flowMax_cm_s * (xPx.end - xPx.start);
  const toY = (oxygen_pct: number) => yPx.bottom - (oxygen_pct - oxygenMin_pct) / (oxygenMax_pct - oxygenMin_pct) * (yPx.bottom - yPx.top);
  const targetX_px = toX(atmosphere.flow_velocity_cm_s);
  const targetY_px = toY(atmosphere.oxygen_pct);
  const focused = runs.find(({ id }) => id === (hovered ?? (current?.kind === "run" ? current.id : undefined)));
  const visibleOxygenTicks = oxygenTicks_pct.filter((tick) => tick <= oxygenMax_pct && (oxygenMax_pct <= 50 || tick === 15 || tick >= 25 && tick % 25 === 0));

  const points = new Map<string, ExperimentalRun[]>();
  for (const run of runs) {
    const key = `${run.atmosphere.flow_velocity_cm_s}:${run.atmosphere.oxygen_pct}`;
    const group = points.get(key) ?? [];
    group.push(run);
    points.set(key, group);
  }

  function showValues(point: Atmosphere) {
    return `${point.flow_velocity_cm_s.toFixed(1)} cm/s · ${point.oxygen_pct.toFixed(1)}% O₂ · ${point.pressure_psia.toFixed(2)} psia`;
  }

  return (
    <div className="coverage-plot">
      <svg viewBox="0 0 578 265" role="group" aria-label="Oxígeno frente a flujo para las corridas visibles y el escenario de misión">
        <text x={12} y={15}>% O₂</text>
        {visibleOxygenTicks.map((tick) => (
          <g key={tick}>
            <path className="coverage-grid" d={`M${xPx.start} ${toY(tick)}H${xPx.end}`} />
            <text textAnchor="end" x={xPx.start - 10} y={toY(tick) + 4}>{tick}</text>
          </g>
        ))}
        {flowTicks_cm_s.map((tick) => (
          <g key={tick}>
            <path className="coverage-grid" d={`M${toX(tick)} ${yPx.top}V${yPx.bottom}`} />
            <text textAnchor="middle" x={toX(tick)} y={yPx.bottom + 16}>{tick}</text>
          </g>
        ))}
        <path className="coverage-axis" d={`M${xPx.start} ${yPx.top}V${yPx.bottom}H${xPx.end}`} />
        <text x={xPx.end} y={260} textAnchor="end">Flujo de referencia (cm/s)</text>
        {[...points.values()].map((group) => {
          const hit = group.find(({ id }) => id === focused?.id) ?? group[0];
          const x = toX(hit.atmosphere.flow_velocity_cm_s);
          const y = toY(hit.atmosphere.oxygen_pct);
          const isCompared = group.some(({ id }) => id === comparison.a || id === comparison.b);
          const isFocused = group.some(({ id }) => id === focused?.id);
          function selectNext() {
            const index = group.findIndex(({ id }) => current?.kind === "run" && current.id === id);
            const next = group[(index + 1) % group.length];
            setHovered(next.id);
            inspect({ kind: "run", id: next.id });
          }

          return <g key={hit.atmosphere.flow_velocity_cm_s + ":" + hit.atmosphere.oxygen_pct}
            role="button" tabIndex={0} className={`coverage-point${isFocused ? " coverage-point-active" : ""}`}
            aria-label={`${group.map(({ label }) => label).join(", ")}. ${showValues(hit.atmosphere)}`}
            aria-pressed={group.some(({ id }) => current?.kind === "run" && current.id === id)}
            onMouseEnter={() => setHovered(hit.id)} onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(hit.id)} onBlur={() => setHovered(null)}
            onClick={selectNext} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectNext(); }
            }}
          >
            <circle cx={x} cy={y} r={12} fill="transparent" />
            {isFocused && <circle cx={x} cy={y} r={11} className="coverage-halo" />}
            <circle cx={x} cy={y} r={isCompared ? 6 : 5} className={isCompared ? "coverage-compared" : "coverage-observed"} />
            {group.length > 1 && <text x={x + 10} y={y - 8}>{group.length}</text>}
          </g>;
        })}
        <g className="coverage-target" transform={`translate(${targetX_px} ${targetY_px})`} aria-hidden>
          <path d="M-9 0H9M0 -9V9" /><circle r={7} />
        </g>
      </svg>
      <div className="coverage-caption" aria-live="polite">
        {focused ? <><strong>{focused.label}</strong> <span>{showValues(focused.atmosphere)}</span></> :
          <><strong>Escenario de misión</strong> <span>{showValues(atmosphere)}</span></>}
      </div>
    </div>
  );
}
