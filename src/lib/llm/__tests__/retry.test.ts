import { describe, expect, it, vi } from "vitest";
import { callWithRetry } from "../retry";
import type { ProviderResult } from "../types";

const ok: ProviderResult = { ok: true, text: "{}" };
const transient: ProviderResult = { ok: false, retryable: true };
const permanent: ProviderResult = { ok: false, retryable: false };
const options = (remaining: number) => ({ remainingMs: () => remaining, minRemainingMs: 4000, delayMs: 800, sleep: vi.fn().mockResolvedValue(undefined) });

describe("callWithRetry", () => {
  it("reintenta una sola vez un fallo pasajero si queda tiempo", async () => {
    const call = vi.fn<() => Promise<ProviderResult>>().mockResolvedValueOnce(transient).mockResolvedValueOnce(ok);
    const opts = options(9000);
    await expect(callWithRetry(call, opts)).resolves.toEqual(ok);
    expect(call).toHaveBeenCalledTimes(2);
    expect(opts.sleep).toHaveBeenCalledWith(800);
  });

  it("no reintenta más de una vez", async () => {
    const call = vi.fn<() => Promise<ProviderResult>>().mockResolvedValue(transient);
    await expect(callWithRetry(call, options(9000))).resolves.toEqual(transient);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("no reintenta fallos permanentes, éxitos ni cuando falta tiempo", async () => {
    for (const [first, remaining] of [[permanent, 9000], [ok, 9000], [transient, 3000]] as const) {
      const call = vi.fn<() => Promise<ProviderResult>>().mockResolvedValue(first);
      await expect(callWithRetry(call, options(remaining))).resolves.toEqual(first);
      expect(call).toHaveBeenCalledTimes(1);
    }
  });
});
