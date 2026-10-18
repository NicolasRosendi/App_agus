import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { db } from '../db.js';
import { distance } from '../geo.js';

const r = Router();
r.use(requireAuth);

// Buscador de direcciones con Nominatim (OpenStreetMap): sin API key, pero con límite de
// 1 pedido por segundo y User-Agent identificable. Cacheamos y espaciamos los pedidos.
const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const UA = 'VeloxUnderground/0.1 (demo; https://github.com/NicolasRosendi/App_agus)';
const cache = new Map();
let lastCall = 0;

async function nominatim(q, near) {
  const key = `${q}|${near.lat.toFixed(2)},${near.lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && hit.at > Date.now() - 10 * 60_000) return hit.results;
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((ok) => setTimeout(ok, wait));
  lastCall = Date.now();
  const box = [near.lng - 0.35, near.lat + 0.35, near.lng + 0.35, near.lat - 0.35].join(',');
  const url = `${NOMINATIM}/search?format=jsonv2&limit=6&accept-language=es&viewbox=${box}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const results = (await res.json()).map((x) => ({
    name: x.name || x.display_name.split(',')[0],
    address: x.display_name.split(',').slice(1, 4).join(',').trim(),
    lat: Number(x.lat),
    lng: Number(x.lon),
    source: 'osm',
  }));
  cache.set(key, { at: Date.now(), results });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return results;
}

r.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 120);
  const near = { lat: Number(req.query.lat) || -34.6037, lng: Number(req.query.lng) || -58.3816 };
  if (q.length < 3) return res.json({ results: [] });
  // Primero lo propio (talleres, lavaderos…), que no depende de la red.
  const ql = q.toLowerCase();
  const local = db().pois
    .filter((p) => p.name.toLowerCase().includes(ql))
    .slice(0, 4)
    .map((p) => ({ name: p.name, address: 'Lugar VELOX', lat: p.lat, lng: p.lng, source: 'velox', type: p.type }));
  let remote = [];
  let error = null;
  try { remote = await nominatim(q, near); } catch (e) { error = 'Buscador de direcciones sin señal'; }
  const results = [...local, ...remote]
    .map((x) => ({ ...x, distance: distance(near, x) }))
    .sort((a, b) => (a.source === b.source ? a.distance - b.distance : a.source === 'velox' ? -1 : 1));
  res.json({ results, error });
});

export default r;
