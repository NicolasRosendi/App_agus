import { Router } from 'express';
import { db, id, save } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { upload, fileUrl } from '../upload.js';
import { hydratePost } from './feed.js';

const r = Router();
r.use(requireAuth);

const CATEGORIES = ['JDM', 'EURO', 'MUSCLE', 'TUNING', 'CLÁSICO', 'STANCE', 'DRIFT', '4X4', 'OTRO'];
const BODIES = ['coupe', 'sedan', 'hatch', 'muscle', 'classic', 'suv'];

r.get('/categories', (_req, res) => res.json({ categories: CATEGORIES }));

r.get('/notifications', (req, res) => {
  const list = db().notifications.filter((n) => n.userId === req.user.id).slice(0, 50);
  res.json({ notifications: list, unread: list.filter((n) => !n.read).length });
});

r.post('/notifications/read', (req, res) => {
  for (const n of db().notifications) if (n.userId === req.user.id) n.read = true;
  save();
  res.json({ ok: true });
});

r.get('/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const users = db().users
    .filter((u) => !q || u.handle.includes(q) || (u.crew || '').toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
    .slice(0, 20)
    .map((u) => publicUser(u, req.user));
  res.json({ users });
});

r.get('/:handle', (req, res) => {
  const u = db().users.find((x) => x.handle === req.params.handle.toLowerCase());
  if (!u) return res.status(404).json({ error: 'Perfil no encontrado' });
  const posts = db().posts.filter((p) => p.userId === u.id).sort((a, b) => b.createdAt - a.createdAt).map((p) => hydratePost(p, req.user));
  const meetsHosted = db().meets.filter((m) => m.organizerId === u.id && m.visibility !== 'ghost').length;
  res.json({ user: publicUser(u, req.user), posts, stats: { posts: posts.length, meetsHosted } });
});

r.patch('/me', (req, res) => {
  const u = req.user;
  const { name, bio, crew, interests, prefs, color } = req.body;
  if (typeof name === 'string') u.name = name.slice(0, 30);
  if (typeof bio === 'string') u.bio = bio.slice(0, 160);
  if (typeof crew === 'string') u.crew = crew.trim().slice(0, 24).toUpperCase() || null;
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) u.color = color;
  if (Array.isArray(interests)) u.interests = interests.filter((i) => CATEGORIES.includes(i)).slice(0, 6);
  if (prefs && typeof prefs === 'object') u.prefs = { ...u.prefs, ...prefs };
  save();
  res.json({ user: publicUser(u, u) });
});

r.post('/me/avatar', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo inválido' });
  req.user.avatar = fileUrl(req.file);
  save();
  res.json({ user: publicUser(req.user, req.user) });
});

// Garage: el auto con foto + patente. La patente queda enmascarada para terceros.
r.post('/me/cars', upload.single('photo'), (req, res) => {
  const { make, model, year, category, color, plate, hp, mods, body } = req.body;
  if (!make || !model) return res.status(400).json({ error: 'Marca y modelo son obligatorios' });
  const car = {
    id: id('car'),
    make: String(make).slice(0, 24),
    model: String(model).slice(0, 32),
    year: Number(year) || null,
    category: CATEGORIES.includes(category) ? category : 'OTRO',
    color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#d8461b',
    body: BODIES.includes(body) ? body : null,
    plate: plate ? String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : null,
    // Demo: con patente + foto queda "verificado". En prod va validación manual/OCR.
    plateVerified: Boolean(plate && req.file),
    hp: Number(hp) || null,
    mods: String(mods || '').split(',').map((m) => m.trim()).filter(Boolean).slice(0, 8),
    photo: fileUrl(req.file),
  };
  req.user.cars.push(car);
  req.user.rep += 15;
  save();
  res.json({ user: publicUser(req.user, req.user) });
});

r.delete('/me/cars/:carId', (req, res) => {
  req.user.cars = req.user.cars.filter((c) => c.id !== req.params.carId);
  save();
  res.json({ user: publicUser(req.user, req.user) });
});

r.post('/:handle/follow', (req, res) => {
  const target = db().users.find((x) => x.handle === req.params.handle.toLowerCase());
  if (!target || target.id === req.user.id) return res.status(400).json({ error: 'No podés seguir a este perfil' });
  const f = req.user.following;
  const i = f.indexOf(target.id);
  if (i >= 0) f.splice(i, 1);
  else f.push(target.id);
  save();
  res.json({ user: publicUser(target, req.user) });
});

export default r;
