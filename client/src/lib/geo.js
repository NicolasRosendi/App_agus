const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function distance(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rumbo en grados desde el norte, sentido horario. */
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Precalcula distancias acumuladas de una polilínea para recorrerla. */
export function makeTrack(line) {
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + distance(line[i - 1], line[i]));
  return { line, cum, total: cum[cum.length - 1] };
}

/** Punto y rumbo a `d` metros del inicio. */
export function pointAt(track, d) {
  const { line, cum } = track;
  let i = 1;
  while (i < line.length - 1 && cum[i] < d) i++;
  const a = line[i - 1], b = line[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / seg));
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, heading: bearing(a, b), index: i };
}

/** Distancia a lo largo de la ruta del punto de la polilínea más cercano a `p` (y qué tan lejos queda). */
export function alongTrack(track, p) {
  let best = Infinity, at = 0;
  track.line.forEach((q, i) => {
    const d = distance(p, q);
    if (d < best) { best = d; at = track.cum[i]; }
  });
  return { along: at, offset: best };
}
