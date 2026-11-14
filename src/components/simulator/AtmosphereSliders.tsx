import { RotateCcw } from "lucide-react";
import { atmosphereControls } from "../../data/mission_presets";
import { evidenceSources } from "../../data/evidence_context";
import { oxygenPartialPressure_psia } from "../../core/si-engine/fsrs-ranker";
import { useAetherStore } from "../../store/useAetherStore";

export function AtmosphereSliders() {
  const profile = useAetherStore((state) => state.profile);
  const atmosphere = useAetherStore((state) => state.atmosphere);
  const mode = useAetherStore((state) => state.mode);
  const selectMission = useAetherStore((state) => state.selectMission);
  const updateAtmosphere = useAetherStore((state) => state.updateAtmosphere);
  const modified = atmosphereControls.some(({ field }) => atmosphere[field] !== profile.atmosphere[field]);

  return (
    <div className="panel-content sliders">
        <div className="profile-caption">
          <div>
            <strong>{profile.name}</strong>
            <span>{modified ? "Escenario editado" : "Escenario de referencia"}</span>
          </div>
          <button type="button" className="icon-button" aria-label="Restablecer atmósfera del perfil" title="Restablecer perfil" disabled={!modified} onClick={() => selectMission(profile)}>
            <RotateCcw size={15} aria-hidden />
          </button>
        </div>
        {atmosphereControls.map(({ field, label, unit, min, max, step, decimals }) => (
          <div className="slider-control" key={field}>
            <label htmlFor={field}>{label} <span className="readout">{atmosphere[field].toFixed(decimals)} <small>{unit}</small></span></label>
            <input id={field} type="range" min={min} max={max} step={step} value={atmosphere[field]}
              aria-valuetext={`${atmosphere[field]} ${unit}`}
              onChange={(event) => updateAtmosphere(field, event.target.valueAsNumber)} />
          </div>
        ))}
        <div className="partial-pressure">
          <span>{mode === "engineer" ? "Presión parcial de O₂" : "Presión que aporta el oxígeno"}</span>
          <strong className="mono">{oxygenPartialPressure_psia(atmosphere).toFixed(2)} psia</strong>
        </div>
        {profile.id === "artemis" && <p className="scenario-note">
          NASA evaluó la pre-respiración para el escenario de 8.2 psia y 34 % O₂.
          {" "}<a href="https://www.nasa.gov/ochmo/decompression-sickness-prebreathe-reference-library/" target="_blank" rel="noreferrer">Biblioteca de NASA</a>
        </p>}
        <section className="regime-diagnosis" aria-labelledby="regime-title">
          <h3 id="regime-title">Diagnóstico de régimen termodinámico</h3>
          {atmosphere.flow_velocity_cm_s >= 1 && atmosphere.flow_velocity_cm_s <= 10 && atmosphere.gravity_g < 0.4 &&
            <div className="regime-card" data-level="notice">
              <strong>Microventilación acoplada</strong>
              <p>Con gravedad baja, un flujo lento puede aportar oxígeno y favorecer la propagación en algunas configuraciones. <a href={evidenceSources.bass.url} target="_blank" rel="noreferrer">BASS-II</a></p>
            </div>}
          {atmosphere.oxygen_pct >= 30 && <div className="regime-card" data-level="alert">
            <strong>Atmósfera enriquecida en oxígeno</strong>
            <p>Desde 30 % O₂ conviene revisar los límites de inflamabilidad específicos del material y de la presión del ensayo. <a href={evidenceSources.saffire.url} target="_blank" rel="noreferrer">Saffire</a></p>
          </div>}
          <div className="regime-card" data-level="notice">
            <strong>Llamas frías</strong>
            <p>FLEX y CFI-G documentaron reacciones a baja temperatura tras la extinción visible. CFI sitúa el intervalo típico entre 700 y 850 K, según el combustible y la presión. <a href={evidenceSources.coolFlames.url} target="_blank" rel="noreferrer">FLEX y CFI-G</a> · <a href={evidenceSources.coolFlameTemperatures.url} target="_blank" rel="noreferrer">Intervalo CFI</a></p>
          </div>
          <div className="regime-card">
            <strong>Flotabilidad relativa a 1 g</strong>
            <p><span className="mono">{(100 * Math.sqrt(atmosphere.gravity_g)).toFixed(1)} %</span> de la velocidad de referencia al escalar con √(g/g₀). <a href={evidenceSources.efield.url} target="_blank" rel="noreferrer">E-FIELD y el viento iónico</a></p>
          </div>
        </section>
    </div>
  );
}
