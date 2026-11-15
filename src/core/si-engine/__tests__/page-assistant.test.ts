import { describe, expect, it } from "vitest";
import { missionPresets } from "../../../data/mission_presets";
import { psiDataset, runsById } from "../../../data/psi";
import { answerPageQuestion, type PageAssistantContext } from "../page-assistant";
import { computeCoverage } from "../scenario-coverage";
import { buildEvidenceIndex } from "../semantic-search";

const profile = missionPresets[0];
const context: PageAssistantContext = {
  studies: psiDataset.investigations,
  runs: psiDataset.runs,
  search: buildEvidenceIndex(psiDataset).search,
  coverage: computeCoverage(profile.atmosphere, psiDataset.runs),
  profile,
  atmosphere: profile.atmosphere,
  selection: { kind: "study", id: "SAFFIRE-VI" },
  comparison: { a: "SAFFIRE-V-E6", b: "SAFFIRE-VI-E6" },
};

describe("asistente del panel", () => {
  it("resuelve una corrida exacta, responde con la medida y señala su ficha con la fuente", () => {
    const run = runsById.get("FLEX-C10H101");
    const answer = answerPageQuestion("¿Qué diámetro al extinguirse la llama reportó FLEX-C10H101?", context);
    expect(answer.text).toContain("3.43 mm");
    expect(answer.pointers[0]).toMatchObject({ target: "inspector", selection: { kind: "run", id: run?.id }, source: run?.source,
      evidenceField: "extinction_droplet_diameter_mm" });
    const scene = answerPageQuestion("Muéstrame la escena de FLEX-C10H101", context);
    expect(scene.pointers[0]).toMatchObject({ target: "scene", selection: { kind: "run", id: run?.id } });
    expect(answerPageQuestion("Muéstrame la escena de FLEX-C10H101", { ...context, sceneEnabled: false }).pointers[0].target).toBe("catalog");
    expect(answerPageQuestion("¿Cuál fue el diámetro de FLEX-C10H101?", context).text).toMatch(/3\.57 mm.*3\.43 mm/);
  });

  it("mantiene la procedencia nominal al responder sobre una corrida seleccionada", () => {
    const answer = answerPageQuestion("¿Y su flujo?", { ...context, selection: { kind: "run", id: "FLEX-C10H101" } });
    expect(answer.text).toContain("Valor de referencia");
    expect(answer.pointers[0].selection).toEqual({ kind: "run", id: "FLEX-C10H101" });
  });

  it("usa la comparación visible y permite señalar un par de corridas elegido en la pregunta", () => {
    const active = answerPageQuestion("¿Qué cambió entre A y B?", context);
    expect(active.text).toContain("cambiaron a la vez");
    expect(active.pointers[0]).toMatchObject({ target: "comparison", comparison: context.comparison });
    const chosen = answerPageQuestion("Compara SAME-R-101 y SAME-R-54", context);
    expect(chosen.pointers[0]).toMatchObject({ comparison: { a: "SAME-R-101", b: "SAME-R-54" } });
    expect(chosen.text).toContain("+8.1 cm/s");
  });

  it("calcula la cobertura para la misión solicitada y la señala con el mismo perfil", () => {
    const answer = answerPageQuestion("¿Qué evidencia tenemos para el traje EVA?", context);
    expect(answer.text).toContain("no ofrece cobertura directa para Traje EVA");
    expect(answer.pointers[0]).toMatchObject({ target: "coverage", profileId: "eva" });
    expect(answer.pointers[1]?.source?.url).toMatch(/^https:/);
  });

  it("recupera estudios con la búsqueda del catálogo sin inventar una respuesta cuando no hay coincidencias", () => {
    const matches = answerPageQuestion("¿Qué estudios documentan las llamas frías?", context);
    expect(matches.pointers[0].target).toBe("inspector");
    expect(matches.pointers[0].source?.url).toMatch(/^https:/);
    const unknown = answerPageQuestion("¿Qué tiempo hará mañana?", context);
    expect(unknown.unanswered).toBe(true);
    expect(unknown.pointers).toEqual([{ target: "search", label: "Señalar el buscador" }]);
    const absentRun = answerPageQuestion("¿Qué midió FLEX-C10H999?", context);
    expect(absentRun.text).toContain("No encontré FLEX-C10H999");
    expect(answerPageQuestion("¿Qué estudió PSI-69?", context).pointers[0].selection).toEqual({ kind: "study", id: "FLEX" });
  });

  it("señala los controles de interfaz que el usuario pide", () => {
    for (const [question, target] of [
      ["¿Dónde está el buscador?", "search"], ["¿Dónde está el catálogo?", "catalog"], ["Muéstrame el grafo", "graph"],
      ["¿Qué muestra la ficha actual?", "inspector"], ["¿Cuál es la cobertura?", "coverage"], ["¿Qué cambió entre A y B?", "comparison"],
      ["¿Dónde está la escena 3D?", "scene"], ["¿Dónde puedo interpretar A/B?", "interpret"],
    ]) {
      expect(answerPageQuestion(question, context).pointers[0].target).toBe(target);
    }
    expect(answerPageQuestion("¿Dónde cambio el oxígeno?", context).pointers[0]).toMatchObject({
      target: "atmosphere", atmosphereField: "oxygen_pct",
    });
  });
});
