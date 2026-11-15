import snapshotData from "../../../../../data/psi-snapshot.json";
import { fetchPsiTableProfile } from "../../../../lib/psi/experimental-tables";
import { fetchNtrsLiterature } from "../../../../lib/psi/ntrs-api";
import { fetchPsiDetail, fetchPsiIndex, getPsiApiConfig } from "../../../../lib/psi/psi-api";
import { filterPsiArea, isCombustion, latestPsiRecords, matchesPsiText, mergePsiDetail, psiAccessionQuery } from "../../../../lib/psi/records";
import type { PsiArea, PsiSearchResponse, PsiSnapshot, RawPsiInvestigation } from "../../../../types/psi-live";

const snapshot: PsiSnapshot = snapshotData;
const snapshotIndex = new Map(snapshot.investigations.map((record) => [record.accession, record]));
const cacheControl = "public, s-maxage=3600, stale-while-revalidate=86400";
const sourceTimeout_ms = 6000;

async function loadPsi(term: string, area: PsiArea, signal: AbortSignal) {
  const config = getPsiApiConfig();
  const accession = psiAccessionQuery(term);
  const records = filterPsiArea(latestPsiRecords(await fetchPsiIndex(config, term, signal)), area)
    .filter((record) => !accession || record.accession === accession);
  if (!term && !records.length) throw new Error("El listado de NASA PSI está vacío");
  const includeTables = process.env.ENABLE_PSI_TABLES === "true";
  const pending: { record: RawPsiInvestigation; index: number }[] = [];
  const results = records.map((record, index) => {
    const saved = snapshotIndex.get(record.accession);
    const matches = saved !== undefined && saved.releaseDate === record.releaseDate && saved.title === record.title;
    const withDetail = matches ? mergePsiDetail(record, saved) : record;
    if (isCombustion(record) && (!matches || (term && !saved?.license) || includeTables)) {
      pending.push({ record: withDetail, index });
    }
    return withDetail;
  });

  for (let offset = 0; offset < pending.length && !signal.aborted; offset += 4) {
    await Promise.all(pending.slice(offset, offset + 4).map(async ({ record, index }) => {
      try {
        const { investigation, tables } = await fetchPsiDetail(config, record.accession, signal, includeTables);
        const tableProfile = includeTables ? await fetchPsiTableProfile(config, record.accession, tables, signal) : undefined;
        results[index] = mergePsiDetail(record, { ...investigation, tableProfile });
      } catch {
        // La coincidencia del listado se puede usar aunque la ficha complementaria esté indisponible.
      }
    }));
  }
  return results;
}

function fallbackRecords(term: string, area: PsiArea) {
  const records = filterPsiArea(snapshot.investigations, area);
  const matches = term ? records.filter((record) => matchesPsiText(record, term)) : records;
  return matches.length ? matches : records;
}

function sourceStatus(result: PromiseSettledResult<readonly unknown[]>, ms: number): PsiSearchResponse["sources"]["psi"] {
  if (result.status === "fulfilled") return { ok: true, count: result.value.length, ms };
  const name = result.reason instanceof Error ? result.reason.name : "";
  const error = name === "TimeoutError" || name === "AbortError" ? "timeout"
    : name === "ZodError" || name === "SyntaxError" ? "invalid-response"
    : "unavailable";
  return { ok: false, count: 0, ms, error };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get("q") ?? "";
  const term = raw.trim();
  if ([...term].length > 80 || /\p{Cc}/u.test(raw)) {
    return Response.json({ error: "La búsqueda debe tener hasta 80 caracteres y omitir caracteres de control." }, { status: 400 });
  }

  const area: PsiArea = params.get("area") === "all" ? "all" : "combustion";
  const timings = { psi: 0, ntrs: 0 };
  async function timed<T>(source: keyof typeof timings, task: (signal: AbortSignal) => Promise<T>) {
    const start = performance.now();
    try {
      return await task(AbortSignal.timeout(sourceTimeout_ms));
    } finally {
      timings[source] = Math.round(performance.now() - start);
    }
  }

  const [psi, ntrs] = await Promise.allSettled([
    timed("psi", (signal) => loadPsi(term, area, signal)),
    timed("ntrs", (signal) => fetchNtrsLiterature(term, signal)),
  ]);
  const sources = { psi: sourceStatus(psi, timings.psi), ntrs: sourceStatus(ntrs, timings.ntrs) };
  if (!sources.psi.ok) console.warn("[NASA API] PSI:", sources.psi.error);
  if (!sources.ntrs.ok) console.warn("[NASA API] NTRS:", sources.ntrs.error);

  const response: PsiSearchResponse = {
    status: psi.status === "rejected" ? "snapshot" : ntrs.status === "rejected" ? "partial" : "live",
    sources,
    investigations: psi.status === "fulfilled" ? psi.value : fallbackRecords(term, area),
    literature: ntrs.status === "fulfilled" ? ntrs.value : [],
    fetchedAt: new Date().toISOString(),
    ...(psi.status === "rejected" ? { snapshotGeneratedAt: snapshot.generatedAt } : {}),
  };
  return Response.json(response, { headers: { "Cache-Control": cacheControl } });
}
