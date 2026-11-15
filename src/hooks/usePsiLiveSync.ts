import { useEffect, useState } from "react";
import { useAetherStore } from "../store/useAetherStore";
import type { PsiArea, PsiSearchResponse } from "../types/psi-live";

async function searchPsi(area: PsiArea, term: string, signal: AbortSignal, refresh: boolean): Promise<PsiSearchResponse> {
  const params = new URLSearchParams({ area });
  if (term) params.set("q", term);
  const response = await fetch(`/api/psi/search?${params}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
    ...(refresh ? { cache: "no-cache" } : {}),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("PSI no disponible");
  return response.json();
}

export function usePsiLiveSync() {
  const area = useAetherStore((state) => state.psiArea);
  const query = useAetherStore((state) => state.query);
  const receive = useAetherStore((state) => state.receivePsi);
  const [revision, setRevision] = useState(0);
  const [browserOffline, setBrowserOffline] = useState(false);
  const [catalogRequest, setCatalogRequest] = useState<{ area: PsiArea; revision: number; offline: boolean } | null>(null);
  const term = query.trim();

  useEffect(() => {
    const controller = new AbortController();
    searchPsi(area, "", controller.signal, revision > 0).then((response) => {
      if (controller.signal.aborted) return;
      receive(area, "", response);
      setCatalogRequest({ area, revision, offline: false });
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogRequest({ area, revision, offline: true });
    });
    return () => controller.abort();
  }, [area, receive, revision]);

  useEffect(() => {
    if ([...term].length < 3 || [...term].length > 80 || /\p{Cc}/u.test(query)) return;
    const controller = new AbortController();
    const delay = window.setTimeout(() => {
      searchPsi(area, term, controller.signal, revision > 0).then((response) => {
        if (!controller.signal.aborted) receive(area, term, response);
      }).catch(() => {
        // La búsqueda semántica local sigue disponible.
      });
    }, 400);
    return () => { window.clearTimeout(delay); controller.abort(); };
  }, [area, query, term, receive, revision]);

  useEffect(() => {
    const reconnect = () => {
      setBrowserOffline(false);
      setRevision((previous) => previous + 1);
    };
    const disconnect = () => setBrowserOffline(true);
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);
    return () => {
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", disconnect);
    };
  }, []);

  const pending = catalogRequest?.area !== area || catalogRequest.revision !== revision;
  return {
    pending,
    offline: browserOffline || (!pending && catalogRequest?.offline === true),
    refresh: () => setRevision((previous) => previous + 1),
  };
}
