import { Router } from 'express';
import { db, id, save } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

const H = 3600_000;
// Vida útil de cada tipo de reporte (null = permanente hasta que lo desmientan).
export const REPORT_TYPES = {
  camara: { ttl: null, rep: 15 },
  radar: { ttl: 4 * H, rep: 10 },
  control: { ttl: 3 * H, rep: 12 },
  bache: { ttl: 7 * 24 * H, rep: 8 },
  accidente: { ttl: 2 * H, rep: 10 },
  obra: { ttl: 7 * 24 * H, rep: 6 },
};
const POI_TYPES = ['taller', 'lavadero', 'nafta', 'tuning', 'gomeria'];

export const activeReports = () => db().reports.filter((x) => !x.expiresAt || x.expiresAt > Date.now());

const view = (rep, viewer) => {
  const u = db().users.find((x) => x.id === rep.userId);
  return {
    ...rep,
    handle: u?.handle,
    confirms: rep.confirms.length,
    denies: rep.denies.length,
    myVote: rep.confirms.includes(viewer.id) ? 'confirm' : rep.denies.includes(viewer.id) ? 'deny' : null,
    mine: rep.userId === viewer.id,
  };
};

const validPoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

r.get('/reports', (req, res) => res.json({ reports: activeReports().map((x) => view(x, req.user)) }));

r.post('/reports', (req, res) => {
  const { type, note } = req.body;
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (!REPORT_TYPES[type] || !validPoint(lat, lng)) return res.status(400).json({ error: 'Reporte inválido' });
  const now = Date.now();
  const ttl = REPORT_TYPES[type].ttl;
  const report = { id: id('r'), type, lat, lng, userId: req.user.id, note: String(note || '').slice(0, 80), confirms: [], denies: [], createdAt: now, expiresAt: ttl ? now + ttl : null };
  db().reports.push(report);
  req.user.rep += REPORT_TYPES[type].rep;
  req.user.points += 5;
  save();
  res.json({ report: view(report, req.user), gained: { rep: REPORT_TYPES[type].rep, points: 5 } });
});

r.post('/reports/:id/vote', (req, res) => {
  const rep = db().reports.find((x) => x.id === req.params.id);
  if (!rep) return res.status(404).json({ error: 'Reporte no encontrado' });
  const value = req.body.value === 'deny' ? 'deny' : 'confirm';
  rep.confirms = rep.confirms.filter((u) => u !== req.user.id);
  rep.denies = rep.denies.filter((u) => u !== req.user.id);
  (value === 'confirm' ? rep.confirms : rep.denies).push(req.user.id);
  const ttl = REPORT_TYPES[rep.type]?.ttl;
  if (value === 'confirm' && ttl) rep.expiresAt = Date.now() + ttl;
  req.user.points += 2;
  // La comunidad lo desmiente → se cae del mapa.
  if (rep.denies.length >= 3 && rep.denies.length > rep.confirms.length) {
    db().reports = db().reports.filter((x) => x.id !== rep.id);
    save();
    return res.json({ removed: true });
  }
  save();
  res.json({ report: view(rep, req.user) });
});

r.delete('/reports/:id', (req, res) => {
  db().reports = db().reports.filter((x) => !(x.id === req.params.id && x.userId === req.user.id));
  save();
  res.json({ ok: true });
});

r.get('/pois', (_req, res) => res.json({ pois: db().pois }));

r.post('/pois', (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!POI_TYPES.includes(req.body.type) || !name || !validPoint(lat, lng)) return res.status(400).json({ error: 'Lugar inválido' });
  const poi = { id: id('poi'), type: req.body.type, name, lat, lng, rating: null, open24: Boolean(req.body.open24), suggestedBy: req.user.id };
  db().pois.push(poi);
  req.user.points += 10;
  save();
  res.json({ poi });
});

export default r;
