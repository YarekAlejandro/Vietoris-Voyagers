import { describe, expect, it } from "vitest";
import { assistantFactsForModel, buildAssistantGrounding, validateAssistantGroundedAnswer } from "../assistant-grounding";

describe("respuestas del asistente con evidencia", () => {
  it("distingue las fechas de ensayo y cierre de Saffire VI y devuelve sus fuentes", () => {
    const facts = buildAssistantGrounding({ question: "Explica lo que fue SAFFIRE-VI. ¿En qué fecha ocurrió?" });
    const experiment = facts.find(({ milestone, dates }) => milestone === "experiment" && dates?.includes("2023-12-22"));
    const closing = facts.find(({ milestone, dates }) => milestone === "conclusion" && dates?.includes("2024-01-09"));
    expect(experiment?.dates).toEqual(["2023-12-22", "2023-12-24"]);
    expect(closing?.source?.url).toContain("www.nasa.gov");
    const answer = validateAssistantGroundedAnswer({ target: "inspector", paragraphs: [
      { text: "Los ensayos de Saffire VI se realizaron del 22 al 24 de diciembre de 2023.", factIds: [experiment?.id] },
      { text: "Cygnus reentró el 9 de enero de 2024.", factIds: [closing?.id] },
    ] }, facts);
    expect(answer?.sources).toEqual([experiment?.source, closing?.source]);
    expect(answer?.pointers[0]).toMatchObject({ target: "inspector", selection: { kind: "study", id: "SAFFIRE-VI" } });
    expect(JSON.stringify(assistantFactsForModel(facts))).not.toContain("https://");
  });

  it("retiene el contexto anterior para una pregunta de seguimiento y respeta otra mención explícita", () => {
    const selection = { kind: "study", id: "SAME" } as const;
    const previousQuestion = "¿Qué fue Saffire VI?";
    const dates = buildAssistantGrounding({ question: "¿Y cuándo ocurrió?", previousQuestion, selection });
    expect(dates.some(({ dates }) => dates?.includes("2023-12-22"))).toBe(true);
    const different = buildAssistantGrounding({ question: "¿Cuándo ocurrió SAME-R?", previousQuestion, selection });
    expect(different.some(({ dates }) => dates?.includes("2010-07"))).toBe(true);
    expect(different.some(({ dates }) => dates?.includes("2023-12-22"))).toBe(false);
  });

  it("rechaza cifras cambiadas, fechas recompuestas, fuentes inventadas y enlaces del modelo", () => {
    const facts = buildAssistantGrounding({ question: "¿Cuándo ocurrió Saffire VI?" });
    const closing = facts.find(({ milestone, dates }) => milestone === "conclusion" && dates?.includes("2024-01-09"));
    const experiment = facts.find(({ milestone, dates }) => milestone === "experiment" && dates?.includes("2023-12-22"));
    const answer = (text: string, factIds: unknown[] = [closing?.id, experiment?.id]) =>
      validateAssistantGroundedAnswer({ target: "inspector", paragraphs: [{ text, factIds }] }, facts);
    expect(answer("Concluyó el 9 de enero de 2023.")).toBeNull();
    expect(answer("Los ensayos se realizaron el 9 de enero de 2024.")).toBeNull();
    expect(answer("Hubo ensayos del 9 al 24 de diciembre de 2023.")).toBeNull();
    expect(answer("Hubo 999 muestras.")).toBeNull();
    expect(answer("Concluyó la misión.", ["NASA:inventada"])).toBeNull();
    expect(answer("Consulta https://example.com.")).toBeNull();
    expect(validateAssistantGroundedAnswer({ target: "script", paragraphs: [] }, facts)).toBeNull();
  });

  it("valida medidas con unidades y vuelve a señalar la medición original", () => {
    const facts = buildAssistantGrounding({ question: "¿Cuál era el diámetro de FLEX-C10H101?" });
    const reply = (text: string) => validateAssistantGroundedAnswer({ target: "inspector", paragraphs: [
      { text, factIds: ["run:FLEX-C10H101"] },
    ] }, facts);
    const valid = reply("El diámetro de la gota de FLEX fue de 3,57 mm al inicio y de 3,43 mm al extinguirse la llama visible.");
    expect(valid?.pointers[0]).toMatchObject({ target: "inspector", evidenceField: "initial_droplet_diameter_mm" });
    expect(valid?.sources?.[0].url).toContain("ntrs.nasa.gov");
    expect(reply("El diámetro fue de 3.57 cm.")).toBeNull();
  });

  it("rechaza causalidad directa cuando varias condiciones de la comparación cambiaron", () => {
    const facts = buildAssistantGrounding({ question: "¿Qué cambió entre A y B?", comparison: { a: "SAFFIRE-V-E6", b: "SAFFIRE-VI-E6" } });
    const compare = (text: string) => validateAssistantGroundedAnswer({ target: "comparison", paragraphs: [
      { text, factIds: ["comparison:active", "run:SAFFIRE-V-E6", "run:SAFFIRE-VI-E6"] },
    ] }, facts);
    expect(compare("El oxígeno cambió en +3.8 pp y también cambió la presión.")?.pointers[0].target).toBe("comparison");
    expect(compare("El oxígeno causó por sí solo la diferencia.")).toBeNull();
  });
});
