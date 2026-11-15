import type { Citation, PsiDataset } from "../../types/psi";
import { compareExperimentParameters, recordedRunProfile, type ExperimentRecommendation } from "./experiment-retrieval";
import { plainObject, type ExperimentProfile, type ProfileField } from "./experiment-profile";

type Confidence = "alta" | "media" | "baja";

interface SupportingRun {
  accession: string;
  runId: string;
  label: string;
  officialUrl: string;
  outcome: string;
  source: Citation;
}

export interface HypothesisProposal {
  id: string;
  claim: string;
  reasoning: string;
  assumptions: string[];
  limitations: string[];
  principleSource: Citation;
  support: SupportingRun[];
  allowedConfidence: Confidence[];
}

export type ExperimentHypothesis = Omit<HypothesisProposal, "allowedConfidence"> & {
  confidence: Confidence;
  method: "analogía cualitativa";
};

const requiredEvidence: ProfileField[] = ["material", "geometry", "oxygen_pct", "pressure_kpa", "gravity_g"];

const hypotheses = [
  {
    id: "fabric-extinction", family: "BASS-II", outcome: "Extinción a bajo flujo",
    claim: "El frente visible de llama podría debilitarse hasta extinguirse bajo condiciones similares a las corridas de tejido.",
    reasoning: "En flujo forzado bajo, el aporte de oxígeno y la devolución de calor al tejido pueden dejar de sostener la combustión. El informe de BASS-II describe la relevancia de las pérdidas térmicas en una secuencia de extinción.",
    assumptions: ["Tejido, geometría, atmósfera y flujo comparables.", "El historial del flujo y el calentamiento de la muestra se parecen a los del ensayo documentado."],
    limitations: ["La analogía no determina un umbral de extinción ni una velocidad de propagación.", "La velocidad final registrada no describe por sí sola el historial del ensayo."],
    principleSource: { label: "Informe BASS-II · NASA/TM-20210011385, sección 7.1", url: "https://ntrs.nasa.gov/citations/20210011385" },
  },
  {
    id: "droplet-visible-extinction", family: "FLEX", outcome: "Extinción de la llama",
    claim: "La llama visible de la gota podría extinguirse antes de que se consuma todo el líquido.",
    reasoning: "La llama de una gota aislada necesita sostener el intercambio de calor y el transporte de oxidante. Las corridas de referencia aún documentan un diámetro de gota cuando se registra la extinción.",
    assumptions: ["Combustible, diámetro, atmósfera y régimen de flujo comparables.", "El soporte de la gota, el diluyente y el método de detección de la llama son comparables."],
    limitations: ["El registro no permite distinguir extinción radiativa de otros mecanismos para el experimento propuesto.", "La desaparición de la llama visible no establece el cese de toda reacción."],
    principleSource: { label: "Informe de FLEX · Combustión de gotas de metanol en microgravedad", url: "https://ntrs.nasa.gov/citations/20130014061" },
  },
] as const;

export function buildHypothesisProposals(profile: ExperimentProfile, recommendations: readonly ExperimentRecommendation[], dataset: PsiDataset) {
  if (requiredEvidence.some((field) => profile[field] === undefined)) return [];
  const byStudy = new Map(dataset.investigations.map((study) => [study.id, study.psi?.accession]));
  const byAccession = new Map(recommendations.map((item) => [item.accession, item]));
  const documented = dataset.runs.flatMap((run) => {
    const accession = byStudy.get(run.investigationId);
    const recommendation = accession ? byAccession.get(accession) : undefined;
    if (!accession || !recommendation || !run.outcome || run.reference || run.psiProfile) return [];
    const parameters = compareExperimentParameters(profile, recordedRunProfile(run));
    const quietDroplet = run.investigationId === "FLEX" && profile.flowDirection === "sin flujo" &&
      (profile.flow_cm_s === undefined || profile.flow_cm_s === 0) &&
      Boolean(run.nominal?.fields.includes("flow_velocity_cm_s") && /atmósfera quieta/i.test(run.nominal.basis));
    const requiredFields = quietDroplet ? requiredEvidence : [...requiredEvidence, "flow_cm_s"];
    if (!requiredFields.every((field) => parameters.some((row) => row.field === field && row.status === "match" &&
      (row.delta === undefined || row.tolerance === undefined || Math.abs(row.delta) <= row.tolerance / 2)))) return [];
    if (parameters.some(({ field, status }) => status !== "match" &&
      !(quietDroplet && status === "missing" && (field === "flow_cm_s" || field === "flowDirection")))) return [];
    return [{ run, accession, officialUrl: recommendation.officialUrl, quietDroplet }];
  });
  return hypotheses.flatMap((rule): HypothesisProposal[] => {
    const relevant = documented.filter(({ run }) => run.investigationId === rule.family);
    if (!relevant.length || relevant.some(({ run }) => run.outcome !== rule.outcome)) return [];
    if (rule.family === "BASS-II" && profile.flowDirection !== "concurrente") return [];
    if (rule.family === "FLEX" && (profile.diameter_mm === undefined ||
      relevant.some(({ run }) => (run.extinction_droplet_diameter_mm ?? 0) <= 0))) return [];
    const support = relevant.slice(0, 4).map(({ run, accession, officialUrl }) => ({
      accession, runId: run.id, label: run.label, officialUrl, outcome: rule.outcome, source: run.source,
    }));
    return [{
      id: rule.id, claim: rule.claim, reasoning: rule.reasoning, assumptions: [...rule.assumptions],
      limitations: [...rule.limitations, ...(relevant.some(({ quietDroplet }) => quietDroplet)
        ? ["Las gotas se describen en atmósfera quieta. La tabla no publica una medición de velocidad del flujo."] : [])],
      principleSource: rule.principleSource, support,
      allowedConfidence: support.length >= 2 && !relevant.some(({ quietDroplet }) => quietDroplet) ? ["baja", "media"] : ["baja"],
    }];
  });
}

export function hypothesisSchema(proposals: readonly HypothesisProposal[]) {
  return {
    type: "object", additionalProperties: false, required: ["hypotheses"],
    properties: {
      hypotheses: {
        type: "array", items: {
          type: "object", additionalProperties: false, required: ["id", "confidence"],
          properties: { id: { type: "string", enum: proposals.map(({ id }) => id) },
            confidence: { type: "string", enum: ["baja", "media", "alta"] } },
        },
      },
    },
  };
}

export function validateHypothesisSelection(output: unknown, proposals: readonly HypothesisProposal[]): ExperimentHypothesis[] | null {
  if (!plainObject(output) || Object.keys(output).length !== 1 || !Array.isArray(output.hypotheses) ||
    output.hypotheses.length > proposals.length) return null;
  const seen = new Set<string>();
  const result: ExperimentHypothesis[] = [];
  for (const selection of output.hypotheses) {
    if (!plainObject(selection) || Object.keys(selection).length !== 2) return null;
    const proposal = proposals.find(({ id }) => id === selection.id);
    if (!proposal || seen.has(proposal.id) || !proposal.allowedConfidence.includes(selection.confidence as Confidence)) return null;
    const { allowedConfidence: _allowedConfidence, ...details } = proposal;
    seen.add(proposal.id);
    result.push({ ...details, confidence: selection.confidence as Confidence, method: "analogía cualitativa" });
  }
  return result;
}
