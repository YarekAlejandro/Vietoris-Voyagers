import { mkdir, writeFile } from "node:fs/promises";

const base = new URL(process.env.PSI_API_BASE || "https://psi.nasa.gov/geode-py/ws");
if (base.origin !== "https://psi.nasa.gov" || base.username || base.password || base.search || base.hash) {
  throw new Error("PSI_API_BASE debe apuntar a https://psi.nasa.gov.");
}

const search = process.env.PSI_SEARCH_PATH || "/repo/search";
const candidates = process.argv.slice(2);
const paths = candidates.length ? candidates : [
  search, `${search}?search=combustion`, `${search}?q=combustion`,
  `${search}?term=combustion&size=2`, `${search}?size=2&from=1`, "/repo/investigations",
  "/repo/investigations/PSI-25", "/repo/investigations/PSI-69", "/repo/investigations/PSI-142",
];

// Conserva metadatos públicos de investigación, sin contactos, inventarios o URLs de archivos.
const investigationFields = [
  "accession", "title", "investigationAcronym", "projectType", "researchArea",
  "objective", "approach", "hypothesis", "experimentHardware", "doi",
  "licenseIdentifier", "licenseName", "releaseDate", "modifiedDate", "version", "public",
  "description", "subResearchArea",
];
const searchFields = [
  "Accession", "Public Release Date", "Title", "Keywords", "Acronym", "Flight Platform",
  "Research Area", "SubResearch Area", "Project Type", "Objectives", "Approach", "Hypothesis",
  "Experiment Hardware", "Publication Title",
];

function projectInvestigation(value) {
  if (!value || typeof value !== "object") return value;
  return {
    ...Object.fromEntries(investigationFields.filter((key) => key in value).map((key) => [key, value[key]])),
    ...(Array.isArray(value.publications) ? {
      publications: value.publications.map(({ title, doi, pubMedID }) => ({ title, doi, pubMedID })),
    } : {}),
    ...(Array.isArray(value.experimentalTable) ? {
      experimentalTable: value.experimentalTable.map(({ file_name, file_size, version, restricted, visible }) => (
        { file_name, file_size, version, restricted, visible }
      )),
    } : {}),
  };
}

async function probe(path) {
  if (!/^\/[\w/-]+(?:\?.*)?$/.test(path)) throw new Error("Usa una ruta relativa a PSI_API_BASE.");
  const url = new URL(base.pathname.replace(/\/$/, "") + path, base.origin);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "AETHER-SI/0.1 (NASA PSI catalog probe)" },
      redirect: "error", signal: AbortSignal.timeout(6000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    console.log(url.href, response.status, contentType);
    if (!response.ok || !contentType.includes("application/json")) return;
    const data = await response.json();
    console.log(url.pathname + url.search, "· Claves:", Object.keys(data).join(", "));
    if (Array.isArray(data.hits?.hits)) {
      const fields = data.hits.hits[0]?._source ?? {};
      const hits = data.hits.hits.slice(0, 3).map(({ _source }) => ({
        _source: Object.fromEntries(searchFields.filter((key) => key in _source).map((key) => [key, _source[key]])),
      }));
      console.log(url.search, "· Campos de _source:", Object.keys(fields).join(", "));
      console.log(url.search, "· Total:", data.hits.total, "| Registros:", data.hits.hits.length,
        "| Primeros:", hits.map(({ _source }) => _source.Accession).join(", "));
      console.log(url.search, "· Muestra:", JSON.stringify(hits.map(({ _source }) => _source)).slice(0, 440));
      if (url.searchParams.get("size") === "2" && data.hits.hits.length === 2 && !url.searchParams.has("from")) {
        await save(url.searchParams.get("term") === "combustion" ? "search.json" : "search-all.json", {
          timed_out: data.timed_out, _shards: data._shards,
          hits: { total: data.hits.total, hits },
        });
      }
    } else if (/^PSI-\d+$/.test(data.accession)) {
      console.log("Muestra:", JSON.stringify(projectInvestigation(data)).slice(0, 410));
      await save(`${data.accession}.json`, projectInvestigation(data));
    }
  } catch (error) {
    console.error(url.href, error.message);
  }
}

async function save(name, data) {
  const directory = new URL("../fixtures/psi/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(name, directory), JSON.stringify(data, null, 2) + "\n");
}

for (let offset = 0; offset < paths.length; offset += 4) {
  await Promise.all(paths.slice(offset, offset + 4).map(probe));
}
