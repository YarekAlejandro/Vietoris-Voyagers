import z from "next/dist/compiled/zod/index.cjs";
import type { RawPsiInvestigation } from "../../types/psi-live";

const psiOrigin = "https://psi.nasa.gov";
const userAgent = "AETHER-SI/0.1 (NASA PSI metadata explorer)";
const accession = z.string().regex(/^PSI-\d+$/);
const text = z.string().nullish();
const nonnegativeInteger = z.number().int().nonnegative();
const pageSize = 200;

const hardwareSchema = z.object({ Name: text, Link: text }).passthrough();
const indexRecordSchema = z.object({
  Accession: accession,
  Title: z.string().min(1),
  Acronym: text,
  "Project Type": text,
  "Research Area": z.string().min(1),
  Objectives: text,
  Approach: text,
  Hypothesis: text,
  "Experiment Hardware": hardwareSchema.nullish(),
  "Publication Title": text,
  "Public Release Date": nonnegativeInteger.nullish(),
  Keywords: text,
  "Flight Platform": text,
}).passthrough();
const indexSchema = z.object({
  took: nonnegativeInteger.nullish(),
  timed_out: z.boolean(),
  _shards: z.object({
    total: nonnegativeInteger.nullish(),
    successful: nonnegativeInteger.nullish(),
    skipped: nonnegativeInteger.nullish(),
    failed: nonnegativeInteger,
  }).passthrough(),
  hits: z.object({
    total: nonnegativeInteger,
    max_score: z.number().nullish(),
    hits: z.array(z.object({ _source: indexRecordSchema }).passthrough()),
  }).passthrough(),
}).passthrough();

const publicationSchema = z.object({ title: text, doi: text }).passthrough();
const tableSchema = z.object({
  file_name: z.string(), file_size: nonnegativeInteger, version: nonnegativeInteger,
  visible: z.boolean(), restricted: z.boolean(),
}).passthrough();
const detailSchema = z.object({
  accession,
  title: z.string().min(1),
  investigationAcronym: text,
  projectType: text,
  researchArea: z.string().min(1),
  objective: text,
  approach: text,
  hypothesis: text,
  experimentHardware: text,
  doi: text,
  licenseIdentifier: text,
  licenseName: text,
  publications: z.array(publicationSchema).nullish(),
  releaseDate: text,
  modifiedDate: text,
  version: nonnegativeInteger.nullish(),
  public: z.boolean().nullish(),
  restricted: z.boolean().nullish(),
}).passthrough();

const indexKeys = [
  "Accession", "Title", "Acronym", "Project Type", "Research Area", "Objectives", "Approach", "Hypothesis",
  "Experiment Hardware", "Publication Title", "Public Release Date", "Keywords", "Flight Platform",
  "Thumbnail", "Person", "SubResearch Area", "Related Investigations", "Proposal Title", "Investigation Start Date",
  "Investigation End Date", "Sponsoring Agency", "Monitoring Center", "Funding Source",
  "Research Impacts/Earth Benefits", "Publication Author List", "Data Source Type",
];
const detailKeys = [
  "accession", "title", "investigationAcronym", "projectType", "researchArea", "objective", "approach",
  "hypothesis", "experimentHardware", "doi", "licenseIdentifier", "licenseName", "publications", "releaseDate",
  "modifiedDate", "version", "public", "restricted", "experimentalTable", "acknowledgments", "added", "assays",
  "contacts", "description", "dirty", "experimentHardwareLink", "experiments", "factors", "filesDisabled",
  "flightProgram", "funding", "identifiers", "images", "investigationEndDate", "investigationStartDate",
  "licenseLink", "managingNasaCenter", "missionEnd", "missionLink", "missionName", "missionStart", "modified",
  "organizations", "payloads", "projectIdentifier", "projectLink", "projectTitle", "proposalTitle", "related_glds",
  "removed", "researchImpacts", "sourceAccession", "sourceLink", "spaceProgram", "subResearchArea", "submissionDate",
  "totalFileSize", "versionMessage", "versionMessageLevel", "versionMessageLocations", "versionReason",
];

