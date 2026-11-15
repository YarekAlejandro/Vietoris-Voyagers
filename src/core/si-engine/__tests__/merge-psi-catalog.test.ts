import { expect, it } from "vitest";
import bass from "../../../../fixtures/psi/PSI-25.json";
import newStudyFixture from "../../../../fixtures/psi/PSI-142.json";
import snapshot from "../../../../data/psi-snapshot.json";
import { psiDataset } from "../../../data/psi";
import { parsePsiDetail } from "../../../lib/psi/psi-api";
import type { PsiSearchResponse, RawPsiInvestigation } from "../../../types/psi-live";
import { mergePsiCatalog, mergeSyncedPsiRecords } from "../merge-psi-catalog";

function batch(investigations: RawPsiInvestigation[], ok = true): PsiSearchResponse {
  return {
    status: ok ? "live" : "snapshot",
    sources: { psi: { ok, count: ok ? investigations.length : 0, ms: 0 }, ntrs: { ok: true, count: 0, ms: 0 } },
    investigations, literature: [], fetchedAt: "2026-11-14T18:30:00Z",
  };
}

it("resuelve variantes de acrónimo y conserva las fichas y corridas curadas", () => {
  const daft = snapshot.investigations.find((record) => record.acronym === "DAFT / DAFT-2")!;
  const records = [parsePsiDetail(bass), daft, parsePsiDetail(newStudyFixture)];
  const entries = mergeSyncedPsiRecords(new Map(), batch(records));
  const merged = mergePsiCatalog(psiDataset, entries);
  expect(merged.investigations).toHaveLength(psiDataset.investigations.length + 1);
  const original = psiDataset.investigations.find(({ id }) => id === "BASS-II")!;
  const { psi, ...metadata } = merged.investigations.find(({ id }) => id === original.id)!;
  expect(metadata).toEqual(original);
  expect(psi).toMatchObject({ accession: "PSI-25", lastSeenAt: "2026-11-14T18:30:00Z" });
  expect(merged.investigations.find(({ id }) => id === "DAFT")?.psi?.accession).toBe(daft.accession);
  expect(merged.investigations).not.toContainEqual(expect.objectContaining({ id: "PSI-25" }));
  expect(merged.runs).toEqual(psiDataset.runs);
});

it("deduplica por accesión y conserva la versión más reciente al entrar en modo snapshot", () => {
  const record = parsePsiDetail(newStudyFixture);
  const newest = { ...record, version: 12 };
  const entries = mergeSyncedPsiRecords(new Map(), batch([newest, record]));
  const offline = mergeSyncedPsiRecords(entries, batch([record], false));
  expect(offline.size).toBe(1);
  expect(offline.get(record.accession)).toMatchObject({ record: newest, origin: "live" });
  expect(mergePsiCatalog(psiDataset, offline).investigations.filter(({ id }) => id === record.accession)).toHaveLength(1);
});
