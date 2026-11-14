import type { ProviderResult } from "./types";

interface RetryOptions {
  /** Milisegundos que quedan antes del límite total de la petición. */
  remainingMs: () => number;
  /** Solo se reintenta si quedan al menos estos milisegundos. */
  minRemainingMs: number;
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: () => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Llama al proveedor y, ante un fallo pasajero, reintenta una sola vez si queda tiempo. */
export async function callWithRetry(call: () => Promise<ProviderResult>, options: RetryOptions): Promise<ProviderResult> {
  const first = await call();
  if (first.ok || !first.retryable || options.remainingMs() < options.minRemainingMs) return first;
  await (options.sleep ?? wait)(options.delayMs);
  options.onRetry?.();
  return call();
}
