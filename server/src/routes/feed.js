import { Router } from 'express';
import { db, id, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { upload, fileUrl } from '../upload.js';

const r = Router();
r.use(requireAuth);

const userById = (uid) => db().users.find((u) => u.id === uid);

export function hydratePost(p, viewer) {
  const author = userById(p.userId);
  return {
    ...p,
    author: author && { id: author.id, handle: author.handle, name: author.name, avatar: author.avatar, color: author.color, crew: author.crew, verified: author.cars.some((c) => c.plateVerified) },
    likes: p.likes.length,
    liked: p.likes.includes(viewer.id),
    comments: p.comments.map((c) => {
      const u = userById(c.userId);
      return { ...c, handle: u?.handle, color: u?.color };
    }),
  };
}

// Ranking personalizado: recencia + seguidos + afinidad con los intereses del usuario.
function score(p, viewer) {
  const ageH = (Date.now() - p.createdAt) / 3600_000;
  let s = 100 / (1 + ageH / 6);
  if (viewer.following.includes(p.userId)) s += 25;
  s += p.tags.filter((t) => viewer.interests.includes(t)).length * 12;
  s += Math.min(p.likes.length, 20);
  return s;
}

r.get('/', (req, res) => {
  const type = req.query.type;
  const mode = req.query.mode || 'para-vos';
  let list = db().posts.filter((p) => !type || p.type === type);
  if (mode === 'siguiendo') list = list.filter((p) => req.user.following.includes(p.userId) || p.userId === req.user.id);
  list = mode === 'recientes' || type === 'reel'
    ? list.sort((a, b) => b.createdAt - a.createdAt)
    : list.sort((a, b) => score(b, req.user) - score(a, req.user));
  res.json({ posts: list.slice(0, 60).map((p) => hydratePost(p, req.user)) });
});

r.post('/', upload.single('media'), (req, res) => {
  const text = String(req.body.text || '').slice(0, 500);
  const file = req.file;
  if (!text && !file) return res.status(400).json({ error: 'El post está vacío' });
  const isVideo = file?.mimetype.startsWith('video/');
  const type = isVideo || req.body.type === 'reel' ? 'reel' : 'post';
  if (type === 'reel' && !isVideo) return res.status(400).json({ error: 'Un reel necesita un video' });
  const tags = String(req.body.tags || '').split(',').map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 5);
  const post = {
    id: id('p'), userId: req.user.id, type, text, tags,
    media: file
      ? { kind: isVideo ? 'video' : 'image', url: fileUrl(file) }
      : { kind: 'art', palette: req.body.palette || 'graffiti', car: (req.user.cars[0]?.model || req.user.handle).toUpperCase(), kicker: tags[0] || 'POST' },
    place: req.body.place ? String(req.body.place).slice(0, 60) : null,
    likes: [], comments: [], createdAt: Date.now(),
  };
  db().posts.push(post);
  req.user.rep += 5;
  save();
  res.json({ post: hydratePost(post, req.user) });
});

r.post('/:id/like', (req, res) => {
  const p = db().posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Post no encontrado' });
  const i = p.likes.indexOf(req.user.id);
  if (i >= 0) p.likes.splice(i, 1);
  else {
    p.likes.push(req.user.id);
    const author = userById(p.userId);
    if (author && author.id !== req.user.id) author.rep += 1;
  }
  save();
  res.json({ post: hydratePost(p, req.user) });
});

r.post('/:id/comments', (req, res) => {
  const p = db().posts.find((x) => x.id === req.params.id);
  const text = String(req.body.text || '').trim().slice(0, 300);
  if (!p || !text) return res.status(400).json({ error: 'Comentario inválido' });
  p.comments.push({ id: id('c'), userId: req.user.id, text, at: Date.now() });
  save();
  res.json({ post: hydratePost(p, req.user) });
});

r.delete('/:id', (req, res) => {
  const i = db().posts.findIndex((x) => x.id === req.params.id && x.userId === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'Post no encontrado' });
  db().posts.splice(i, 1);
  save();
  res.json({ ok: true });
});

export default r;
