const maxTextLength = 2600;
const maxRequestBytes = 16_384;
const windowMs = 60_000;
const maxRequests = 12;
let rate = { count: 0, until: 0 };

async function readText(request: Request) {
  if (!request.body || Number(request.headers.get("content-length")) > maxRequestBytes) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let content = "";
  let bytes = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      bytes += chunk.value.byteLength;
      if (bytes > maxRequestBytes) {
        void reader.cancel().catch(() => {});
        return null;
      }
      content += decoder.decode(chunk.value, { stream: true });
    }
    const { text } = JSON.parse(content + decoder.decode()) ?? {};
    return typeof text === "string" && text.length <= maxTextLength && text.trim() ? text.trim() : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey || !voiceId || !/^[A-Za-z0-9_-]{1,64}$/.test(voiceId)) return new Response(null, { status: 503 });
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return new Response(null, { status: 400 });
  }
  const text = await readText(request);
  if (!text) return new Response(null, { status: 400 });

  const now = Date.now();
  if (now >= rate.until) rate = { count: 0, until: now + windowMs };
  if (rate.count >= maxRequests) return new Response(null, { status: 429 });
  rate.count += 1;

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
      cache: "no-store",
    });
    if (!upstream.ok || !upstream.body || !upstream.headers.get("content-type")?.startsWith("audio/")) {
      console.warn(`[assistant/speech] ElevenLabs respondió ${upstream.status}`);
      return new Response(null, { status: upstream.status === 429 ? 429 : 502 });
    }
    return new Response(upstream.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
