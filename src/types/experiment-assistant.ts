import type { ExperimentHypothesis } from "../core/si-engine/experiment-hypotheses";
import type { ExperimentProfile, ProfileProposal } from "../core/si-engine/experiment-profile";
import type { ExperimentRecommendation } from "../core/si-engine/experiment-retrieval";

export const defaultResultCount = 5;
export const maxResultCount = 12;

export type ExperimentRequest =
  | { action: "extract"; text: string; profile: ExperimentProfile }
  | { action: "search"; profile: ExperimentProfile; limit: number };

export interface ExperimentResults {
  origin: "live" | "snapshot";
  indexedStudies: number;
  snapshotDate?: string;
  recommendations: ExperimentRecommendation[];
}

export type ExperimentEvent =
  | { type: "stage"; stage: "extracting" | "searching" | "analyzing" }
  | { type: "profile"; proposal: ProfileProposal; source: "ai" | "local"; notice?: string }
  | { type: "results"; result: ExperimentResults }
  | { type: "hypotheses"; hypotheses: ExperimentHypothesis[]; source?: "ai" | "local"; note?: string }
  | { type: "error"; message: string }
  | { type: "keepalive" | "done" };
