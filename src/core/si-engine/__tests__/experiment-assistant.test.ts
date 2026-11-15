import { describe, expect, it } from "vitest";
import snapshot from "../../../../data/psi-snapshot.json";
import { psiDataset } from "../../../data/psi";
import { localProfileProposal, localRefinementProposal, validateProfileProposal, type ExperimentProfile } from "../experiment-profile";
import { rankExperiments } from "../experiment-retrieval";
import { buildHypothesisProposals, validateHypothesisSelection } from "../experiment-hypotheses";
import { mergePsiCatalog, type SyncedPsiRecord } from "../merge-psi-catalog";

const raw = snapshot.investigations.filter(({ researchArea }) => researchArea.toLowerCase() === "combustion science");
const catalog = mergePsiCatalog(psiDataset, new Map<string, SyncedPsiRecord>(raw.map((record) =>
  [record.accession, { record, origin: "snapshot" }])));
const fiber: ExperimentProfile = { material: "SIBAL", geometry: "lámina", oxygen_pct: 18.7, pressure_kpa: 101.3,
  flow_cm_s: 2.2, flowDirection: "concurrente", gravity_g: 0, thickness_mm: 0.32, objective: "extinción de llama a bajo flujo" };

describe("perfil y analogías del asistente", () => {
  it("refina el oxígeno y conserva lo demás. Una masa en g no es un nivel de gravedad", () => {
    const update = "¿Y si bajo el O₂ a 18%? La muestra pesa 2 g.";
    const current = { material: "SIBAL", pressure_kpa: 101.3 };
    expect(localProfileProposal(update, current).profile).toEqual({ ...current, oxygen_pct: 18 });
    expect(validateProfileProposal({ changes: [{ field: "gravity_g", action: "set", quote: "2 g" }] }, update, current)).toBeNull();
    expect(validateProfileProposal({ changes: [{ field: "oxygen_pct", action: "set", quote: "21%" }] }, update, current)).toBeNull();
    expect(localProfileProposal("Quiero reducir el O₂ en 18%.", current).profile).toEqual(current);
    expect(localProfileProposal("No usar oxígeno al 18%. No usar PMMA.", current).profile).toEqual(current);
  });

  it("recupera un refinamiento explícito omitido por el modelo sin interpretar una pregunta general como cambio", () => {
    expect(localRefinementProposal("¿Y si bajo el O₂ a 18%?", fiber)).toMatchObject({
      profile: { ...fiber, oxygen_pct: 18 }, evidence: { oxygen_pct: "18%" },
    });
    expect(localRefinementProposal("¿Y si bajo el O₂ en 18%?", fiber)).toBeNull();
    expect(localRefinementProposal("¿Qué estudios usaron O₂ al 18%?", fiber)).toBeNull();
  });

  it("usa la atmósfera quieta de FLEX como referencia cualitativa sin declarar flujo medido", () => {
    const droplet: ExperimentProfile = { material: "Metanol", geometry: "Gota aislada", oxygen_pct: 21, pressure_kpa: 101.3,
      flowDirection: "sin flujo", flow_cm_s: 0, gravity_g: 0, diameter_mm: 2.54, objective: "extinción de llama visible" };
    const results = rankExperiments(droplet, catalog, raw, 5);
    const flex = results.find(({ accession }) => accession === "PSI-69");
    expect(flex?.parameters.find(({ field }) => field === "flow_cm_s")?.status).toBe("missing");
    const [proposal] = buildHypothesisProposals(droplet, results, catalog);
    expect(proposal?.id).toBe("droplet-visible-extinction");
    expect(proposal?.limitations.join(" ")).toContain("no publica una medición");
  });

  it("ordena por condiciones y tema con la accesión oficial y diferencias en unidades", () => {
    const [best, ...others] = rankExperiments(fiber, catalog, raw, 5);
    expect(best.accession).toBe("PSI-25");
    expect(best.officialUrl).toContain("/investigations/PSI-25");
    expect(best.run?.id).toBe("BASS-II-GMT45-T4");
    expect(best.parameters.find(({ field }) => field === "oxygen_pct")).toMatchObject({ delta: 0, tolerance: 3, status: "match" });
    expect(best.parameters.find(({ field }) => field === "pressure_kpa")).toMatchObject({ unit: "kPa", status: "match" });
    expect(others.length).toBeLessThanOrEqual(4);
  });

  it("acota hipótesis al respaldo real y se abstiene cuando hay un diluyente sin documentar", () => {
    const results = rankExperiments(fiber, catalog, raw, 5);
    const proposals = buildHypothesisProposals(fiber, results, catalog);
    expect(proposals[0]?.support[0]).toMatchObject({ accession: "PSI-25", outcome: "Extinción a bajo flujo" });
    expect(validateHypothesisSelection({ hypotheses: [{ id: "fabric-extinction", confidence: "baja" }] }, proposals)?.[0])
      .toMatchObject({ method: "analogía cualitativa", confidence: "baja" });
    expect(validateHypothesisSelection({ hypotheses: [{ id: "fabric-extinction", confidence: "alta" }] }, proposals)).toBeNull();
    expect(validateHypothesisSelection({ hypotheses: [{ id: "inventado", confidence: "baja" }] }, proposals)).toBeNull();
    expect(buildHypothesisProposals({ ...fiber, diluent: "Argón" }, results, catalog)).toEqual([]);
  });
});
