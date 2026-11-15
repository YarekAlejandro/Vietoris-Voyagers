import { ArrowUpRight, Search, X } from "lucide-react";
import { useRef } from "react";
import type { EvidenceSearchResults } from "../../core/si-engine/semantic-search";
import { useAetherStore } from "../../store/useAetherStore";

const examples = [
  { label: "Humo y polvo", query: "detección de humo" },
  { label: "Llamas frías", query: "llamas frías" },
  { label: "Acrílico a baja presión", query: "acrílico a baja presión" },
];

export function EvidenceSearch({ search }: { search: EvidenceSearchResults }) {
  const query = useAetherStore((state) => state.query);
  const setQuery = useAetherStore((state) => state.setQuery);
  const clearFilters = useAetherStore((state) => state.clearFilters);
  const input = useRef<HTMLInputElement>(null);

  return (
    <section className="explore-band" aria-labelledby="explore-title">
      <div className="explore-intro">
        <p className="explore-source"><span aria-hidden /> NASA PSI / NTRS</p>
        <h2 id="explore-title">Incendios en microgravedad</h2>
      </div>
      <form role="search" className="evidence-search" onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor="evidence-query">Búsqueda semántica</label>
        <div className="search-box">
          <Search size={19} aria-hidden />
          <input
            id="evidence-query"
            ref={input}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por concepto, material o estudio…"
            title="Búsqueda por conceptos en español e inglés"
            aria-describedby="search-help"
            maxLength={80}
          />
          {query.length > 0 && <button type="button" aria-label="Borrar búsqueda" onClick={() => {
            setQuery("");
            input.current?.focus();
          }}><X size={17} aria-hidden /></button>}
        </div>
        <span className="sr-only" id="search-help">{search.concepts.join(", ") || "Busca en español o inglés."}</span>
        <div className="search-examples">
          {examples.map(({ label, query: example }) => (
            <button type="button" key={label} aria-pressed={query === example} onClick={() => { clearFilters(); setQuery(example, true); }}>
              {label} <ArrowUpRight size={11} aria-hidden />
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
