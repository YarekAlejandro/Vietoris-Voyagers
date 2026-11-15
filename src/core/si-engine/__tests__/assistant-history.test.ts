import { describe, expect, it } from "vitest";
import { findAssistantHistory, formatAssistantHistory, isAssistantHistoryQuestion } from "../assistant-history";

describe("historia verificada de investigaciones", () => {
  it("distingue el lanzamiento, los ensayos y la reentrada de Saffire VI", () => {
    const question = "Explica lo que fue SAFFIRE-VI, ¿en qué fecha ocurrió?";
    const facts = findAssistantHistory("SAFFIRE-VI");
    const answer = formatAssistantHistory(facts, question);
    expect(isAssistantHistoryQuestion(question)).toBe(true);
    expect(answer?.text).toMatch(/último experimento.*1 de agosto de 2023.*22 al 24 de diciembre de 2023.*9 de enero de 2024/);
    expect(answer?.text).not.toContain("14 de febrero de 2024");
    expect(answer?.citations.map(({ url }) => url)).toEqual(expect.arrayContaining([
      "https://www.nasa.gov/mission/nasas-northrop-grumman-crs-19/",
      "https://microdevices.jpl.nasa.gov/interactivepdfs/pdf/2024%20MDL%20Annual%20Report.pdf",
    ]));
  });

  it("mantiene el significado y la precisión de cada fecha solicitada", () => {
    const facts = findAssistantHistory("SAFFIRE-VI");
    const launch = formatAssistantHistory(facts, "¿Cuándo despegó Saffire VI?");
    const publication = formatAssistantHistory(facts, "¿Cuándo publicó NASA los resultados?");
    expect(launch?.text).toContain("1 de agosto de 2023");
    expect(launch?.text).not.toContain("diciembre");
    expect(publication?.text).toContain("nota sobre el cierre de Saffire VI el 14 de febrero de 2024");
    expect(publication?.text).toContain("conferencia ICES de julio de 2024");
    expect(facts.find(({ kind }) => kind === "experiment")).toMatchObject({ date: "2023-12-22", endDate: "2023-12-24" });
  });

  it("responde sobre otras investigaciones y deja sin fecha los hitos sin fuente", () => {
    expect(formatAssistantHistory(findAssistantHistory("SAME-R"), "¿En qué año fue SAME-R?")?.text)
      .toContain("entre julio y septiembre de 2010");
    expect(formatAssistantHistory(findAssistantHistory("FLEX"), "¿Cuándo se lanzó FLEX?")).toBeNull();
    expect(formatAssistantHistory(findAssistantHistory("ESTUDIO-DESCONOCIDO"))).toBeNull();
  });
});
