import type { Atmosphere } from "./psi";

export type PsiArea = "combustion" | "all";

export interface PsiPublication {
  title: string;
  doi: string | null;
}

export interface PsiQuantity {
  value: number | readonly [min: number, max: number];
  unit: "% O₂" | "psia" | "cm/s" | "g";
  source: "abstract-regex" | "experimental-table" | "curated";
  confidence: "media" | "alta";
  evidence: string;
}

export type PsiProfile = Partial<Record<keyof Atmosphere, PsiQuantity>>;

export interface RawPsiInvestigation {
  accession: string;
  title: string;
  acronym: string | null;
  projectType: string | null;
  researchArea: string;
  objective: string | null;
  approach: string | null;
  hypothesis: string | null;
  hardware: string[];
  doi: string | null;
  license: string | null;
  publications: PsiPublication[];
  releaseDate: string | null;
  sourceUrl: string;
  keywords?: string;
  flightPlatform?: string;
  version?: number;
  modifiedDate?: string;
  tableProfile?: PsiProfile;
}

export interface NtrsRecord {
  id: string;
  title: string;
  abstract: string | null;
  date: string | null;
  url: string;
}

interface SourceStatus {
  ok: boolean;
  count: number;
  ms: number;
  error?: "timeout" | "unavailable" | "invalid-response";
}

export interface PsiSearchResponse {
  status: "live" | "partial" | "snapshot";
  sources: { psi: SourceStatus; ntrs: SourceStatus };
  investigations: RawPsiInvestigation[];
  literature: NtrsRecord[];
  fetchedAt: string;
  snapshotGeneratedAt?: string;
}

export interface PsiSnapshot {
  generatedAt: string;
  investigations: RawPsiInvestigation[];
}

export interface PsiIdentity {
  accession: string;
  officialUrl: string;
  doi: string | null;
  license: string | null;
  publications: readonly PsiPublication[];
  lastSeenAt?: string;
}

export interface ImportedPsiEvidence {
  origin: "live" | "snapshot";
  acronym: string | null;
  projectType: string | null;
  researchArea: string;
  keywords?: string;
  flightPlatform?: string;
  hardware: readonly string[];
  profile: PsiProfile | null;
  fsrs: { status: "calculable" | "sin-datos-suficientes" };
}
