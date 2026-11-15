import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const question = "Explica lo que fue SAFFIRE-VI, ¿en qué fecha ocurrió?";
const historyAnswer = "Los ensayos de Saffire VI se realizaron del 22 al 24 de diciembre de 2023, después de que Cygnus se separara de la EEI.";

function submit(body: string = JSON.stringify({ question })) {
  return POST(new Request("http://localhost/api/assistant", {
    method: "POST", headers: { "content-type": "application/json" }, body,
  }));
}

beforeEach(() => {
  for (const key of ["AI_PROVIDER", "AI_MODEL", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]) vi.stubEnv(key, undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each(["gemini", "claude"] as const)("responde una pregunta histórica con el adaptador de %s", async (provider) => {
  const gemini = provider === "gemini";
  vi.stubEnv(gemini ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY", "clave-de-prueba");
  if (!gemini) vi.stubEnv("AI_PROVIDER", "claude");
  const send = vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toContain(gemini ? "generativelanguage.googleapis.com" : "api.anthropic.com");
    const headers = new Headers(init.headers);
    expect(headers.get(gemini ? "x-goog-api-key" : "x-api-key")).toBe("clave-de-prueba");
    const payload = JSON.parse(String(init.body));
    const input = JSON.parse(gemini ? payload.input : payload.messages[0].content);
    expect(input.question).toBe(question);
    const dates = input.facts.find((fact: { milestone?: string }) => fact.milestone === "experiment");
    expect(dates.dates).toEqual(["2023-12-22", "2023-12-24"]);
    const text = JSON.stringify({ paragraphs: [{ text: historyAnswer, factIds: [dates.id] }], target: "inspector" });
    return Response.json(gemini ? {
      status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text }] }],
    } : { stop_reason: "end_turn", content: [{ type: "text", text }] });
  });
  vi.stubGlobal("fetch", send);

  const response = await submit();
  expect(response.headers.get("cache-control")).toBe("no-store");
  const data = await response.json();
  expect(data.answer).toMatchObject({
    origin: "ai", text: historyAnswer,
    pointers: [{ target: "inspector", selection: { kind: "study", id: "SAFFIRE-VI" } }],
    sources: [{ url: expect.stringContaining("microdevices.jpl.nasa.gov/") }],
  });
  expect(JSON.stringify(data)).not.toContain("clave-de-prueba");
  expect(send).toHaveBeenCalledOnce();
});

it("devuelve el control al motor local ante una fecha inventada", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "clave-de-prueba");
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const { messages } = JSON.parse(String(init.body));
    const { facts } = JSON.parse(messages[0].content);
    const experiment = facts.find((fact: { milestone?: string }) => fact.milestone === "experiment");
    const text = JSON.stringify({ paragraphs: [{ text: "Ocurrió el 28 de diciembre de 2023.", factIds: [experiment.id] }], target: "inspector" });
    return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text }] });
  }));
  expect(await (await submit()).json()).toEqual({ answer: null });
});

it("omite el proveedor sin clave o si la pregunta o el cuerpo exceden su límite", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  expect(await (await submit()).json()).toEqual({ answer: null });
  vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba");
  expect(await (await submit(JSON.stringify({ question: "a".repeat(401) }))).json()).toEqual({ answer: null });
  expect(await (await submit(JSON.stringify({ question }).padStart(8193))).json()).toEqual({ answer: null });
  expect(fetchMock).not.toHaveBeenCalled();
});
