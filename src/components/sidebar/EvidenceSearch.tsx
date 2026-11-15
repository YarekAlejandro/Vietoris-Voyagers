import { ArrowUpRight, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
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

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      const field = input.current;
      if (!field || getComputedStyle(field).visibility === "hidden") return;
      event.preventDefault();
      field.focus();
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <section className="explore-band" aria-labelledby="explore-title">
      <div className="explore-intro">
        <p className="explore-source">NASA PSI / NTRS</p>
        <h2 id="explore-title">Combustión en microgravedad</h2>
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
            aria-keyshortcuts="/"
            maxLength={80}
          />
          {query.length > 0 && <button type="button" aria-label="Borrar búsqueda" onClick={() => {
            setQuery("");
            input.current?.focus();
          }}><X size={17} aria-hidden /></button>}
          {!query && <kbd className="search-shortcut" aria-hidden="true">/</kbd>}
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
