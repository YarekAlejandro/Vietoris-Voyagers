import { describe, expect, it } from "vitest";
import { missionPresets } from "../../../data/mission_presets";
import { investigationsById, psiDataset, runsById } from "../../../data/psi";
import { rankRuns } from "../fsrs-ranker";
import { compareRuns } from "../git-diff";
import {
  buildDiffPayload, buildRankPayload, diffStatus, interpretationKey, isInterpretation, parseInterpretRequest,
  templateInterpretation, validateNumbers, type InterpretRequest,
} from "../interpret";

const a = runsById.get("SAFFIRE-V-E6")!;
const b = runsById.get("SAFFIRE-VI-E6")!;
const rows = compareRuns(a, b, investigationsById).filter(({ valueA, valueB }) => valueA !== undefined || valueB !== undefined);
const diffPayload = buildDiffPayload(a, b, rows, investigationsById);
const diffRequest: InterpretRequest = { kind: "diff", payload: diffPayload, mode: "engineer", lang: "es" };

const iss = missionPresets[0];
const [topResult] = rankRuns(psiDataset.runs, investigationsById, iss, iss.atmosphere);
const rankPayload = buildRankPayload(topResult, iss, iss.atmosphere, investigationsById);
const rankRequest: InterpretRequest = { kind: "rank", payload: rankPayload, mode: "student", lang: "es" };

describe("buildDiffPayload", () => {
  it("incluye filas, fuentes y presión parcial de O₂ de cada corrida", () => {
    const heat = diffPayload.rows.find(({ id }) => id === "cabin_heat_added_kj");
    expect(heat).toMatchObject({ valueA: 233, valueB: 497, status: "changed", delta: 264, unit: "kJ", decimals: 0 });
    expect(diffPayload.runs.a).toMatchObject({ id: "SAFFIRE-V-E6", source: a.source });
    expect(diffPayload.runs.a.oxygen_partial_pressure_psia).toBeCloseTo(10.399 * 0.265);
    expect(diffPayload.runs.b.oxygen_partial_pressure_psia).toBeCloseTo(7.919 * 0.303);
  });

  it("marca como «missing» los valores sin dato", () => {
    expect(diffPayload.rows.find(({ id }) => id === "width_cm")).toMatchObject({ valueA: "missing", valueB: 40, status: "missing", delta: null, missingIn: "A" });
    expect(diffPayload.rows.find(({ id }) => id === "oxygen_pct")?.missingIn).toBeNull();
    // Los valores van redondeados como en la tabla: 10.399 psia → 10.40 (2 decimales).
    expect(diffPayload.rows.find(({ id }) => id === "pressure_psia")).toMatchObject({ valueA: 10.4, valueB: 7.92, delta: -2.48 });
    expect(diffPayload.rows.find(({ id }) => id === "cabin_heat_added_kj")?.relativeDelta_pct).toBe(113.3);
  });
});

describe("buildRankPayload", () => {
  it("expone el FSRS y sus componentes redondeados como en la interfaz", () => {
    expect(rankPayload).toMatchObject({
      score: Math.round(topResult.score * 10) / 10, scoreMax: 100,
      atmosphere_pct: Math.round(topResult.atmosphere_pct),
      flow_pct: Math.round(topResult.flow_pct),
      gravityBridge_pct: Math.round(topResult.gravityBridge_pct),
      bonus_pts: topResult.bonus_pts,
      profile: { id: "iss", name: iss.name, priority: iss.priority },
      study: { id: topResult.run.investigationId, safetyPillars: [...investigationsById.get(topResult.run.investigationId)!.safetyPillars] },
      target: { ...iss.atmosphere },
    });
    expect(rankPayload.target.oxygen_partial_pressure_psia).toBeCloseTo(3.087);
    // No lleva pesos ni constantes de la fórmula.
    expect(JSON.stringify(rankPayload)).not.toMatch(/Weights|targetFuel|fuelMatch/);
  });
});

