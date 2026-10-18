import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { activeReports } from './map.js';
import { pointToPolyline, distance, offset } from '../geo.js';
import { stepsFrom } from '../directions.js';

const r = Router();
r.use(requireAuth);

const OSRM = process.env.OSRM_URL || 'https://router.project-osrm.org';
const HIT_RADIUS = 45; // metros: si el reporte está a esta distancia de la ruta, la ruta "pasa" por ahí
// Cuánto "cuesta" cruzarse cada cosa, en segundos equivalentes de manejo.
const PENALTY = { camara: 240, radar: 240, control: 420, accidente: 200, bache: 90, obra: 120 };

async function osrm(points) {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const alt = points.length === 2 ? '&alternatives=3' : '';
  const res = await fetch(`${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true${alt}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(data.code);
  return data.routes.map((rt) => ({
    line: rt.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distance: rt.distance,
    duration: rt.duration,
    steps: stepsFrom(rt),
  }));
}

function analyze(route, hazards, avoid) {
  const hits = hazards.filter((h) => pointToPolyline(h, route.line) <= HIT_RADIUS);
  const penalty = hits.reduce((s, h) => s + (avoid[h.type] ? PENALTY[h.type] || 0 : 0), 0);
  return { ...route, hits, penalty, score: route.duration + penalty };
}

// Ruta en el centro de un segmento: empuja un "waypoint fantasma" perpendicular al obstáculo.
function detourPoints(route, hazard) {
  let idx = 0, best = Infinity;
  route.line.forEach((p, i) => { const d = distance(p, hazard); if (d < best) { best = d; idx = i; } });
  const a = route.line[Math.max(0, idx - 3)], b = route.line[Math.min(route.line.length - 1, idx + 3)];
  const dn = b.lat - a.lat, de = (b.lng - a.lng) * Math.cos((hazard.lat * Math.PI) / 180);
  const len = Math.hypot(dn, de) || 1;
  return [350, -350, 700, -700].map((m) => offset(hazard, (-de / len) * m, (dn / len) * m));
}

r.post('/safe', async (req, res) => {
  const from = { lat: Number(req.body.from?.lat), lng: Number(req.body.from?.lng) };
  const to = { lat: Number(req.body.to?.lat), lng: Number(req.body.to?.lng) };
  if (![from.lat, from.lng, to.lat, to.lng].every(Number.isFinite)) return res.status(400).json({ error: 'Origen/destino inválido' });
  const avoid = { ...req.user.prefs.avoid, ...(req.body.avoid || {}) };
  const hazards = activeReports().map(({ id, type, lat, lng, note }) => ({ id, type, lat, lng, note }));

  try {
    const base = (await osrm([from, to])).map((rt) => analyze(rt, hazards, avoid));
    const fastest = base.reduce((a, b) => (a.duration <= b.duration ? a : b));
    const candidates = [...base];

    // Si la mejor alternativa igual cruza algo que querés evitar, probamos desvíos.
    let best = candidates.reduce((a, b) => (a.score <= b.score ? a : b));
    const worst = best.hits.filter((h) => avoid[h.type]).sort((a, b) => (PENALTY[b.type] || 0) - (PENALTY[a.type] || 0))[0];
    if (worst) {
      const tries = await Promise.allSettled(detourPoints(best, worst).map((via) => osrm([from, via, to])));
      for (const t of tries) if (t.status === 'fulfilled') candidates.push(analyze({ ...t.value[0], detour: true }, hazards, avoid));
      best = candidates.reduce((a, b) => (a.score <= b.score ? a : b));
    }

    const pack = (rt, kind) => ({ kind, line: rt.line, distance: rt.distance, duration: rt.duration, hazards: rt.hits, avoided: rt.detour || false, steps: rt.steps });
    res.json({
      engine: 'osrm',
      ghost: pack(best, 'ghost'),
      fastest: best === fastest ? null : pack(fastest, 'fastest'),
      saved: Math.max(0, fastest.hits.length - best.hits.length),
    });
  } catch (err) {
    // Sin motor de rutas: línea directa para no dejar la UI vacía.
    const line = Array.from({ length: 30 }, (_, i) => ({ lat: from.lat + ((to.lat - from.lat) * i) / 29, lng: from.lng + ((to.lng - from.lng) * i) / 29 }));
    const rt = analyze({ line, distance: distance(from, to), duration: distance(from, to) / 9 }, hazards, avoid);
    res.json({ engine: 'offline', error: String(err.message || err), ghost: { kind: 'ghost', line, distance: rt.distance, duration: rt.duration, hazards: rt.hits, steps: [{ text: 'Sin motor de rutas: seguí la línea directa', type: 'depart', distance: rt.distance, at: from }] }, fastest: null, saved: 0 });
  }
});

export default r;
