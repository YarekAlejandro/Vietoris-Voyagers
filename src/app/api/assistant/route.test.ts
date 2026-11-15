import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const call = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/llm", () => ({ resolveProvider: () => ({ call, apiKey: "mock" }) }));

const submit = (body: string) => POST(new Request("http://localhost/api/assistant", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  call.mockReset();
});

it("clasifica una pregunta de navegación con la función activada", async () => {
  vi.stubEnv("ENABLE_ASSISTANT_AI", "true");
  call.mockResolvedValue({ ok: true, text: '{"intent":"graph"}' });
  const question = "¿En qué zona se ven las conexiones?";
  const response = await submit(JSON.stringify({ question }));

  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ intent: "graph" });
  expect(call).toHaveBeenCalledWith(expect.objectContaining({ userContent: JSON.stringify({ question }) }));
});

it.each([
  '{"intent":"https://example.com"}',
  '{"intent":"graph","answer":"Texto generado"}',
  '{"intent":"none"}',
])("devuelve null para una salida sin destino permitido (%s)", async (text) => {
  vi.stubEnv("ENABLE_ASSISTANT_AI", "true");
  call.mockResolvedValue({ ok: true, text });
  const response = await submit(JSON.stringify({ question: "¿Dónde está la ficha?" }));

  expect(await response.json()).toEqual({ intent: null });
});

it("omite la consulta remota si está desactivada o la petición excede un límite", async () => {
  vi.stubEnv("ENABLE_ASSISTANT_AI", "false");
  const body = JSON.stringify({ question: "¿Dónde está la ficha?" });
  expect(await (await submit(body)).json()).toEqual({ intent: null });

  vi.stubEnv("ENABLE_ASSISTANT_AI", "true");
  expect(await (await submit(JSON.stringify({ question: "a".repeat(401) }))).json()).toEqual({ intent: null });
  expect(await (await submit(body.padStart(2049))).json()).toEqual({ intent: null });
  expect(call).not.toHaveBeenCalled();
});
