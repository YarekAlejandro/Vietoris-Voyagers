import seed from "./psi_seed_data.json";
import type { PsiDataset } from "../types/psi";

export const psiDataset = seed as PsiDataset;
export const investigationsById = new Map(psiDataset.investigations.map((study) => [study.id, study]));
export const runsById = new Map(psiDataset.runs.map((run) => [run.id, run]));
