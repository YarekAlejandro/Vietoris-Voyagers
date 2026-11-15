import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropicProvider, buildAnthropicBody, extractAnthropicText } from "../anthropic";
import { buildGeminiBody, extractGeminiText, geminiDefaultModel, geminiErrorLabel, geminiProvider } from "../gemini";
import { resolveProvider } from "../index";

const schema = { type: "object", properties: { paragraphs: { type: "array", items: { type: "string" } } } };
const args = { system: "sistema", userContent: "<payload>{}</payload>", schema };
const answer = JSON.stringify({ paragraphs: ["Texto."], caveats: [], fieldsUsed: [] });

// Forma de la respuesta de ejemplo de la guía de migración a la Interactions API.
const geminiCompleted = {
  id: "int_123",
  status: "completed",
  steps: [
    { type: "user_input", status: "done", content: [{ type: "text", text: "pregunta" }] },
    { type: "model_output", status: "done", content: [{ type: "text", text: answer }] },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolveProvider", () => {
  it("respeta AI_PROVIDER y exige la key de ese proveedor", () => {
    expect(resolveProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" })).toMatchObject({ id: "gemini", apiKey: "g" });
    expect(resolveProvider({ AI_PROVIDER: "Anthropic", ANTHROPIC_API_KEY: "a" })).toMatchObject({ id: "anthropic", apiKey: "a" });
    expect(resolveProvider({ AI_PROVIDER: "gemini", ANTHROPIC_API_KEY: "a" })).toBeNull();
  });

  it("detecta el proveedor por la key disponible y pasa AI_MODEL", () => {
    expect(resolveProvider({ ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g" })?.id).toBe("anthropic");
    expect(resolveProvider({ GEMINI_API_KEY: "g", AI_MODEL: "gemini-3.6-flash" })).toMatchObject({ id: "gemini", model: "gemini-3.6-flash" });
    expect(resolveProvider({})).toBeNull();
    expect(resolveProvider({ GEMINI_API_KEY: "  " })).toBeNull();
  });

  it("rechaza un proveedor desconocido", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(resolveProvider({ AI_PROVIDER: "otro", GEMINI_API_KEY: "g" })).toBeNull();
  });
});

describe("Gemini", () => {
  it("arma el cuerpo de la Interactions API", () => {
    expect(buildGeminiBody(args)).toEqual({
      model: geminiDefaultModel,
      system_instruction: "sistema",
      input: "<payload>{}</payload>",
      generation_config: { max_output_tokens: 600, thinking_level: "minimal" },
      response_format: { type: "text", mime_type: "application/json", schema },
    });
    expect(buildGeminiBody({ ...args, model: "gemini-3.6-flash" }).model).toBe("gemini-3.6-flash");
  });

  it("extrae el texto del último model_output solo si la interacción terminó", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(extractGeminiText(geminiCompleted)).toBe(answer);
    expect(extractGeminiText({ ...geminiCompleted, status: "incomplete" })).toBeNull();
    expect(extractGeminiText({ ...geminiCompleted, status: "failed" })).toBeNull();
    expect(extractGeminiText({ status: "completed", steps: [geminiCompleted.steps[0]] })).toBeNull();
    expect(extractGeminiText({ status: "completed", candidates: [] })).toBeNull();
    expect(extractGeminiText(null)).toBeNull();
  });

  it("manda la key en el header y devuelve el texto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(geminiCompleted));
    vi.stubGlobal("fetch", fetchMock);
    const result = await geminiProvider({ ...args, apiKey: "clave", signal: new AbortController().signal });
    expect(result).toEqual({ ok: true, text: answer });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(init.headers["x-goog-api-key"]).toBe("clave");
    expect(JSON.parse(init.body).stream).toBe(true);
    expect(String(url)).not.toContain("clave");
  });

  it.each([
    [400, { error: { code: "safety", message: "bloqueado" } }, false],
    [401, { error: { code: "authentication", message: "key inválida" } }, false],
    [429, { error: { code: "quota_exceeded", message: "cuota diaria" } }, false],
    [429, { error: { code: "rate_limit_exceeded", message: "por minuto" } }, true],
    [499, { error: { code: 499, status: "CANCELLED" } }, true],
    [503, { error: { code: "service_unavailable", message: "saturado" } }, true],
  ])("falla ante un %i (%j) sin lanzar error ni registrar la key", async (status, body, retryable) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, status)));
    await expect(geminiProvider({ ...args, apiKey: "clave-secreta", signal: new AbortController().signal })).resolves.toEqual({ ok: false, retryable });
    expect(errors.mock.calls.flat().join(" ")).toContain(String(status));
    expect(errors.mock.calls.flat().join(" ")).not.toContain("clave-secreta");
  });

  it("ensambla el JSON validable con los fragmentos SSE de salida del modelo", async () => {
    const frames = [
      { event_type: "step.start", index: 0, step: { type: "thought" } },
      { event_type: "step.delta", index: 0, delta: { type: "thought_summary", text: "ignorar" } },
      { event_type: "step.start", index: 1, step: { type: "model_output", content: [{ type: "text", text: answer.slice(0, 5) }] } },
      { event_type: "step.delta", index: 1, delta: { type: "text", text: answer.slice(5, 11) } },
      { event_type: "step.delta", index: 1, delta: { type: "text", text: answer.slice(11) } },
      { event_type: "interaction.completed", interaction: { status: "completed" } },
    ].map((item) => `event: ${item.event_type}\r\ndata: ${JSON.stringify(item)}\r\n\r\n`).join("");
    const encoder = new TextEncoder();
    const sse = new ReadableStream<Uint8Array>({ start(controller) {
      for (const offset of Array.from({ length: Math.ceil(frames.length / 37) }, (_, i) => i * 37)) {
        controller.enqueue(encoder.encode(frames.slice(offset, offset + 37)));
      }
      controller.close();
    } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(sse, { headers: { "Content-Type": "text/event-stream" } })));
    await expect(geminiProvider({ ...args, apiKey: "clave", signal: new AbortController().signal })).resolves.toEqual({ ok: true, text: answer });
  });
});

