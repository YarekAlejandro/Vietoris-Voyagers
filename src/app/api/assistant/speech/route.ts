import { originalSpeechTimings, prepareNarration, speechTimings } from "../../../../lib/llm/assistant-narration";

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
    const { text, includeTimings } = JSON.parse(content + decoder.decode()) ?? {};
    return typeof text === "string" && text.length <= maxTextLength && text.trim() ? { text, timed: includeTimings === true } : null;
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
  const input = await readText(request);
  if (!input) return new Response(null, { status: 400 });

  const now = Date.now();
  if (now >= rate.until) rate = { count: 0, until: now + windowMs };
  if (rate.count >= maxRequests) return new Response(null, { status: 429 });
  rate.count += 1;

  try {
    const narration = await prepareNarration(input.text, request.signal);
    if (!narration.text) return new Response(null, { status: 422 });
    const format = input.timed ? "with-timestamps" : "stream";
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/${format}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: input.timed ? "application/json" : "audio/mpeg" },
      body: JSON.stringify({ text: narration.text, model_id: "eleven_flash_v2_5", language_code: "es",
        voice_settings: { stability: 0.5 } }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
      cache: "no-store",
    });
    if (!upstream.ok || !upstream.body) {
      console.warn(`[assistant/speech] ElevenLabs respondió ${upstream.status}`);
      return new Response(null, { status: upstream.status === 429 ? 429 : 502 });
    }
    if (input.timed) {
      const result = await upstream.json();
      if (typeof result.audio_base64 !== "string" || !result.audio_base64) return new Response(null, { status: 502 });
      const ends = speechTimings(narration.text, result.alignment);
      const starts = speechTimings(narration.text, result.alignment, "start");
      return Response.json({
        audioBase64: result.audio_base64,
        characterEndTimesSeconds: originalSpeechTimings(narration.parts, ends),
        spokenText: narration.text,
        spokenStartTimesSeconds: starts,
        spokenEndTimesSeconds: ends,
        captionText: narration.captionText,
        captionStartTimesSeconds: originalSpeechTimings(narration.captionParts, starts, "start"),
        captionEndTimesSeconds: originalSpeechTimings(narration.captionParts, ends),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!upstream.headers.get("content-type")?.startsWith("audio/")) return new Response(null, { status: 502 });
    return new Response(upstream.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
