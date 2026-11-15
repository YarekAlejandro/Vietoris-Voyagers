import { failed, succeeded, type LlmProvider, type ProviderArgs } from "./types";

// API de Anthropic (Messages) con fetch, sin SDK, como pide el brief.
export const anthropicDefaultModel = "claude-haiku-5-5";

export function buildAnthropicBody({ system, userContent, schema, model, maxOutputTokens }: Omit<ProviderArgs, "apiKey" | "signal">) {
  const selectedModel = model || anthropicDefaultModel;
  const supportsEffort = selectedModel === anthropicDefaultModel;
  return {
    model: selectedModel,
    max_tokens: maxOutputTokens ?? 400,
    // Sin razonamiento para que no consuma los 400 tokens; Haiku 5.5 lo permite con effort ≤ high.
    thinking: { type: "disabled" },
    output_config: { ...(supportsEffort ? { effort: "low" } : {}), format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: userContent }],
  };
}

/** Texto del primer bloque `text`, solo si el modelo terminó normalmente. */
export function extractAnthropicText(message: unknown): string | null {
  if (typeof message !== "object" || message === null) return null;
  const { stop_reason, content } = message as { stop_reason?: unknown; content?: unknown };
  if (stop_reason !== "end_turn") {
    console.error(`[interpret] Anthropic stop_reason: ${String(stop_reason)}`);
    return null;
  }
  if (!Array.isArray(content)) return null;
  const block = content.find((item): item is { type: "text"; text: string } =>
    typeof item === "object" && item !== null && item.type === "text" && typeof item.text === "string");
  return block?.text ?? null;
}

export const anthropicProvider: LlmProvider = async ({ apiKey, signal, ...args }) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(buildAnthropicBody(args)),
  });
  if (!response.ok) {
    console.error(`[interpret] Anthropic respondió ${response.status}`);
    // 429 (límite), 500/503 y 529 (sobrecarga) son pasajeros.
    return failed([429, 500, 503, 529].includes(response.status));
  }
  return succeeded(extractAnthropicText(await response.json()));
};
