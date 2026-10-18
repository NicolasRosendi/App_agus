import crypto from 'node:crypto';
import { db } from './db.js';

const SECRET = process.env.JWT_SECRET || 'velox-dev-secret-change-me';
const TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

// Token estilo JWT (HS256) sin dependencias.
export function issueToken(userId) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub: userId, exp: Date.now() + TTL_MS });
  return `${head}.${body}.${sign(`${head}.${body}`)}`;
}

function readToken(token) {
  const [head, body, sig] = (token || '').split('.');
  if (!head || !body || !sig) return null;
  const expected = sign(`${head}.${body}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  return payload.exp > Date.now() ? payload.sub : null;
}

export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const userId = readToken(token);
  const user = userId && db().users.find((u) => u.id === userId);
  if (!user) return res.status(401).json({ error: 'ACCESO DENEGADO // token inválido' });
  req.user = user;
  next();
}

export function publicUser(u, viewer) {
  if (!u) return null;
  const self = viewer && viewer.id === u.id;
  return {
    id: u.id,
    handle: u.handle,
    name: u.name,
    crew: u.crew,
    bio: u.bio,
    avatar: u.avatar,
    color: u.color,
    rep: u.rep,
    level: levelFor(u.rep),
    badges: u.badges,
    interests: u.interests,
    verified: u.cars.some((c) => c.plateVerified),
    cars: u.cars.map((c) => ({ ...c, plate: self ? c.plate : maskPlate(c.plate) })),
    followers: db().users.filter((x) => x.following.includes(u.id)).length,
    following: u.following.length,
    isFollowing: viewer ? viewer.following.includes(u.id) : false,
    ...(self ? { prefs: u.prefs, points: u.points } : {}),
  };
}

export function levelFor(rep) {
  const tiers = [
    [0, 'NOVATO'],
    [100, 'CALLEJERO'],
    [300, 'PILOTO'],
    [700, 'LEYENDA'],
    [1500, 'FANTASMA'],
  ];
  return tiers.reduce((acc, [min, name]) => (rep >= min ? name : acc), 'NOVATO');
}

export function maskPlate(plate) {
  if (!plate) return null;
  const clean = plate.replace(/\s/g, '');
  return clean.length <= 3 ? '•••' : `${clean.slice(0, 2)}•••${clean.slice(-2)}`;
}
