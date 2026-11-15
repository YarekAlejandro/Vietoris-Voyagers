import type { AssistantPointer } from "./page-assistant";

const rows = [
  ["outcome", /extinci[oó]n|resultado observado|se apaga/iu],
  ["steady_flame_length_cm", /(?:longitud|tama[ñn]o) (?:de (?:la )?)?llama/iu],
  ["fuel", /\b(?:SIBAL|material)\b/iu],
  ["gravity_g", /\bgravedad (?:indicada|nominal|de|cero)/iu],
  ["configuration", /flujo concurrente/iu],
  ["flow_velocity_cm_s", /(?:flujo|velocidad).{0,24}(?:2\.2|20|cm\/s|por segundo)|flujo de referencia/iu],
  ["oxygen_pct", /ox[ií]geno|O₂/iu],
  ["pressure_psia", /presi[oó]n/iu],
  ["width_cm", /ancho (?:de (?:la )?)?muestra|anchura/iu],
  ["thickness_mm", /espesor/iu],
  ["facility", /instalaci[oó]n|glovebox/iu],
] as const;

export function narratedPair(pointers: readonly AssistantPointer[]) {
  const pairs = pointers.filter((pointer) => pointer.target === "comparison" && pointer.comparison);
  return pairs.length === 1 ? pairs[0].comparison : undefined;
}

export function comparisonCues(text: string) {
  const cues = [{ offset: Math.min(22, text.length), selector: "#assistant-diff-runs" }];
  for (const [field, pattern] of rows) {
    const match = pattern.exec(text);
    if (match) cues.push({ offset: match.index + match[0].length, selector: `[data-assistant-diff-row="${field}"]` });
  }
  const limitation = /(?:varias condiciones|no (?:permite|identifica|puede) atribuir|efecto de cada factor)/iu.exec(text);
  if (limitation) cues.push({ offset: limitation.index + limitation[0].length, selector: "#assistant-diff-confounding" });
  const missing = /(?:resultado observado.{0,55}(?:vac[ií][ao]|ausente|no (?:est[aá]|figura))|(?:vac[ií][ao]|falta).{0,30}resultado observado)/iu.exec(text);
  if (missing) cues.push({ offset: missing.index + missing[0].length, selector: '[data-assistant-diff-row="outcome"]' });
  return cues.sort((a, b) => a.offset - b.offset);
}
