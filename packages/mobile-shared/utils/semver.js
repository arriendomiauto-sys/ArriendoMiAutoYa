/** Compara dos versiones "x.y.z". Positivo si `a` > `b`, negativo si `a` < `b`, 0 si iguales. */
export function compararVersiones(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/** `true` si `actual` es una versión menor que `minima`. */
export function versionEsMenor(actual, minima) {
  return compararVersiones(actual, minima) < 0;
}
