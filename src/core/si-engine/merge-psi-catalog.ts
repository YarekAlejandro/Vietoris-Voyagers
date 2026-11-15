import { comparePsiVersions } from "../../lib/psi/records";
import type { PsiDataset } from "../../types/psi";
import type { PsiSearchResponse, RawPsiInvestigation } from "../../types/psi-live";
import { buildPsiProfileRun, mapLivePsiToStudy, psiIdentity } from "./live-psi-mapper";

const verifiedAccessions: Readonly<Record<string, string>> = {
  "ACME FLAME DESIGN": "PSI-10", "E-FIELD": "PSI-22", "BASS-II": "PSI-25", BASS: "PSI-26",
  "FLEX-2": "PSI-68", FLEX: "PSI-69", "SAFFIRE-I": "PSI-98", "SAFFIRE-II": "PSI-99",
  "SAFFIRE-III": "PSI-100", "SAME-R": "PSI-101", "CFI-G": "PSI-159",
};

export interface SyncedPsiRecord {
  record: RawPsiInvestigation;
  origin: "live" | "snapshot";
  lastSeenAt?: string;
}

export function psiStudyComparisonId(studyId: string) {
  return `psi-study:${studyId}`;
}

function normalizeAcronym(text: string) {
  return text.toUpperCase().replace(/^ACME\b[\W_]+/, "").replace(/[^A-Z0-9]/g, "");
}

export function mergeSyncedPsiRecords(previous: ReadonlyMap<string, SyncedPsiRecord>, response: PsiSearchResponse) {
  const entries = new Map(previous);
  for (const record of response.investigations) {
    const existing = entries.get(record.accession);
    const live = response.sources.psi.ok;
    const versionChange = existing ? comparePsiVersions(record, existing.record) : 0;
    if (existing && ((!live && existing.origin === "live") || versionChange < 0)) continue;
    const lastSeenAt = live ? response.fetchedAt : undefined;
    if (existing?.lastSeenAt && lastSeenAt && lastSeenAt < existing.lastSeenAt && versionChange === 0) continue;
    const knownTable = versionChange === 0 ? existing?.record.tableProfile : undefined;
    entries.set(record.accession, {
      record: !record.tableProfile && knownTable ? { ...record, tableProfile: knownTable } : record,
      origin: live ? "live" : "snapshot", lastSeenAt,
    });
  }
  return entries;
}

export function mergePsiCatalog(curated: PsiDataset, entries: ReadonlyMap<string, SyncedPsiRecord>): PsiDataset {
  const usedAccessions = new Set<string>();
  const byAcronym = new Map<string, SyncedPsiRecord[]>();
  for (const item of entries.values()) {
    const aliases = new Set(item.record.acronym?.split(/\s*\/\s*/).map(normalizeAcronym).filter(Boolean) ?? []);
    for (const alias of aliases) {
      const existing = byAcronym.get(alias) ?? [];
      byAcronym.set(alias, [...existing, item]);
    }
  }
  const investigations = curated.investigations.map((study) => {
    const verified = verifiedAccessions[study.id];
    const candidates = byAcronym.get(normalizeAcronym(study.id));
    const match = verified ? entries.get(verified) : candidates?.length === 1 ? candidates[0] : undefined;
    if (!match || usedAccessions.has(match.record.accession)) return study;
    usedAccessions.add(match.record.accession);
    return { ...study, psi: psiIdentity(match.record, match.lastSeenAt) };
  });
  const runs = [...curated.runs];
  for (const item of entries.values()) {
    if (usedAccessions.has(item.record.accession)) continue;
    const study = mapLivePsiToStudy(item.record, item.origin, item.lastSeenAt);
    investigations.push(study);
    const run = buildPsiProfileRun(study);
    if (run) runs.push(run);
  }
  return { investigations, runs };
}
