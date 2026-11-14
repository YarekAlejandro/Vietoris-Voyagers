import type { LlmProvider, ProviderArgs } from "./types";

// Google Gemini, Interactions API (la que la documentación recomienda en lugar de generateContent).
// https://aistudio.google.com/docs/migrate-to-interactions
export const geminiDefaultModel = "gemini-3.5-flash-lite";
const endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";
// Fija la revisión del formato de respuesta que usan los ejemplos de la documentación.
const apiRevision = "2026-05-20";

export function buildGeminiBody({ system, userContent, schema, model }: Omit<ProviderArgs, "apiKey" | "signal">) {
  return {
    model: model || geminiDefaultModel,
    system_instruction: system,
    input: userContent,
    generation_config: {
      // En Gemini el límite incluye los tokens de razonamiento.
      max_output_tokens: 600,
      thinking_level: "minimal",
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

export const geminiProvider: LlmProvider = async ({ apiKey, signal, ...args }) => {
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "x-goog-api-key": apiKey,
      "Api-Revision": apiRevision,
      "content-type": "application/json",
    },
    body: JSON.stringify(buildGeminiBody(args)),
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
    return null;
  }
  return extractGeminiText(await response.json());
};
