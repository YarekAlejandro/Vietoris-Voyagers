import { jsonEventMediaType } from "./json-events";

export function streamEvents<T>(request: Request, run: (send: (event: T) => void, signal: AbortSignal) => Promise<void>) {
  const disconnect = new AbortController();
  const signal = AbortSignal.any([request.signal, disconnect.signal]);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: T | { type: "keepalive" }) => {
        if (!signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const heartbeat = setInterval(() => send({ type: "keepalive" }), 5_000);
      send({ type: "keepalive" });
      void run(send, signal).then(
        () => { if (!disconnect.signal.aborted) controller.close(); },
        () => { if (!disconnect.signal.aborted) controller.error(new Error("El flujo terminó antes de completarse.")); },
      ).finally(() => clearInterval(heartbeat));
    },
    cancel() { disconnect.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": `${jsonEventMediaType}; charset=utf-8`, "Cache-Control": "no-store, no-transform" } });
}
