export const jsonEventMediaType = "application/x-ndjson";

export async function readJsonEvents<T>(response: Response, onEvent: (event: T) => void) {
  if (!response.body) throw new Error("La respuesta no contiene datos.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      buffer += chunk.value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as T);
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer) as T);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
