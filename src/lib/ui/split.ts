// Reparto de alto entre dos paneles apilados separados por un divisor arrastrable.
// La suma de ambos (`total`) no cambia: el divisor solo mueve espacio de uno a otro.

/**
 * Alto del panel superior tras mover el divisor `delta` px desde `start`.
 * Respeta los mínimos de ambos paneles; si no caben los dos mínimos, reparte por mitades.
 */
export function nextSplitHeight(start: number, delta: number, total: number, minTop: number, minBottom: number) {
  const max = total - minBottom;
  if (max < minTop) return Math.max(0, total / 2);
  return Math.min(max, Math.max(minTop, start + delta));
}

/** Porcentaje del alto total que ocupa el panel superior, para `aria-valuenow`. */
export function splitPercent(top: number, total: number) {
  return total > 0 ? Math.round((top / total) * 100) : 50;
}
