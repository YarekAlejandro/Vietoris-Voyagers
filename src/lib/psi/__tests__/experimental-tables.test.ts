import { afterEach, expect, it, vi } from "vitest";
import { fetchPsiTableProfile, parseExperimentalTable } from "../experimental-tables";

const config = { base: "https://psi.nasa.gov/geode-py/ws", searchPath: "/repo/search" };
const table = { file_name: "PSI-69_Experimental table_FLEX.csv", file_size: 24776, version: 1, visible: true, restricted: false };
const csv = [
  "FLEX Identifier,Ambient pressure; mmHg,O initial ambient composition; mole fraction,CO initial ambient composition; mole fraction",
  "20CAL08,757.7,0.21,0", "20CAL10,762,0.21,0",
].join("\r\n");

afterEach(() => vi.unstubAllGlobals());

it("convierte concentraciones y presión desde columnas nombradas de FLEX", () => {
  const profile = parseExperimentalTable(csv, table.file_name);
  expect(profile?.oxygen_pct).toMatchObject({ value: 21, unit: "% O₂", source: "experimental-table" });
  expect(profile?.pressure_psia?.value).toEqual([757.7 * (14.6959488 / 760), 762 * (14.6959488 / 760)]);
  expect(parseExperimentalTable("Material,CO initial ambient composition; mole fraction\nFuel,0.21", "summary.csv")).toBeUndefined();
});

it("solo sigue el destino público verificado y mantiene la firma fuera de la caché", async () => {
  const signed = new URL(`https://psi-repo-prod.s3.amazonaws.com/psi-data/PSI-69/Experimental table/${table.file_name}`);
  signed.search = "Signature=synthetic&Expires=999";
  const fetch = vi.fn<(url: URL, options: RequestInit) => Promise<Response>>();
  fetch.mockResolvedValueOnce(new Response(signed.href, { headers: { "Content-Type": "text/html" } }));
  fetch.mockResolvedValueOnce(new Response(csv, { headers: { "Content-Type": "application/vnd.ms-excel" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchPsiTableProfile(config, "PSI-69", [table], AbortSignal.timeout(6000))).toHaveProperty("oxygen_pct");
  expect(fetch.mock.calls[0][0].searchParams.get("redirect")).toBe("false");
  expect(fetch.mock.calls[1][0].origin).toBe(signed.origin);
  expect(fetch.mock.calls[1][1].cache).toBe("no-store");
});

it("omite archivos grandes y redirecciones hacia servidores ajenos a PSI", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("https://example.com/data.csv", { headers: { "Content-Type": "text/html" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchPsiTableProfile(config, "PSI-69", [{ ...table, file_size: 300_001 }], AbortSignal.timeout(6000))).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
  expect(await fetchPsiTableProfile(config, "PSI-69", [table], AbortSignal.timeout(6000))).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
});
