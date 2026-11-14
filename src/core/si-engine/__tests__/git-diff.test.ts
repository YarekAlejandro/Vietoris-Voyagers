import { expect, it } from "vitest";
import { investigationsById, runsById } from "../../../data/psi";
import { compareRuns } from "../git-diff";

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
});

it("compara supresión con CO₂ entre corridas de FLEX", () => {
  const rows = compareRuns(runsById.get("FLEX-40CAL01")!, runsById.get("FLEX-C10H101")!, investigationsById);
  expect(rows.find(({ field }) => field.id === "co2_pct")).toMatchObject({ status: "changed", delta: 30 });
  expect(rows.find(({ field }) => field.id === "initial_droplet_diameter_mm")?.delta).toBeCloseTo(1.03);
  expect(rows.find(({ field }) => field.id === "fuel")?.status).toBe("changed");
  expect(rows.find(({ field }) => field.id === "facility")?.status).toBe("equal");
});

it("conserva los valores ausentes y evita porcentajes relativos con base cero", () => {
  const rows = compareRuns(saffireV, { ...saffireVI, atmosphere: { ...saffireVI.atmosphere, gravity_g: 0.165 } }, investigationsById);
  expect(rows.find(({ field }) => field.id === "width_cm")).toMatchObject({ status: "missing", valueA: undefined, valueB: 40 });
  expect(rows.find(({ field }) => field.id === "gravity_g")).toMatchObject({ status: "changed", delta: 0.165, relativeDelta_pct: undefined });
});
