import { artemisSmokeNote, coolFlameNote, evidenceSources } from "../../data/evidence_context";
import type { ExperimentalRun, Investigation } from "../../types/psi";

export function SafetyTriadMatrix({ study, run }: { study: Investigation; run?: ExperimentalRun }) {
  const solid = study.topics.includes("solids");
  const smoke = study.topics.includes("smoke-detection");
  const droplets = study.topics.includes("liquid-droplets") || study.topics.includes("cold-flames");
  const bass = study.id === "BASS-II";
  const bre = study.id === "BRE";
  const saffire = study.id.startsWith("SAFFIRE");
  const rows = [
    {
      title: "Prevención",
      text: solid
        ? `Los ensayos de ${run?.fuel ?? (saffire ? "PMMA y SIBAL" : "muestras sólidas")} documentan el comportamiento de la muestra bajo el oxígeno, la presión y el flujo registrados.`
        : "La inflamabilidad depende del material y de la atmósfera. BASS-II ensayó sólidos con flujo controlado.",
      source: saffire ? evidenceSources.saffire : solid ? study.source : evidenceSources.bass,
    },
    {
      title: "Detección",
      text: smoke
        ? "SAME estudia la respuesta a partículas de humo. DAFT midió aerosoles de fondo con P-Trak, una referencia al investigar alarmas."
        : "SAME y DAFT aportan el contexto para distinguir partículas de humo de aerosoles de fondo al evaluar una alarma.",
      source: evidenceSources.smoke,
    },
    {
      title: "Supresión y extinción",
      text: droplets
        ? coolFlameNote
        : bass ? "BASS-II observó extinción a bajo flujo en algunas corridas. El resultado depende del material y de las condiciones."
          : bre ? "BRE observó llamas de etileno persistentes con aire quieto y oxígeno elevado."
            : "FLEX y CFI-G documentan combustión a baja temperatura tras la extinción visible.",
      source: bass ? evidenceSources.bass : bre ? study.source : evidenceSources.coolFlames,
    },
  ];

  return <section className="safety-triad" aria-labelledby="triad-title">
    <h4 id="triad-title">Síntesis SI · Impacto en los 3 Pilares NASA</h4>
    <dl>{rows.map(({ title, text, source }) => <div key={title}>
      <dt>{title}</dt><dd>{text} <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
        {title === "Detección" && smoke && <p>{artemisSmokeNote} <SourceLink source={evidenceSources.artemis} /></p>}
        {title === "Prevención" && solid && <p>La prueba terrestre Test 1 no captura el comportamiento de la propagación en baja gravedad, aunque sí identifica bien materiales muy inflamables. En gravedad lunar, el cambio de inflamabilidad depende del material. <SourceLink source={evidenceSources.lunarFlammability} /></p>}
        {title === "Prevención" && study.id === "SAFFIRE-VI" && <p>En Saffire VI, el aumento de temperatura y presión en la nave fue menos significativo que el aumento de CO₂ y CO. <SourceLink source={evidenceSources.saffireCabin} /></p>}
        {title === "Supresión y extinción" && study.id === "SAFFIRE-IV-V" && <>
          <p>En Saffire V-2 (tela delgada de algodón) la llama reapareció al restablecer el flujo. En Saffire IV-2 (PMMA grueso) la llama se recuperó tras reiniciar el flujo.</p>
          <p>En Saffire V-3 y V-4 se observó una extinción más rápida al apagar el ventilador tras un período a 5 cm/s. Los autores advierten riesgos al usar la reducción del flujo como estrategia por la incertidumbre de configuraciones y flujos reales. <SourceLink source={evidenceSources.saffireFlow} /></p>
        </>}
      </dd>
    </div>)}</dl>
  </section>;
}

function SourceLink({ source }: { source: { label: string; url: string } }) {
  return <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>;
}