describe("templateInterpretation", () => {
  it("resume cambios, iguales y faltantes de la comparación", () => {
    const { paragraphs, caveats } = templateInterpretation(diffRequest);
    // El calor añadido es un resultado observado: se lista aparte de las condiciones.
    expect(paragraphs[0]).toMatch(/cambiaron varias condiciones: .*Oxígeno \(26\.5 % O₂ → 30\.3 % O₂\)/);
    expect(paragraphs[0]).toContain("Resultados observados que cambiaron: Calor añadido a cabina (estim.) (233 kJ → 497 kJ)");
    expect(paragraphs[0].split("Resultados observados")[0]).not.toContain("Calor añadido");
    expect(paragraphs[1]).toContain("Se mantienen iguales");
    expect(paragraphs[1]).toContain("Ancho de muestra");
    expect(caveats.join(" ")).toMatch(/varias condiciones/);
    expect(caveats.join(" ")).toMatch(/0 g/);
  });

  it("explica el puntaje y avisa la diferencia de gravedad en inglés", () => {
    const artemis = missionPresets.find(({ id }) => id === "artemis")!;
    const [result] = rankRuns(psiDataset.runs, investigationsById, artemis, artemis.atmosphere);
    const { paragraphs, caveats } = templateInterpretation({
      kind: "rank", payload: buildRankPayload(result, artemis, artemis.atmosphere, investigationsById), mode: "engineer", lang: "en",
    });
    expect(paragraphs[0]).toContain(`${result.score.toFixed(1)} out of 100`);
    expect(paragraphs[0]).toContain(`atmosphere ${Math.round(result.atmosphere_pct)} %`);
    expect(paragraphs[0]).toMatch(/priority pillar \(prevention\)/);
    expect(caveats.join(" ")).toContain("0.165 g");
  });

  it("solo usa números presentes en el payload", () => {
    for (const request of [diffRequest, rankRequest]) {
      const { paragraphs, caveats } = templateInterpretation(request);
      expect(validateNumbers([...paragraphs, ...caveats].join(" "), request.payload)).toEqual({ ok: true, unknown: [] });
    }
  });
});

describe("validateNumbers", () => {
  it("acepta valores, deltas y redondeos del payload, también con coma decimal", () => {
    expect(validateNumbers("El calor sube 264 kJ (+113,3 %) y el oxígeno 3.8 pp; pasa de 2.76 a 2.40 psia.", diffPayload).ok).toBe(true);
  });

  it("rechaza números que no vienen del payload", () => {
    expect(validateNumbers("El calor llega a 500 kJ.", diffPayload)).toEqual({ ok: false, unknown: [500] });
  });

  it("ignora conteos pequeños y dígitos dentro de identificadores", () => {
    expect(validateNumbers("Cambiaron 2 variables entre SAFFIRE-V-E6 y PSI-25 con CO2.", diffPayload).ok).toBe(true);
  });
});

