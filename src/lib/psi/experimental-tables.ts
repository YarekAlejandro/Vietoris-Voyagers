import type { PsiProfile, PsiQuantity } from "../../types/psi-live";
import type { PsiApiConfig, PsiTableMetadata } from "./psi-api";

const tableLimit_bytes = 300_000;
const headers = { "User-Agent": "AETHER-SI/0.1 (NASA PSI experimental tables)" };
const tableOrigin = "https://psi-repo-prod.s3.amazonaws.com";

async function limitedText(response: Response, limit_bytes: number) {
  const body = response.body;
  if (!body) throw new Error("Respuesta sin contenido");
  if (Number(response.headers.get("content-length")) > limit_bytes) {
    await body.cancel();
    throw new Error("Respuesta demasiado grande");
  }
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length_bytes = 0;
  let text = "";
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      length_bytes += chunk.value.byteLength;
      if (length_bytes > limit_bytes) throw new Error("Respuesta demasiado grande");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function csvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"') {
      if (inQuotes && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && (char === "," || char === "\n" || char === "\r")) {
      row.push(cell.trim());
      cell = "";
      if (char === ",") continue;
      if (char === "\r" && csv[index + 1] === "\n") index += 1;
      rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  if (inQuotes) return [];
  if (row.length || cell) rows.push([...row, cell.trim()]);
  return rows;
}

// Columnas verificadas en BASS-II, FLEX y Saffire-II; también se acepta presión absoluta con unidad explícita.
const oxygenColumns = new Map([["calibrated initial o2 % by vol", 1],
  ["o initial ambient composition; mole fraction", 100], ["percent o2 (note 1)", 1]]);
const pressureColumns = new Map([["ambient pressure; mmhg", 14.6959488 / 760],
  ["ambient pressure; psia", 1], ["ambient pressure (psia)", 1], ["ambient pressure (kpa)", 1 / 6.894757]]);

export function parseExperimentalTable(csv: string, filename: string): PsiProfile | undefined {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(csv)) return;
  const [columns, ...rows] = csvRows(csv);
  if (!columns) return;
  const readRange = (units: ReadonlyMap<string, number>, unit: PsiQuantity["unit"], valid: (value: number) => boolean) => {
    const index = columns.findIndex((column) => units.has(column.toLowerCase().replace(/\s+/g, " ")));
    if (index === -1) return;
    const factor = units.get(columns[index].toLowerCase().replace(/\s+/g, " "))!;
    const values = rows.flatMap((row) => {
      const parsed = row[index]?.match(/^~?\s*((?:\d+(?:\.\d+)?|\.\d+))$/)?.[1];
      const value = parsed ? Number(parsed) * factor : NaN;
      return valid(value) ? [value] : [];
    });
    if (!values.length) return;
    const min = values.reduce((a, b) => Math.min(a, b));
    const max = values.reduce((a, b) => Math.max(a, b));
    return {
      value: min === max ? min : [min, max], unit, source: "experimental-table",
      confidence: "alta", evidence: `${filename} · ${columns[index]}`,
    } satisfies PsiQuantity;
  };
  const oxygen = readRange(oxygenColumns, "% O₂", (value) => value > 0 && value <= 100);
  const pressure = readRange(pressureColumns, "psia", (value) => value > 0 && value <= 1000);
  if (!oxygen && !pressure) return;
  return { ...(oxygen ? { oxygen_pct: oxygen } : {}), ...(pressure ? { pressure_psia: pressure } : {}) };
}

export async function fetchPsiTableProfile(config: PsiApiConfig, accession: string, tables: readonly PsiTableMetadata[], signal: AbortSignal) {
  const table = tables.find((item) => item.visible && !item.restricted && item.file_size > 0 &&
    item.file_size <= tableLimit_bytes && /^[^/\\\x00-\x1f]+\.csv$/i.test(item.file_name));
  if (!table || !/^PSI-\d+$/.test(accession)) return;
  try {
    const url = new URL(`${config.base}/studies/${accession}/download`);
    url.search = new URLSearchParams({ file: table.file_name, version: String(table.version), redirect: "false" }).toString();
    const link = await fetch(url, { headers, redirect: "manual", signal, cache: "no-store" });
    const href = link.status >= 300 && link.status < 400 ? link.headers.get("location")
      : link.ok && link.headers.get("content-type")?.toLowerCase().startsWith("text/html") ? (await limitedText(link, 16_000)).trim() : null;
    if (!href) return;
    const dest = new URL(href);
    if (dest.origin !== tableOrigin || dest.username || dest.password || dest.hash ||
        decodeURIComponent(dest.pathname) !== `/psi-data/${accession}/Experimental table/${table.file_name}` ||
        !dest.searchParams.has("Signature") || !dest.searchParams.has("Expires")) return;

    const response = await fetch(dest, { headers, redirect: "error", signal, cache: "no-store" });
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!response.ok || !contentType || !["text/csv", "text/plain", "application/vnd.ms-excel"].includes(contentType)) return;
    return parseExperimentalTable(await limitedText(response, tableLimit_bytes), table.file_name);
  } catch {
    return undefined;
  }
}
