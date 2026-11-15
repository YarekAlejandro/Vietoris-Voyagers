import { beforeEach, expect, it, vi } from "vitest";
import { investigationsById, runsById } from "../../../data/psi";
import { missionPresets } from "../../../data/mission_presets";
import { compareRuns } from "../../../core/si-engine/git-diff";
import { buildDiffPayload } from "../../../core/si-engine/interpret";
import { POST } from "./route";

const call = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/llm", () => ({ resolveProvider: () => ({ call, apiKey: "mock", id: "mock" }) }));

const a = runsById.get("SAFFIRE-V-E6")!;
const b = runsById.get("SAFFIRE-VI-E6")!;
const payload = buildDiffPayload(a, b, compareRuns(a, b, investigationsById), investigationsById);
const submit = (oxygen_pct: number) => POST(new Request("http://localhost/api/interpret", {
  method: "POST",
  body: JSON.stringify({ kind: "diff", mode: "engineer", lang: "es", payload,
    scenario: { ...missionPresets[0].atmosphere, oxygen_pct } }),
}));

beforeEach(() => call.mockReset());

it("se abstiene ante una atmósfera sin cobertura sin consultar al proveedor", async () => {
  const response = await submit(100);
  expect(await response.json()).toMatchObject({
    source: "template", paragraphs: ["Sin evidencia directa para este escenario."],
  });
  expect(call).not.toHaveBeenCalled();
});

it("reintenta una salida inválida y entrega citas validadas sin identificar al proveedor", async () => {
  const narrative = (text: string) => JSON.stringify({
    summary: "Se documentaron condiciones diferentes.",
    claims: [{ text, runIds: [a.id] }], limitations: [],
  });
  call.mockResolvedValueOnce({ ok: true, text: narrative("El oxígeno fue 87 % O₂.") });
  call.mockResolvedValueOnce({ ok: true, text: narrative("En esta corrida se registró 26,5 % O₂.") });
  const response = await submit(21);
  const result = await response.json();
  expect(call).toHaveBeenCalledTimes(2);
  expect(result).toMatchObject({ source: "ai", fieldsUsed: [a.id] });
  expect(result).not.toHaveProperty("provider");
});