describe("valores nominales", () => {
  const sameR = runsById.get("SAME-R-77")!;
  const flex = runsById.get("FLEX-C10H101")!;
  const nominalRows = compareRuns(sameR, flex, investigationsById).filter(({ valueA, valueB }) => valueA !== undefined || valueB !== undefined);
  const nominalPayload = buildDiffPayload(sameR, flex, nominalRows, investigationsById);
  const nominalRequest: InterpretRequest = { kind: "diff", payload: nominalPayload, mode: "engineer", lang: "es" };

  it("marca como nominales el O₂ y la presión de SAME-R y el flujo de FLEX", () => {
    for (const id of ["oxygen_pct", "pressure_psia", "flow_velocity_cm_s"]) {
      expect(nominalPayload.rows.find((row) => row.id === id)).toMatchObject({ status: "nominal", delta: null });
    }
    expect(nominalPayload.rows.find(({ id }) => id === "oxygen_pct")).toMatchObject({ nominalA: true, nominalB: false });
    expect(nominalPayload.runs.a.nominal).toEqual({ fields: ["oxygen_pct", "pressure_psia"], basis: sameR.nominal!.basis });
  });

  it("la plantilla los lista como nominales, no como cambios, y cita su base", () => {
    const { paragraphs, caveats } = templateInterpretation(nominalRequest);
    expect(paragraphs[1]).toContain("Valor nominal, no medido: Oxígeno");
    expect(paragraphs[1]).toMatch(/psia \(nominal\) en A y [\d.]+ psia en B/);
    expect(nominalPayload.runs.a.oxygen_partial_pressure_nominal).toBe(true);
    expect(nominalPayload.runs.b.oxygen_partial_pressure_nominal).toBe(false);
    expect(paragraphs[0]).not.toMatch(/Oxígeno \(/);
    expect(caveats).toContain(`Valor nominal en A: ${sameR.nominal!.basis}`);
    expect(caveats.some((caveat) => caveat.startsWith("Valor nominal en B: Gota en atmósfera quieta"))).toBe(true);
    expect(validateNumbers([...paragraphs, ...caveats].join(" "), nominalPayload).ok).toBe(true);
    expect(parseInterpretRequest(JSON.parse(JSON.stringify(nominalRequest)))).toEqual(nominalRequest);
  });

  it("en el ranking avisa que los ejes nominales no se midieron", () => {
    const mining = missionPresets.find(({ id }) => id === "mining")!;
    const result = rankRuns(psiDataset.runs, investigationsById, mining, mining.atmosphere).find(({ run }) => run.id === "SAME-R-77")!;
    const payload = buildRankPayload(result, mining, mining.atmosphere, investigationsById);
    expect(payload.run.nominal?.fields).toEqual(["oxygen_pct", "pressure_psia"]);
    const { paragraphs, caveats } = templateInterpretation({ kind: "rank", payload, mode: "engineer", lang: "es" });
    expect(paragraphs[1]).toContain("21.0 % O₂ (nominal)");
    expect(caveats[0]).toMatch(/^Valores nominales, no medidos \(oxígeno, presión\)/);
    expect(validateNumbers([...paragraphs, ...caveats].join(" "), payload).ok).toBe(true);
  });

  it("falla ante un estado de diff desconocido", () => {
    expect(diffStatus("nominal")).toBe("nominal");
    expect(() => diffStatus("otro")).toThrow();
  });
});

describe("atmósfera parcial y perfiles nominales PSI", () => {
  const daft = runsById.get("DAFT-REF-CABIN")!;
  const sameR = runsById.get("SAME-R-77")!;
  const refRows = compareRuns(daft, sameR, investigationsById).filter(({ valueA, valueB }) => valueA !== undefined || valueB !== undefined);
  const refPayload = buildDiffPayload(daft, sameR, refRows, investigationsById);
  const refRequest: InterpretRequest = { kind: "diff", payload: refPayload, mode: "engineer", lang: "es" };

  it("marca los ejes que la corrida no reporta y la presión parcial como «missing»", () => {
    expect(daft.reference).toBe(true);
    expect(refPayload.runs.a).toMatchObject({ reference: true, oxygen_partial_pressure_psia: "missing" });
    expect(refPayload.runs.b).toMatchObject({ reference: false });
    expect(refPayload.rows.find(({ id }) => id === "oxygen_pct")).toMatchObject({ valueA: "missing", status: "missing" });
  });

  it("la plantilla avisa que A es un perfil nominal y no compara ejes faltantes", () => {
    const { paragraphs, caveats } = templateInterpretation(refRequest);
    expect(caveats).toContain(`A: ${daft.label} es un perfil nominal PSI: describe condiciones de referencia, no es una corrida medida.`);
    expect(paragraphs.join(" ")).toContain("La presión parcial de O₂ solo está disponible en B: 3.09 psia (nominal).");
    expect(paragraphs[0]).not.toMatch(/Oxígeno \(/);
    expect(validateNumbers([...paragraphs, ...caveats].join(" "), refPayload).ok).toBe(true);
    expect(parseInterpretRequest(JSON.parse(JSON.stringify(refRequest)))).toEqual(refRequest);
  });

  it("en el ranking de un perfil nominal avisa los ejes no reportados", () => {
    const result = rankRuns(psiDataset.runs, investigationsById, iss, iss.atmosphere).find(({ run }) => run.id === "DAFT-REF-CABIN")!;
    const payload = buildRankPayload(result, iss, iss.atmosphere, investigationsById);
    expect(payload.run.atmosphere).toMatchObject({ oxygen_pct: "missing", pressure_psia: "missing", flow_velocity_cm_s: "missing" });
    const { paragraphs, caveats } = templateInterpretation({ kind: "rank", payload, mode: "engineer", lang: "es" });
    expect(paragraphs[1]).toContain("% O₂ sin dato");
    expect(caveats.join(" ")).toContain("perfil nominal PSI");
    expect(caveats.join(" ")).toContain("no reporta oxígeno, presión, flujo");
    expect(validateNumbers([...paragraphs, ...caveats].join(" "), payload).ok).toBe(true);
    expect(parseInterpretRequest(JSON.parse(JSON.stringify({ kind: "rank", payload, mode: "engineer", lang: "es" })))).not.toBeNull();
  });
});

describe("parseInterpretRequest", () => {
  it("acepta un cuerpo válido y rechaza formas inválidas", () => {
    expect(parseInterpretRequest(JSON.parse(JSON.stringify(diffRequest)))).toEqual(diffRequest);
    expect(parseInterpretRequest(JSON.parse(JSON.stringify(rankRequest)))).toEqual(rankRequest);
    expect(parseInterpretRequest({ ...diffRequest, kind: "otro" })).toBeNull();
    expect(parseInterpretRequest({ ...diffRequest, lang: "fr" })).toBeNull();
    expect(parseInterpretRequest({ ...diffRequest, payload: { runs: {}, rows: [] } })).toBeNull();
    expect(parseInterpretRequest({ ...diffRequest, payload: { ...diffPayload, rows: [{ ...diffPayload.rows[0], label: "x".repeat(5000) }] } })).toBeNull();
  });

  it("valida la forma de la respuesta y arma claves de caché estables", () => {
    expect(isInterpretation({ paragraphs: ["a"], caveats: [], fieldsUsed: [] })).toBe(true);
    expect(isInterpretation({ paragraphs: [], caveats: [], fieldsUsed: [] })).toBe(false);
    expect(interpretationKey(diffRequest)).toBe("diff|SAFFIRE-V-E6|SAFFIRE-VI-E6|engineer|es");
    expect(interpretationKey(rankRequest)).toBe(`rank|${topResult.run.id}|iss|0,21,14.7,4.5|student|es`);
  });
});
