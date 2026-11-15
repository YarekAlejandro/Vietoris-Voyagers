import { ExternalLink } from "lucide-react";
import type { Investigation } from "../../types/psi";
import type { NtrsRecord } from "../../types/psi-live";

function ntrsTopic(title: string) {
  if (/\blunar combustion investigation\b|\bLUCI\b/i.test(title)) return "LUCI";
  if (/\bflammability of materials on the moon\b|\bFM2\b/i.test(title)) return "FM2";
  if (/\bsaffire[\s-]+(?:iv|vi|v)\b/i.test(title)) return "Saffire IV–VI";
}

function words(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function ntrsForStudy(study: Investigation, literature: readonly NtrsRecord[]) {
  const terms = (study.id === "SAFFIRE-IV-V" ? ["SAFFIRE-IV", "SAFFIRE-V"] : [study.importedPsi?.acronym ?? study.id])
    .map(words).filter((term) => term.length >= 3 && !/^psi \d+$/.test(term));
  const publications = new Set(study.psi?.publications.map(({ title }) => words(title)));
  return literature.filter(({ title, abstract }) => {
    const content = ` ${words(`${title} ${abstract ?? ""}`)} `;
    return publications.has(words(title)) || terms.some((term) => content.includes(` ${term} `));
  });
}

export function NtrsLink({ record }: { record: NtrsRecord }) {
  return <a className="source-link" href={record.url} target="_blank" rel="noreferrer">{record.title} <ExternalLink size={12} aria-hidden /></a>;
}

export function NtrsRadar({ literature }: { literature: readonly NtrsRecord[] }) {
  return <div className="panel-content inspector-content ntrs-radar">
    <p>Publicaciones de NASA Technical Reports Server.</p>
    {literature.length ? <ul>
      {literature.map((record) => <li key={record.id}>
        <div className="evidence-kind"><span className="ntrs-badge">NTRS</span><span>{ntrsTopic(record.title)}</span>
          {record.date && <time dateTime={record.date}>{record.date}</time>}
        </div>
        <NtrsLink record={record} />
        {record.abstract && <details><summary>Resumen</summary><p>{record.abstract}</p></details>}
      </li>)}
    </ul> : <p className="panel-meta">Sin publicaciones disponibles en esta consulta.</p>}
  </div>;
}
