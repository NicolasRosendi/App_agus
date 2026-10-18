const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function distance(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Distancia (m) de un punto a un segmento, en proyección equirectangular local.
export function pointToSegment(p, a, b) {
  const k = Math.cos(rad(p.lat));
  const ax = a.lng * k, ay = a.lat, bx = b.lng * k, by = b.lat, px = p.lng * k, py = p.lat;
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return distance(p, { lat: ay + t * dy, lng: (ax + t * dx) / k });
}

export function pointToPolyline(p, line) {
  let min = Infinity;
  for (let i = 1; i < line.length; i++) min = Math.min(min, pointToSegment(p, line[i - 1], line[i]));
  return min;
}

// Desplazamiento determinístico: la zona difusa de una juntada no "salta" entre requests
// y no se puede triangular pidiendo muchas veces.
export function fuzz(point, seedStr, meters) {
  let h = 2166136261;
  for (const ch of seedStr) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const angle = ((h >>> 0) % 360) * (Math.PI / 180);
  const dist = meters * (0.35 + (((h >>> 8) % 1000) / 1000) * 0.5);
  return {
    lat: point.lat + (dist * Math.cos(angle)) / 111320,
    lng: point.lng + (dist * Math.sin(angle)) / (111320 * Math.cos(rad(point.lat))),
  };
}

export function offset(point, metersNorth, metersEast) {
  return {
    lat: point.lat + metersNorth / 111320,
    lng: point.lng + metersEast / (111320 * Math.cos(rad(point.lat))),
  };
}
