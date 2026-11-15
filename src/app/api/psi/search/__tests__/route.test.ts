import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import indexFixture from "../../../../../../fixtures/psi/search.json";
import type { PsiSearchResponse } from "../../../../../types/psi-live";
import { GET } from "../route";

const searchPage = { ...indexFixture, hits: { ...indexFixture.hits, total: indexFixture.hits.hits.length } };
const literature = { results: [{ id: 20250010653, title: "Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket" }] };
const request = (q: string, area = "combustion") => new Request(`http://localhost/api/psi/search?${new URLSearchParams({ q, area })}`);

beforeEach(() => {
  vi.stubEnv("PSI_API_BASE", "https://psi.nasa.gov/geode-py/ws");
  vi.stubEnv("PSI_SEARCH_PATH", "/repo/search");
  vi.stubEnv("ENABLE_PSI_TABLES", "false");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/psi/search", () => {
  it("devuelve un listado PSI y literatura NTRS separados con caché de una hora", async () => {
    const fetch = vi.fn(async (url: URL, _init: RequestInit) => Response.json(
      url.hostname === "psi.nasa.gov" ? searchPage : literature,
    ));
    vi.stubGlobal("fetch", fetch);
    const response = await GET(request("  combustion  "));
    const body: PsiSearchResponse = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    expect(body).toMatchObject({ status: "live", sources: { psi: { ok: true, count: 2 }, ntrs: { ok: true, count: 1 } } });
    expect(body.investigations.map(({ accession }) => accession)).toEqual(["PSI-22", "PSI-10"]);
    expect(body.literature[0].url).toBe("https://ntrs.nasa.gov/citations/20250010653");
    expect(fetch.mock.calls.find(([url]) => url.pathname.endsWith("/repo/search"))?.[0].searchParams.get("term")).toBe("combustion");
    expect(fetch.mock.calls.find(([url]) => url.hostname === "ntrs.nasa.gov")?.[0].searchParams.get("q")).toBe("combustion microgravity combustion");
    for (const [url, options] of fetch.mock.calls) {
      expect(["psi.nasa.gov", "ntrs.nasa.gov"]).toContain(url.hostname);
      expect(options).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
      expect(options).toMatchObject(url.pathname.includes("/repo/investigations/")
        ? { cache: "no-store" } : { next: { revalidate: 3600 } });
      expect(url.pathname).not.toContain("/download");
    }
  });

  it("si NTRS agota su tiempo conserva los estudios PSI y responde parcial", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
      if (url.hostname === "ntrs.nasa.gov") throw new DOMException("timeout", "TimeoutError");
      return Response.json(searchPage);
    }));
    const response = await GET(request("saffire"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "partial", sources: {
      psi: { ok: true, count: 2 }, ntrs: { ok: false, count: 0, error: "timeout" },
    }, literature: [] });
  });

  it("limita una consulta por accesión a su ficha aunque PSI devuelva menciones cruzadas", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => Response.json(
      url.hostname === "ntrs.nasa.gov" ? literature : searchPage,
    )));
    const response = await GET(request("psi-22"));
    const body: PsiSearchResponse = await response.json();
    expect(body.investigations.map(({ accession }) => accession)).toEqual(["PSI-22"]);
  });

  it("usa el snapshot si falla PSI y conserva la literatura disponible", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
      if (url.hostname === "psi.nasa.gov") throw new DOMException("timeout", "TimeoutError");
      return Response.json(literature);
    }));
    const response = await GET(request("PSI-25"));
    const body: PsiSearchResponse = await response.json();
    expect(body.status).toBe("snapshot");
    expect(body.snapshotGeneratedAt).toBeTruthy();
    expect(body.investigations.map(({ accession }) => accession)).toEqual(["PSI-25"]);
    expect(body.literature).toHaveLength(1);
    expect(body.sources.psi.error).toBe("timeout");
  });

  it("en caída total devuelve el snapshot disponible incluso cuando el término no coincide", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await GET(request("sin coincidencia 93jkd2"));
    const body: PsiSearchResponse = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("snapshot");
    expect(body.investigations.length).toBeGreaterThan(0);
    expect(body.investigations.every(({ researchArea }) => researchArea === "Combustion Science")).toBe(true);
    expect(body.literature).toEqual([]);
  });

  it.each(["a".repeat(81), "flame\nsmoke"])("rechaza una consulta inválida sin consultar a NASA", async (q) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await GET(request(q));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
