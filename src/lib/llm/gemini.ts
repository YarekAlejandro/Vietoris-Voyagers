import { failed, succeeded, type LlmProvider, type ProviderArgs } from "./types";

// Google Gemini, Interactions API (la que la documentación recomienda en lugar de generateContent).
// https://aistudio.google.com/docs/migrate-to-interactions
export const geminiDefaultModel = "gemini-3.5-flash-lite";
const endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";
// Fija la revisión del formato de respuesta que usan los ejemplos de la documentación.
const apiRevision = "2026-05-20";

export function buildGeminiBody({ system, userContent, schema, model, maxOutputTokens }: Omit<ProviderArgs, "apiKey" | "signal">) {
  const selectedModel = model || geminiDefaultModel;
  return {
    model: selectedModel,
    system_instruction: system,
    input: userContent,
    generation_config: {
      // En Gemini el límite incluye los tokens de razonamiento.
      max_output_tokens: maxOutputTokens ?? 600,
      ...(selectedModel === geminiDefaultModel ? { thinking_level: "minimal" } : {}),
    },
    response_format: { type: "text", mime_type: "application/json", schema },
  };
}

type Step = { type?: unknown; content?: unknown };

/** Texto del último step `model_output`, solo si la interacción terminó (`status: "completed"`). */
export function extractGeminiText(interaction: unknown): string | null {
  if (typeof interaction !== "object" || interaction === null) return null;
  const { status, steps } = interaction as { status?: unknown; steps?: unknown };
  if (status !== "completed") {
    console.error(`[interpret] Gemini status: ${String(status)}`);
    return null;
  }
  if (!Array.isArray(steps)) return null;
  const output = [...steps].reverse().find((step: Step) => typeof step === "object" && step !== null && step.type === "model_output") as Step | undefined;
  if (!output || !Array.isArray(output.content)) return null;
  const text = output.content
    .filter((item): item is { type: "text"; text: string } =>
      typeof item === "object" && item !== null && item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("");
  return text || null;
}

/**
 * Etiqueta corta de un error de Google para el log, sin el mensaje completo.
 * Interactions documenta `{ error: { code: "safety" } }`; con una key inválida Google responde
 * `[{ error: { code: 400, status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } }]`.
 */
export function geminiErrorLabel(body: unknown): string {
  const first = Array.isArray(body) ? body[0] : body;
  if (typeof first !== "object" || first === null) return "";
  const error = (first as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return "";
  const { code, status, details } = error as { code?: unknown; status?: unknown; details?: unknown };
  const reason = Array.isArray(details)
    ? details.map((detail) => (typeof detail === "object" && detail !== null ? (detail as { reason?: unknown }).reason : undefined))
      .find((value) => typeof value === "string")
    : undefined;
  return [code, status, reason].filter((value): value is string => typeof value === "string").join(", ");
}

function retryableStatus(status: unknown) {
  return /^(?:cancelled|canceled|deadline_exceeded|gateway_timeout|service_unavailable|rate_limit_exceeded|too_many_requests|api_error|unavailable|aborted|499|500|502|503|504)$/i.test(String(status));
}

async function readGeminiStream(stream: ReadableStream<Uint8Array>) {
  type Event = {
    event_type?: string; type?: string; status?: string; index?: number; step?: { type?: string; content?: { type?: string; text?: string }[] };
    delta?: { type?: string; text?: string }; interaction?: { status?: string };
    error?: { code?: unknown; status?: unknown };
  };
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outputIndex: number | undefined;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return failed(true);
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 256_000) return failed();
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const lines = frame.split(/\r?\n/);
        const payload = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!payload || payload === "[DONE]") continue;
        const event: Event = JSON.parse(payload);
        const eventType = event.event_type ?? event.type ?? lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        if (eventType === "error") return failed(retryableStatus(event.error?.code) || retryableStatus(event.error?.status));
        if (eventType === "interaction.status_update" && retryableStatus(event.status)) return failed(true);
        if (eventType === "step.start" && event.step?.type === "model_output") {
          outputIndex = event.index;
          text = event.step.content?.filter((item) => item.type === "text" && typeof item.text === "string").map((item) => item.text).join("") ?? "";
        }
        if (eventType === "step.delta" && outputIndex !== undefined && event.index === outputIndex &&
          event.delta?.type === "text" && typeof event.delta.text === "string") {
          text += event.delta.text;
          if (text.length > 64_000) return failed();
        }
        if (eventType === "interaction.completed") {
          return event.interaction?.status === "completed" ? succeeded(text) : failed(retryableStatus(event.interaction?.status));
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export const geminiProvider: LlmProvider = async ({ apiKey, signal, ...args }) => {
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "x-goog-api-key": apiKey,
      "Api-Revision": apiRevision,
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({ ...buildGeminiBody(args), stream: true }),
  });
  if (!response.ok) {
    // 400 (filtro de seguridad o petición inválida), 401/403 (key), 429 (límite del tier gratuito).
    let label = "";
    try {
      label = geminiErrorLabel(await response.json());
    } catch {
      // El cuerpo del error no es JSON; basta con el status.
    }
    console.error(`[interpret] Gemini respondió ${response.status}${label ? ` (${label})` : ""}`);
    // 503 (saturación) y 429 por minuto son pasajeros; la cuota diaria agotada no lo es.
    const retryable = [499, 500, 502, 503, 504].includes(response.status) ||
      label.split(", ").some(retryableStatus) ||
      (response.status === 429 && !label.includes("quota_exceeded"));
    return failed(retryable);
  }
  if (response.body && response.headers.get("content-type")?.includes("text/event-stream")) return readGeminiStream(response.body);
  const json = await response.json();
  if (retryableStatus(json?.status)) return failed(true);
  return succeeded(extractGeminiText(json));
};
