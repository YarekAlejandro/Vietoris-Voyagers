import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import type { LlmProvider, ProviderId } from "./types";

export type { LlmProvider, ProviderId } from "./types";

const providers: Record<ProviderId, { call: LlmProvider; keyVar: string }> = {
  anthropic: { call: anthropicProvider, keyVar: "ANTHROPIC_API_KEY" },
  gemini: { call: geminiProvider, keyVar: "GEMINI_API_KEY" },
};

export interface ResolvedProvider {
  id: ProviderId;
  call: LlmProvider;
  apiKey: string;
  model?: string;
}

type Env = Record<string, string | undefined>;

/**
 * Elige el proveedor según las variables de entorno.
 * - `AI_PROVIDER=anthropic|gemini` lo fija; sin su key, no hay proveedor (se usa la plantilla).
 * - Sin `AI_PROVIDER`: Anthropic si hay `ANTHROPIC_API_KEY`; si no, Gemini si hay `GEMINI_API_KEY`.
 */
export function resolveProvider(env: Env): ResolvedProvider | null {
  const requested = env.AI_PROVIDER?.trim().toLowerCase();
  const model = env.AI_MODEL?.trim() || undefined;
  const pick = (id: ProviderId): ResolvedProvider | null => {
    const apiKey = env[providers[id].keyVar]?.trim();
    return apiKey ? { id, call: providers[id].call, apiKey, model } : null;
  };

  if (requested === "anthropic" || requested === "gemini") return pick(requested);
  if (requested) {
    console.error(`[interpret] AI_PROVIDER desconocido: ${requested}`);
    return null;
  }
  return pick("anthropic") ?? pick("gemini");
}
