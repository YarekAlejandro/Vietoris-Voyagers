import { expect, it } from "vitest";
import { investigationsById, runsById } from "../../../data/psi";
import { compareRuns, summarizeChangedDrivers } from "../git-diff";

it("compara valores reportados de FLEX y no calcula deltas para el flujo nominal", () => {
  const rows = compareRuns(runsById.get("FLEX-40CAL01")!, runsById.get("FLEX-C10H101")!, investigationsById);
  expect(rows.find(({ field }) => field.id === "co2_pct")).toMatchObject({ status: "changed", delta: 30 });
  expect(rows.find(({ field }) => field.id === "flow_velocity_cm_s")).toMatchObject({
    status: "nominal", nominalA: true, nominalB: true, delta: undefined,
  });
});

const saffireV = runsById.get("SAFFIRE-V-E6")!;
const saffireVI = runsById.get("SAFFIRE-VI-E6")!;

it("compara energía y registra diferencias de configuración", () => {
  const rows = compareRuns(saffireV, saffireVI, investigationsById);
  const heat = rows.find(({ field }) => field.id === "cabin_heat_added_kj");
  const oxygen = rows.find(({ field }) => field.id === "oxygen_pct");
  expect(heat).toMatchObject({ status: "changed", delta: 264 });
  expect(heat?.relativeDelta_pct).toBeCloseTo(113.3047);
  expect(oxygen?.delta).toBeCloseTo(3.8);
  expect(rows.find(({ field }) => field.id === "configuration")?.status).toBe("changed");
  expect(rows.find(({ field }) => field.id === "facility")?.status).toBe("equal");
  const rowIndex = (id: string) => rows.findIndex(({ field }) => field.id === id);
  expect(rowIndex("outcome")).toBe(0);
  expect(rowIndex("cabin_heat_added_kj")).toBeLessThan(rowIndex("oxygen_pct"));
  expect(rowIndex("oxygen_pct")).toBeLessThan(rowIndex("facility"));
});

it("conserva los valores ausentes y evita porcentajes relativos con base cero", () => {
  const rows = compareRuns(saffireV, { ...saffireVI, atmosphere: { ...saffireVI.atmosphere, gravity_g: 0.165 } }, investigationsById);
  expect(rows.find(({ field }) => field.id === "width_cm")).toMatchObject({ status: "missing", valueA: undefined, valueB: 40 });
  expect(rows.find(({ field }) => field.id === "gravity_g")).toMatchObject({ status: "changed", delta: 0.165, relativeDelta_pct: undefined });
});

it("advierte las cuatro condiciones confundidas de Saffire V y VI, con los gases de cabina separados", () => {
  const rows = compareRuns(saffireV, saffireVI, investigationsById);
  expect(summarizeChangedDrivers(rows)).toEqual({
    changedDrivers: 4,
    changedVariables: ["Oxígeno", "Presión absoluta", "Espesor o dimensión de la muestra", "Configuración"],
    confounded: true,
  });
  for (const id of ["cabin_co_ppm", "cabin_co2_ppm"]) {
    expect(rows.find(({ field }) => field.id === id)).toMatchObject({
      valueA: undefined, valueB: undefined, status: "missing", outcome: true,
    });
  }
});

it("no advierte si cambia una condición o si las dos corridas son idénticas", () => {
  const differentFlow = { ...saffireV, atmosphere: { ...saffireV.atmosphere, flow_velocity_cm_s: 10 } };
  expect(summarizeChangedDrivers(compareRuns(saffireV, differentFlow, investigationsById))).toEqual({
    changedDrivers: 1, changedVariables: ["Flujo de referencia"], confounded: false,
  });
  expect(summarizeChangedDrivers(compareRuns(saffireV, saffireV, investigationsById))).toEqual({
    changedDrivers: 0, changedVariables: [], confounded: false,
  });
});

it("ignora perfiles y valores nominales, agrupa dimensiones y cuenta cambios desde cero", () => {
  const a = { ...saffireV, width_cm: 100, thickness_mm: 100 };
  const b = {
    ...a,
    width_cm: 102,
    thickness_mm: 102,
    atmosphere: { ...a.atmosphere, gravity_g: 0.165, oxygen_pct: 100 },
    nominal: { fields: ["oxygen_pct"] as const, basis: "perfil sintético" },
  };
  expect(summarizeChangedDrivers(compareRuns(a, b, investigationsById))).toMatchObject({
    changedDrivers: 2, changedVariables: ["Espesor o dimensión de la muestra", "Gravedad"], confounded: true,
  });
  expect(summarizeChangedDrivers(compareRuns(a, { ...b, reference: true }, investigationsById)).changedDrivers).toBe(0);
  expect(summarizeChangedDrivers(compareRuns(a, { ...a, width_cm: 101 }, investigationsById)).changedDrivers).toBe(0);
});
