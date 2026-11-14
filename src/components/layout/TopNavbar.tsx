import { Orbit, Radio, SlidersHorizontal } from "lucide-react";
import { missionPresets } from "../../data/mission_presets";
import { useAetherStore } from "../../store/useAetherStore";

export function TopNavbar() {
  const profile = useAetherStore((state) => state.profile);
  const mode = useAetherStore((state) => state.mode);
  const selectMission = useAetherStore((state) => state.selectMission);
  const setMode = useAetherStore((state) => state.setMode);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-icon"><Orbit size={25} aria-hidden /></span>
        <div>
          <h1>AETHER<span>-SI</span></h1>
          <p>Consola de misión</p>
        </div>
      </div>
      <label className="mission-select">
        <span><SlidersHorizontal size={14} aria-hidden /> Perfil de misión</span>
        <select value={profile.id} onChange={(event) => {
          const selected = missionPresets.find((preset) => preset.id === event.target.value);
          if (selected) selectMission(selected);
        }}>
          {missionPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
      </label>
      <div className="topbar-right">
        <div className="segments" role="group" aria-label="Modo de visualización">
          <button type="button" aria-pressed={mode === "engineer"} onClick={() => setMode("engineer")}>Ingeniería</button>
          <button type="button" aria-pressed={mode === "student"} onClick={() => setMode("student")}>Estudiante</button>
        </div>
        <span className="system-state"><Radio size={14} aria-hidden /> Motor local</span>
      </div>
    </header>
  );
}
