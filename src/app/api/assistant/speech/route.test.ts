import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const original = "**Saffire-VI** usó 20 cm/s. Comparte material SIBAL.";
const segments = ["Saffire seis usó veinte centímetros por segundo.", "Comparte material SIBAL."];
const received = (value: string) => new Request("http://localhost/api/assistant/speech", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: value, includeTimings: true }),
});

function audioResponse(text: string) {
  const characters = Array.from(text);
  return Response.json({ audio_base64: "YXVkaW8=", alignment: {
    characters,
    character_start_times_seconds: characters.map((_, index) => index / 20),
    character_end_times_seconds: characters.map((_, index) => (index + 1) / 20),
  } });
}

describe("narración del asistente", () => {
  beforeEach(() => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "mock-gemini");
    vi.stubEnv("ELEVENLABS_API_KEY", "mock-speech");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "mock-voice");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sintetiza el guion del modelo configurado y devuelve tiempos para las palabras y la respuesta original", async () => {
    const modelScript = ["Saffire seis usó 20 cm/s.", segments[1]];
    const mock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ status: "completed", steps: [{ type: "model_output", content: [{
        type: "text", text: JSON.stringify({ segments: modelScript }),
      }] }] }))
      .mockResolvedValueOnce(audioResponse(segments.join(" ")));
    vi.stubGlobal("fetch", mock);

    const response = await POST(received(original));
    expect(response.status).toBe(200);
    expect(mock.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
    expect(mock.mock.calls[1][0]).toContain("api.elevenlabs.io");
    expect(JSON.parse(String(mock.mock.calls[1][1]?.body)).text).toBe(segments.join(" "));
    expect(JSON.parse(String(mock.mock.calls[1][1]?.body))).toMatchObject({
      model_id: "eleven_flash_v2_5", language_code: "es", voice_settings: { stability: 0.35, speed: 1.15 },
    });
    const result = await response.json();
    expect(result.spokenText).toBe(segments.join(" "));
    expect(result.spokenStartTimesSeconds).toHaveLength(result.spokenText.length);
    expect(result.captionText).toBe(modelScript.join(" "));
    expect(result.captionStartTimesSeconds).toHaveLength(result.captionText.length);
    expect(result.captionEndTimesSeconds[modelScript[0].length - 1]).toBe(segments[0].length / 20);
    expect(result.characterEndTimesSeconds).toHaveLength(original.length);
    expect(result.characterEndTimesSeconds[original.indexOf("Comparte") - 1]).toBe(segments[0].length / 20);
  });

  it("limpia símbolos y unidades localmente si falla el modelo", async () => {
    const safeText = "El oxígeno aumentó más tres punto ocho puntos porcentuales a veinte centímetros por segundo.";
    const mock = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(audioResponse(safeText));
    vi.stubGlobal("fetch", mock);
    const response = await POST(received("**El O₂** aumentó +3.8 pp a 20 cm/s. 🔥"));
    expect(response.status).toBe(200);
    expect(JSON.parse(String(mock.mock.calls[1][1]?.body)).text).toBe(safeText);
    expect((await response.json()).spokenText).toBe(safeText);
  });

  it("mantiene pausas, convierte fechas, signos y códigos, y descarta decoración", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const text = "¿Saffire seis fue el catorce de junio de dos mil dieciséis? ge eme te cuatro cinco te cuatro: veinticuatro por ciento igual a veinticuatro por ciento.";
    const mock = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => audioResponse(JSON.parse(String(init?.body)).text));
    vi.stubGlobal("fetch", mock);
    const result = await POST(received("¿Saffire-VI fue el 2016-06-14?\n_GMT45-T4_: 24 %=24 %. 🔥"));
    const { spokenText } = await result.json();
    expect(spokenText).toBe(text);
  });

  it("desarrolla los nombres con sus artículos y quita las pausas ornamentales", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const mock = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => audioResponse(JSON.parse(String(init?.body)).text));
    vi.stubGlobal("fetch", mock);
    const result = await POST(received("El ISS... recibió polvos de PMMA.\nLos datos de IIS y de la EEI coinciden."));
    const { spokenText } = await result.json();
    expect(spokenText).toBe("La Estación Espacial Internacional recibió polvos de polimetilmetacrilato. Los datos de la Estación Espacial Internacional y de la Estación Espacial Internacional coinciden.");
  });

  it("enlaza una oración partida y conserva la pausa entre párrafos", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(async (_url, init) => audioResponse(JSON.parse(String(init?.body)).text)));
    const result = await POST(received("La llama se propagó\nen la muestra\n\nDespués se apagó…"));
    const { spokenText } = await result.json();
    expect(spokenText).toBe("La llama se propagó en la muestra. Después se apagó.");
  });
});
