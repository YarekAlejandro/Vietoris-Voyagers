// Contrato común de los proveedores de LLM para «Interpretar».
// Cada adaptador solo transporta: arma la petición, la manda y devuelve el texto JSON del modelo.
// La validación (forma del JSON y números contra el payload) la hace la ruta, igual para todos.

export type ProviderId = "anthropic" | "gemini";

export interface ProviderArgs {
  system: string;
  userContent: string;
  schema: Record<string, unknown>;
  model?: string;
  apiKey: string;
  signal: AbortSignal;
}

/** Devuelve el texto JSON del modelo, o `null` si la llamada falló. Nunca registra la API key. */
export type LlmProvider = (args: ProviderArgs) => Promise<string | null>;
