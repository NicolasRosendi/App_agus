import { Router } from 'express';
import { db, id, save } from '../db.js';
import { hashPassword, verifyPassword, issueToken, requireAuth, publicUser } from '../auth.js';

const r = Router();
const HANDLE = /^[a-z0-9_]{3,20}$/;

r.post('/register', (req, res) => {
  const handle = String(req.body.handle || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!HANDLE.test(handle)) return res.status(400).json({ error: 'Alias: 3-20 caracteres, a-z 0-9 _' });
  if (password.length < 4) return res.status(400).json({ error: 'Clave muy corta (mín. 4)' });
  if (db().users.some((u) => u.handle === handle)) return res.status(409).json({ error: 'Ese alias ya está tomado' });
  const user = {
    id: id('u'), handle, name: handle.toUpperCase(), crew: null, bio: '', avatar: null,
    color: ['#e8621a', '#6fa8c7', '#c2417d', '#a9c93a', '#f2c230'][Math.floor(Math.random() * 5)],
    rep: 10, points: 0, badges: [], interests: [], cars: [], following: [],
    passwordHash: hashPassword(password),
    prefs: {
      layers: { reports: true, pois: true, meets: true },
      reportTypes: ['camara', 'control', 'bache', 'accidente', 'obra', 'radar'],
      poiTypes: ['taller', 'lavadero', 'nafta', 'tuning', 'gomeria'],
      avoid: { camara: true, control: true, bache: true, radar: true, accidente: true, obra: false },
    },
    createdAt: Date.now(),
  };
  db().users.push(user);
  save();
  res.json({ token: issueToken(user.id), user: publicUser(user, user) });
});

r.post('/login', (req, res) => {
  const handle = String(req.body.handle || '').trim().toLowerCase();
  const user = db().users.find((u) => u.handle === handle);
  if (!user || !verifyPassword(String(req.body.password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  res.json({ token: issueToken(user.id), user: publicUser(user, user) });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user, req.user) }));

export default r;
