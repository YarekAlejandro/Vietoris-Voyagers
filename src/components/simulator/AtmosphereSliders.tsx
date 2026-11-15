import { RotateCcw } from "lucide-react";
import { atmosphereControls } from "../../data/mission_presets";
import { coolFlameNote, evidenceSources } from "../../data/evidence_context";
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
          <h3 id="regime-title">Contexto de los ensayos</h3>
          <div className="regime-card">
            <strong>Llamas frías</strong>
            <p>{coolFlameNote} <a href={evidenceSources.coolFlames.url} target="_blank" rel="noreferrer">NASA · FLEX y CFI-G</a></p>
          </div>
        </section>
    </div>
  );
}
