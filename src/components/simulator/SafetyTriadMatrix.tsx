import { evidenceSources } from "../../data/evidence_context";
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
        ? `Compara el comportamiento de ${run?.fuel ?? (saffire ? "PMMA y SIBAL" : "muestras sólidas")} con el oxígeno, la presión y el flujo de su ensayo.`
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
      title: "Supresión y riesgo post-extinción",
      text: droplets
        ? "En FLEX se ensayaron diluyentes como CO₂ y He. Algunas gotas siguieron reaccionando a baja temperatura tras apagarse la llama visible."
        : bass ? "BASS-II observó extinción a bajo flujo en algunas corridas. El resultado depende del material y de las condiciones."
          : bre ? "BRE observó llamas de etileno persistentes con aire quieto y oxígeno elevado."
            : "FLEX y CFI-G documentan combustión a baja temperatura tras la extinción visible.",
      source: droplets ? evidenceSources.flex : bass ? evidenceSources.bass : bre ? study.source : evidenceSources.coolFlames,
    },
  ];

  return <section className="safety-triad" aria-labelledby="triad-title">
    <h4 id="triad-title">Síntesis SI · Impacto en los 3 Pilares NASA</h4>
    <dl>{rows.map(({ title, text, source }) => <div key={title}>
      <dt>{title}</dt><dd>{text} <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
        {title === "Detección" && smoke && <> La tripulación de Artemis II relató una alarma de humo en vuelo. <a href={evidenceSources.artemis.url} target="_blank" rel="noreferrer">NASA · Artemis II</a></>}
      </dd>
    </div>)}</dl>
  </section>;
}
