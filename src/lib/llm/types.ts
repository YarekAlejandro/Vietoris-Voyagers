// Contrato común de los proveedores de LLM para «Interpretar».
// Cada adaptador solo transporta: arma la petición, la manda y devuelve el texto JSON del modelo.
// La validación (forma del JSON y números contra el payload) la hace la ruta, igual para todos.

export type ProviderId = "anthropic" | "gemini";

export interface ProviderArgs {
  system: string;
  userContent: string;
  schema: Record<string, unknown>;
  model?: string;
  maxOutputTokens?: number;
  apiKey: string;
  signal: AbortSignal;
}

/**
 * Texto JSON del modelo, o un fallo. `retryable` marca fallos pasajeros (saturación, límite por
 * minuto) que vale la pena reintentar una vez. Nunca se registra la API key.
 */
export type ProviderResult = { ok: true; text: string } | { ok: false; retryable: boolean };

export type LlmProvider = (args: ProviderArgs) => Promise<ProviderResult>;

export const failed = (retryable = false): ProviderResult => ({ ok: false, retryable });
export const succeeded = (text: string | null): ProviderResult => (text ? { ok: true, text } : failed());
