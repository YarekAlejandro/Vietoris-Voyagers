import type { PsiArea, RawPsiInvestigation } from "../../types/psi-live";

export function isCombustion(record: Pick<RawPsiInvestigation, "researchArea">) {
  return record.researchArea.toLowerCase() === "combustion science";
}

export function filterPsiArea(records: readonly RawPsiInvestigation[], area: PsiArea) {
  return area === "all" ? [...records] : records.filter(isCombustion);
}

export function mergePsiDetail(index: RawPsiInvestigation, detail: RawPsiInvestigation): RawPsiInvestigation {
  return {
    ...index,
    doi: detail.doi,
    license: detail.license,
    publications: detail.publications.length ? detail.publications : index.publications,
    version: detail.version,
    modifiedDate: detail.modifiedDate,
    hardware: index.hardware.length ? index.hardware : detail.hardware,
    tableProfile: detail.tableProfile,
  };
}

export function comparePsiVersions(a: RawPsiInvestigation, b: RawPsiInvestigation) {
  if (a.version !== undefined && b.version !== undefined && a.version !== b.version) return a.version - b.version;
  const release = (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "");
  if (release) return release;
  return (a.modifiedDate ?? "").localeCompare(b.modifiedDate ?? "");
}

export function latestPsiRecords(records: readonly RawPsiInvestigation[]) {
  const byAccession = new Map<string, RawPsiInvestigation>();
  for (const record of records) {
    const previous = byAccession.get(record.accession);
    if (!previous || comparePsiVersions(record, previous) >= 0) byAccession.set(record.accession, record);
  }
  return [...byAccession.values()];
}

export function psiAccessionQuery(term: string) {
  const number = term.match(/^PSI[- ](\d+)$/i)?.[1];
  return number ? `PSI-${number}` : undefined;
}

export function matchesPsiText(record: RawPsiInvestigation, term: string) {
  const accession = psiAccessionQuery(term);
  if (accession) return record.accession === accession;
  const words = (value: string) => value.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];
  const required = words(term);
  const fields = [record.accession, record.title, record.acronym, record.objective, record.approach,
    record.hypothesis, record.keywords, record.researchArea, ...record.hardware];
  const available = new Set(words(fields.join(" ")));
  return required.every((word) => available.has(word));
}
