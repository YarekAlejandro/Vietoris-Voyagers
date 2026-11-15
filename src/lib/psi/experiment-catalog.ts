import snapshotData from "../../../data/psi-snapshot.json";
import { psiDataset } from "../../data/psi";
import { mergePsiCatalog, type SyncedPsiRecord } from "../../core/si-engine/merge-psi-catalog";
import type { PsiSnapshot, RawPsiInvestigation } from "../../types/psi-live";
import { fetchPsiIndex, getPsiApiConfig } from "./psi-api";
import { filterPsiArea, latestPsiRecords } from "./records";

const snapshot: PsiSnapshot = snapshotData;

export async function loadExperimentCatalog(signal: AbortSignal) {
  let origin: "live" | "snapshot" = "snapshot";
  let records: RawPsiInvestigation[] = filterPsiArea(snapshot.investigations, "combustion");
  try {
    const live = filterPsiArea(latestPsiRecords(await fetchPsiIndex(getPsiApiConfig(), "", AbortSignal.any([
      signal, AbortSignal.timeout(5500),
    ]))), "combustion");
    if (live.length) {
      origin = "live";
      records = live;
    }
  } catch {
    // El catálogo publicado con la aplicación conserva las accesiones para trabajar sin acceso a PSI.
  }
  signal.throwIfAborted();
  const entries = new Map<string, SyncedPsiRecord>(records.map((record) => [record.accession, { record, origin }]));
  return { dataset: mergePsiCatalog(psiDataset, entries), records, origin, snapshotDate: origin === "snapshot" ? snapshot.generatedAt : undefined };
}