export function logUnexpectedKeys(scope: string, records: readonly Record<string, unknown>[], known: readonly string[]) {
  const extra = new Set(records.flatMap(Object.keys).filter((key) => !known.includes(key)));
  if (extra.size) console.warn(`[NASA API] ${scope}: claves adicionales ${JSON.stringify([...extra].sort().slice(0, 30))}`);
}

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

function dateOnly(input: number | string | null | undefined) {
  const ms = typeof input === "number" ? input : input ? Date.parse(input) : NaN;
  return Number.isFinite(ms) && Math.abs(ms) <= 8.64e15 ? new Date(ms).toISOString().split("T")[0] : null;
}

function doiValue(value: string | null | undefined) {
  const doi = clean(value)?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return doi && /^10\.\d{4,9}\/[\w.();:/+-]+$/i.test(doi) ? doi : null;
}

function sourceUrl(id: string) {
  return `${psiOrigin}/physci/repo/data/investigations/${id}`;
}

export interface PsiApiConfig {
  base: string;
  searchPath: string;
}

export function getPsiApiConfig(env: NodeJS.ProcessEnv = process.env): PsiApiConfig {
  const base = new URL(env.PSI_API_BASE?.trim() || `${psiOrigin}/geode-py/ws`);
  const searchPath = env.PSI_SEARCH_PATH?.trim() || "/repo/search";
  if (base.origin !== psiOrigin || base.username || base.password || base.search || base.hash ||
      !/^\/(?:[\w-]+\/)*[\w-]+\/?$/.test(base.pathname) ||
      !/^\/(?:[\w-]+\/)*[\w-]+$/.test(searchPath)) {
    throw new Error("Configuración de NASA PSI inválida");
  }
  return { base: base.href.replace(/\/$/, ""), searchPath };
}

