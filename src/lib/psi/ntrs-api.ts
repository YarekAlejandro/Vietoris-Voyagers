import z from "next/dist/compiled/zod/index.cjs";
import { fetchNasaJson, logUnexpectedKeys } from "./psi-api";
import type { NtrsRecord } from "../../types/psi-live";

const string = z.string().nullish();
const recordSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string().min(1),
  abstract: string,
  distributionDate: string,
  disseminated: string,
  publications: z.array(z.object({ publicationDate: string }).passthrough()).nullish(),
}).passthrough();
const schema = z.object({
  results: z.array(recordSchema),
}).passthrough();
const knownRecordKeys = [
  "id", "title", "abstract", "distributionDate", "disseminated", "publications",
  "_meta", "copyright", "subjectCategories", "keywords", "exportControl", "otherReportNumbers",
  "fundingNumbers", "stiType", "distribution", "submittedDate", "authorAffiliations", "stiTypeDetails",
  "technicalReviewType", "modified", "legacyMeta", "created", "center", "onlyAbstract", "sensitiveInformation",
  "isLessonsLearned", "meetings", "status", "related", "downloads", "downloadsAvailable", "index",
  "notes", "parts", "sponsor", "supersedes", "stiTypeNotes", "series",
];

async function ntrsSearch(query: string, signal: AbortSignal, size: number) {
  const url = new URL("https://ntrs.nasa.gov/api/citations/search");
  url.search = new URLSearchParams({ q: query, "page.size": String(size) }).toString();
  const data = schema.parse(await fetchNasaJson(url, signal));
  logUnexpectedKeys("NTRS búsqueda", [data], ["results", "stats", "aggregations"]);
  logUnexpectedKeys("NTRS resultados", data.results, knownRecordKeys);
  return data.results.map((record): NtrsRecord => {
    const date = record.publications?.find((item) => item.publicationDate)?.publicationDate
      || record.distributionDate || record.disseminated;
    return {
      id: String(record.id),
      title: record.title.trim(),
      abstract: record.abstract?.trim().slice(0, 1200) || null,
      date: date?.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0] ?? null,
      url: `https://ntrs.nasa.gov/citations/${record.id}`,
    };
  });
}

const radarSearches = [
  { query: "Lunar Combustion Investigation LUCI", titles: /\blunar combustion investigation\b|\bLUCI\b/i },
  { query: "Flammability of Materials on the Moon FM2", titles: /\bflammability of materials on the moon\b|\bFM2\b/i },
  { query: "Saffire VI spacecraft fire safety results", titles: /\bsaffire[\s-]+(?:iv|vi|v)\b/i },
  { query: "Saffire IV V", titles: /\bsaffire[\s-]+(?:iv|vi|v)\b/i },
];

export async function fetchNtrsLiterature(term: string, signal: AbortSignal) {
  const main = ntrsSearch([term, "microgravity combustion"].filter(Boolean).join(" "), signal, 10);
  if (term) return main;
  const [generic, ...radar] = await Promise.allSettled([
    main,
    ...radarSearches.map(async ({ query, titles }) => (await ntrsSearch(query, signal, 8))
      .filter(({ title }) => titles.test(title))),
  ]);
  if (generic.status === "rejected") throw generic.reason;
  const records = [...radar.flatMap((group) => group.status === "fulfilled" ? group.value : []), ...generic.value];
  return [...new Map(records.map((record) => [record.id, record])).values()];
}
