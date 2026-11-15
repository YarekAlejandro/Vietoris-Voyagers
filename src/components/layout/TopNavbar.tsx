import { ExternalLink, Orbit, Radio, RefreshCw, SlidersHorizontal } from "lucide-react";
import { missionPresets } from "../../data/mission_presets";
import { useAetherStore } from "../../store/useAetherStore";

export function TopNavbar({ sync }: { sync: { pending: boolean; offline: boolean; refresh: () => void } }) {
  const profile = useAetherStore((state) => state.profile);
  const mode = useAetherStore((state) => state.mode);
  const selectMission = useAetherStore((state) => state.selectMission);
  const setMode = useAetherStore((state) => state.setMode);
  const setInspectorView = useAetherStore((state) => state.setInspectorView);
  const atmosphere = useAetherStore((state) => state.atmosphere);
  const area = useAetherStore((state) => state.psiArea);
  const baseline = useAetherStore((state) => state.psiCatalog);
  const catalog = baseline?.area === area ? baseline : null;
  const status = sync.offline && catalog?.status !== "snapshot" ? "local" : catalog?.status ?? "local";
  const timestamp = status === "snapshot" ? catalog?.snapshotGeneratedAt : catalog?.fetchedAt;
  const label = status === "live" ? `NASA PSI Live · ${catalog?.count} estudios` : status === "partial" ? "Parcial"
    : status === "snapshot" ? "Snapshot" : "Motor local";
  const date = timestamp ? new Intl.DateTimeFormat("es-MX", status === "snapshot" ? { dateStyle: "short", timeZone: "UTC" }
    : { dateStyle: "short", timeStyle: "short" }).format(new Date(timestamp)) : null;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-icon"><Orbit size={25} aria-hidden /></span>
        <div>
          <h1>AETHER<span>-SI</span></h1>
          <p>Explorador de evidencia</p>
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
      <button type="button" className="mission-readouts" onClick={() => {
        setInspectorView("atmosphere");
        document.getElementById("assistant-atmosphere")?.focus();
      }} title="Editar atmósfera">
        <span className="sr-only">Editar atmósfera. Valores actuales:</span>
        <span><small>O₂</small><b>{atmosphere.oxygen_pct.toFixed(1)} <span>%</span></b></span>
        <span><small>Presión</small><b>{atmosphere.pressure_psia.toFixed(2)} <span>psia</span></b></span>
        <span><small>Flujo</small><b>{atmosphere.flow_velocity_cm_s.toFixed(1)} <span>cm/s</span></b></span>
        <span><small>Gravedad</small><b>{atmosphere.gravity_g.toFixed(3)} <span>g</span></b></span>
      </button>
      <div className="topbar-right">
        <div className="segments" role="group" aria-label="Modo de visualización">
          <button type="button" aria-pressed={mode === "engineer"} onClick={() => setMode("engineer")}>Ingeniería</button>
          <button type="button" aria-pressed={mode === "student"} onClick={() => setMode("student")}>Estudiante</button>
        </div>
        <div className="psi-sync">
          <span className="system-state" data-status={status} role="status" aria-live="polite">
            <Radio size={14} aria-hidden />
            <span>{label}{status === "snapshot" && date ? ` · ${date}` : ""}</span>
            {status !== "snapshot" && date && <time dateTime={timestamp}>{date}</time>}
          </span>
          <button type="button" className="icon-button" onClick={sync.refresh} disabled={sync.pending}
            aria-label="Actualizar catálogo NASA PSI" title="Actualizar catálogo NASA PSI">
            <RefreshCw size={14} className={sync.pending ? "spinning" : undefined} aria-hidden />
          </button>
          <a className="icon-button" href="https://psi.nasa.gov/physci/repo/search" target="_blank" rel="noreferrer"
            aria-label="Abrir el catálogo oficial de NASA PSI" title="Abrir el catálogo oficial de NASA PSI"><ExternalLink size={14} aria-hidden /></a>
        </div>
      </div>
    </header>
  );
}