describe("geminiErrorLabel", () => {
  it("lee el error documentado de Interactions y el arreglo que Google devuelve con una key inválida", () => {
    expect(geminiErrorLabel({ error: { code: "safety", message: "bloqueado" } })).toBe("safety");
    expect(geminiErrorLabel([{ error: {
      code: 400, message: "API key not valid.", status: "INVALID_ARGUMENT",
      details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID" }],
    } }])).toBe("INVALID_ARGUMENT, API_KEY_INVALID");
    expect(geminiErrorLabel("texto")).toBe("");
    expect(geminiErrorLabel([])).toBe("");
  });
});

describe("Anthropic", () => {
  it("conserva la petición original y lee el bloque de texto", async () => {
    expect(buildAnthropicBody(args)).toMatchObject({
      model: "claude-haiku-5-5", max_tokens: 400, thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema", schema } },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ stop_reason: "end_turn", content: [{ type: "text", text: answer }] })));
    await expect(anthropicProvider({ ...args, apiKey: "a", signal: new AbortController().signal })).resolves.toEqual({ ok: true, text: answer });
  });

  it("descarta respuestas cortadas o rechazadas y los errores HTTP", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(extractAnthropicText({ stop_reason: "max_tokens", content: [{ type: "text", text: answer }] })).toBeNull();
    expect(extractAnthropicText({ stop_reason: "refusal", content: [] })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ type: "error" }, 401)));
    await expect(anthropicProvider({ ...args, apiKey: "a", signal: new AbortController().signal })).resolves.toEqual({ ok: false, retryable: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ type: "error" }, 529)));
    await expect(anthropicProvider({ ...args, apiKey: "a", signal: new AbortController().signal })).resolves.toEqual({ ok: false, retryable: true });
  });
});
