import { setTimeout as delay } from "node:timers/promises";
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

type ValidatedResult<T> = { status: "ok"; value: T } | { status: "invalid" | "unavailable" };

/** Repite una salida inválida una vez. Los fallos de transporte tienen dos esperas crecientes. */
export async function requestValidated<T>(
  call: (feedback: string) => Promise<ProviderResult>,
  validate: (data: unknown) => T | null,
  signal: AbortSignal,
): Promise<ValidatedResult<T>> {
  let invalidAttempts = 0;
  let transportRetries = 0;
  while (!signal.aborted) {
    try {
      const response = await call(invalidAttempts ? "La respuesta anterior no pasó la validación. Usa únicamente los datos y el esquema indicados." : "");
      if (signal.aborted) return { status: "unavailable" };
      if (!response.ok && !response.retryable) return { status: "unavailable" };
      if (response.ok) {
        let value: T | null = null;
        try {
          value = validate(JSON.parse(response.text));
        } catch {
          // JSON incompleto u objeto fuera del esquema.
        }
        if (value !== null) return { status: "ok", value };
        invalidAttempts += 1;
        if (invalidAttempts === 2) return { status: "invalid" };
        continue;
      }
    } catch {
      // Un cierre de red puede ser transitorio. La cancelación del cliente termina el bucle.
    }
    if (signal.aborted || transportRetries === 2) break;
    try {
      await delay(700 * 2 ** transportRetries, undefined, { signal });
      transportRetries += 1;
    } catch {
      break;
    }
  }
  return { status: "unavailable" };
}