export async function fetchNasaJson(url: URL, signal: AbortSignal, revalidate = true): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": userAgent },
    signal,
    redirect: "error",
    ...(revalidate ? { next: { revalidate: 3600 } } : { cache: "no-store" }),
  });
  if (!response.ok) throw new Error(`NASA HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new SyntaxError("Se esperaba JSON");
  }
  return response.json();
}

export function parsePsiSearchPage(value: unknown) {
  const page = indexSchema.parse(value);
  if (page.timed_out || page._shards.failed > 0) throw new Error("Búsqueda incompleta en NASA PSI");
  const records = page.hits.hits.map(({ _source }) => _source);
  logUnexpectedKeys("PSI listado", [page], ["took", "timed_out", "_shards", "hits"]);
  logUnexpectedKeys("PSI shards", [page._shards], ["total", "successful", "skipped", "failed"]);
  logUnexpectedKeys("PSI página", [page.hits], ["total", "max_score", "hits"]);
  logUnexpectedKeys("PSI hit", page.hits.hits, ["_index", "_type", "_id", "_score", "_source", "highlight", "sort"]);
  logUnexpectedKeys("PSI _source", records, indexKeys);
  logUnexpectedKeys("PSI hardware", records.flatMap((record) => record["Experiment Hardware"] ?? []), ["Name", "Link"]);
  const investigations = records.map((record): RawPsiInvestigation => ({
    accession: record.Accession,
    title: record.Title.trim(),
    acronym: clean(record.Acronym),
    projectType: clean(record["Project Type"]),
    researchArea: record["Research Area"].trim(),
    objective: clean(record.Objectives),
    approach: clean(record.Approach),
    hypothesis: clean(record.Hypothesis),
    hardware: (record["Experiment Hardware"]?.Name ?? "").split(/ {2,}/).map((name) => name.trim()).filter(Boolean),
    doi: null,
    license: null,
    publications: (record["Publication Title"] ?? "").split(/ {4,}/).map((title) => title.trim())
      .filter(Boolean).map((title) => ({ title, doi: null })),
    releaseDate: dateOnly(record["Public Release Date"] && record["Public Release Date"] * 1000),
    sourceUrl: sourceUrl(record.Accession),
    ...(clean(record.Keywords) ? { keywords: record.Keywords!.trim() } : {}),
    ...(clean(record["Flight Platform"]) ? { flightPlatform: record["Flight Platform"]!.trim() } : {}),
  }));
  return { total: page.hits.total, investigations };
}

export async function fetchPsiIndex(config: PsiApiConfig, term: string, signal: AbortSignal) {
  const investigations: RawPsiInvestigation[] = [];
  const url = new URL(config.base + config.searchPath);
  url.searchParams.set("size", String(pageSize));
  if (term) url.searchParams.set("term", term);
  let total = 0;
  do {
    if (investigations.length) url.searchParams.set("from", String(investigations.length));
    const page = parsePsiSearchPage(await fetchNasaJson(url, signal));
    total = page.total;
    if (total > 10_000 || (!page.investigations.length && investigations.length < total)) {
      throw new Error("Paginación incompleta en NASA PSI");
    }
    investigations.push(...page.investigations);
  } while (investigations.length < total);
  return investigations;
}

export type PsiTableMetadata = Pick<ReturnType<typeof tableSchema.parse>,
  "file_name" | "file_size" | "version" | "visible" | "restricted">;

export function parsePsiDetail(value: unknown) {
  const entry = detailSchema.parse(value);
  if (entry.public === false || entry.restricted === true) throw new Error("Ficha sin acceso público");
  logUnexpectedKeys("PSI ficha", [entry], detailKeys);
  logUnexpectedKeys("PSI publicaciones", entry.publications ?? [], ["title", "doi", "authorList", "comments", "pubMedID", "status"]);
  const modifiedDate = dateOnly(entry.modifiedDate);
  const investigation: RawPsiInvestigation = {
    accession: entry.accession,
    title: entry.title.trim(),
    acronym: clean(entry.investigationAcronym),
    projectType: clean(entry.projectType),
    researchArea: entry.researchArea.trim(),
    objective: clean(entry.objective),
    approach: clean(entry.approach),
    hypothesis: clean(entry.hypothesis),
    hardware: clean(entry.experimentHardware) ? [entry.experimentHardware!.trim()] : [],
    doi: doiValue(entry.doi),
    license: clean(entry.licenseIdentifier) ?? clean(entry.licenseName),
    publications: (entry.publications ?? []).flatMap((publication) => {
      const title = clean(publication.title);
      return title ? [{ title, doi: doiValue(publication.doi) }] : [];
    }),
    releaseDate: dateOnly(entry.releaseDate),
    sourceUrl: sourceUrl(entry.accession),
    ...(entry.version == null ? {} : { version: entry.version }),
    ...(modifiedDate ? { modifiedDate } : {}),
  };
  return investigation;
}

export async function fetchPsiDetail(config: PsiApiConfig, id: string, signal: AbortSignal, includeTables = false) {
  // Las fichas crudas pueden incluir inventarios que superan el límite de la caché de fetch.
  const record = await fetchNasaJson(new URL(`${config.base}/repo/investigations/${accession.parse(id)}`), signal, false);
  const investigation = parsePsiDetail(record);
  if (investigation.accession !== id) throw new Error("La accesión de NASA PSI no coincide");
  const tables: PsiTableMetadata[] = [];
  if (includeTables && record && typeof record === "object" && "experimentalTable" in record && Array.isArray(record.experimentalTable)) {
    for (const table of record.experimentalTable) {
      try {
        const { file_name, file_size, version, visible, restricted } = tableSchema.parse(table);
        tables.push({ file_name, file_size, version, visible, restricted });
      } catch {
        // La ficha sigue siendo válida si su tabla opcional no lo es.
      }
    }
  }
  return { investigation, tables };
}
