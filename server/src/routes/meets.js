import { Router } from 'express';
import crypto from 'node:crypto';
import { db, id, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { fuzz } from '../geo.js';
import { notify } from '../notify.js';
import { evaluate, applyDecision, promoteWaitlist, approvedCount, log } from '../automation.js';

const r = Router();
r.use(requireAuth);

const ZONE_RADIUS = 1800;
const isStaff = (m, u) => m.organizerId === u.id || m.coOrganizers.includes(u.id);
const attendeeOf = (m, u) => m.attendees.find((a) => a.userId === u.id);
const userById = (uid) => db().users.find((u) => u.id === uid);
const mini = (u) => u && { id: u.id, handle: u.handle, name: u.name, color: u.color, avatar: u.avatar, crew: u.crew, rep: u.rep };

function revealed(m, u) {
  if (isStaff(m, u)) return true;
  const a = attendeeOf(m, u);
  if (a?.status !== 'approved') return false;
  if (m.revealMode === 'approved' || m.revealedManually) return true;
  return Date.now() >= m.startsAt - m.revealHoursBefore * 3600_000;
}

// Nunca sale del server la coordenada exacta para quien no tiene acceso.
function view(m, u) {
  const staff = isStaff(m, u);
  const me = attendeeOf(m, u);
  const show = revealed(m, u);
  const base = {
    id: m.id, title: m.title, desc: m.desc, tags: m.tags, startsAt: m.startsAt, capacity: m.capacity,
    visibility: m.visibility, status: m.status, revealMode: m.revealMode, revealHoursBefore: m.revealHoursBefore,
    revealAt: m.revealMode === 'hoursBefore' && !m.revealedManually ? m.startsAt - m.revealHoursBefore * 3600_000 : null,
    organizer: mini(userById(m.organizerId)),
    approved: approvedCount(m),
    rules: { minRep: m.rules.minRep, requireVerifiedCar: m.rules.requireVerifiedCar, categories: m.rules.categories, waitlist: m.rules.waitlist },
    broadcasts: me?.status === 'approved' || staff ? m.broadcasts : [],
    role: staff ? (m.organizerId === u.id ? 'organizer' : 'coorganizer') : me ? 'attendee' : 'guest',
    me: me && { status: me.status, passCode: me.status === 'approved' ? me.passCode : null, checkedIn: me.checkedIn, reason: me.reason, carId: me.carId },
    spot: show ? m.spot : null,
    zone: show ? null : { ...fuzz(m.spot, m.id, ZONE_RADIUS * 0.6), radius: ZONE_RADIUS },
    revealed: show,
  };
  if (!staff) return base;
  return {
    ...base,
    rulesFull: m.rules,
    codes: m.codes,
    coOrganizers: m.coOrganizers.map((x) => mini(userById(x))),
    banned: m.banned.map((x) => mini(userById(x))),
    revealedManually: m.revealedManually,
    attendees: m.attendees.map((a) => {
      const au = userById(a.userId);
      return { ...a, user: mini(au), car: au?.cars.find((c) => c.id === a.carId) || null, verified: au?.cars.some((c) => c.plateVerified) };
    }),
    log: m.log.slice(0, 60),
  };
}

function load(req, res, staffOnly = false) {
  const m = db().meets.find((x) => x.id === req.params.id);
  if (!m) { res.status(404).json({ error: 'Evento no encontrado' }); return null; }
  if (staffOnly && !isStaff(m, req.user)) { res.status(403).json({ error: 'Solo el organizador' }); return null; }
  // Un evento fantasma no existe para quien no está adentro.
  if (m.visibility === 'ghost' && !isStaff(m, req.user) && !attendeeOf(m, req.user)) { res.status(404).json({ error: 'Evento no encontrado' }); return null; }
  return m;
}

r.get('/', (req, res) => {
  const list = db().meets
    .filter((m) => m.status !== 'cancelled' || isStaff(m, req.user))
    .filter((m) => m.visibility !== 'ghost' || isStaff(m, req.user) || attendeeOf(m, req.user))
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((m) => view(m, req.user));
  res.json({ meets: list });
});

r.get('/:id', (req, res) => {
  const m = load(req, res);
  if (m) res.json({ meet: view(m, req.user) });
});

function join(req, res, m, code) {
  const user = req.user;
  const existing = attendeeOf(m, user);
  if (existing && ['approved', 'pending', 'waitlist'].includes(existing.status)) return res.status(409).json({ error: 'Ya tenés una solicitud activa' });
  const car = user.cars.find((c) => c.id === req.body.carId) || user.cars[0];
  const result = evaluate(m, user, car, { code });
  const attendee = existing || { userId: user.id, at: Date.now(), passCode: null, checkedIn: false };
  Object.assign(attendee, { carId: car?.id || null, message: String(req.body.message || '').slice(0, 200), via: code ? 'code' : 'apply', at: Date.now() });
  if (!existing) m.attendees.push(attendee);
  if (code) code.uses += 1;
  applyDecision(m, attendee, result.decision, result.reasons);
  if (result.decision === 'manual') notify(m.organizerId, `@${user.handle} pidió acceso a ${m.title}`, `/juntadas/${m.id}/ops`);
  save();
  res.json({ meet: view(m, user), decision: result.decision, reasons: result.reasons });
}

r.post('/:id/apply', (req, res) => {
  const m = load(req, res);
  if (!m) return;
  if (m.visibility === 'ghost' && !attendeeOf(m, req.user)) return res.status(403).json({ error: 'Solo con invitación' });
  join(req, res, m, null);
});

// Canje de invitación: también es la única forma de "descubrir" un evento fantasma.
r.post('/redeem', (req, res) => {
  const codeStr = String(req.body.code || '').trim().toUpperCase();
  const m = db().meets.find((x) => x.codes.some((c) => c.code === codeStr));
  const code = m?.codes.find((c) => c.code === codeStr);
  if (!m || !code) return res.status(404).json({ error: 'Código inválido' });
  if (code.maxUses && code.uses >= code.maxUses) return res.status(410).json({ error: 'Código agotado' });
  if (code.expiresAt && code.expiresAt < Date.now()) return res.status(410).json({ error: 'Código vencido' });
  req.params.id = m.id;
  join(req, res, m, code);
});

r.post('/:id/leave', (req, res) => {
  const m = load(req, res);
  if (!m) return;
  const a = attendeeOf(m, req.user);
  if (!a) return res.status(400).json({ error: 'No estás anotado' });
  a.status = 'left';
  log(m, `@${req.user.handle} se bajó`, 'user');
  promoteWaitlist(m);
  save();
  res.json({ meet: view(m, req.user) });
});

// ---------- Panel del organizador ----------

const CATS = ['JDM', 'EURO', 'MUSCLE', 'TUNING', 'CLÁSICO', 'STANCE', 'DRIFT', '4X4', 'OTRO'];

function sanitizeRules(input = {}, prev = {}) {
  const rules = { ...prev };
  for (const k of ['autoApprove', 'requireVerifiedCar', 'strict', 'waitlist']) if (k in input) rules[k] = Boolean(input[k]);
  if ('minRep' in input) rules.minRep = Math.max(0, Number(input.minRep) || 0);
  if (Array.isArray(input.categories)) rules.categories = input.categories.filter((c) => CATS.includes(c));
  if (Array.isArray(input.trustedCrews)) rules.trustedCrews = input.trustedCrews.map((c) => String(c).toUpperCase().trim()).filter(Boolean).slice(0, 10);
  return rules;
}

r.post('/', (req, res) => {
  const b = req.body;
  const lat = Number(b.spot?.lat), lng = Number(b.spot?.lng);
  const startsAt = Number(new Date(b.startsAt));
  if (!b.title || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(startsAt)) {
    return res.status(400).json({ error: 'Faltan título, spot o fecha' });
  }
  const m = {
    id: id('m'), title: String(b.title).toUpperCase().slice(0, 40), desc: String(b.desc || '').slice(0, 600),
    organizerId: req.user.id, coOrganizers: [],
    spot: { lat, lng, label: String(b.spot.label || 'Spot secreto').slice(0, 60) },
    startsAt, capacity: Math.max(2, Math.min(500, Number(b.capacity) || 20)),
    visibility: b.visibility === 'ghost' ? 'ghost' : 'underground',
    revealMode: b.revealMode === 'hoursBefore' ? 'hoursBefore' : 'approved',
    revealHoursBefore: Math.max(0, Math.min(48, Number(b.revealHoursBefore) || 0)),
    revealedManually: false,
    tags: (b.tags || []).map((t) => String(t).toUpperCase().slice(0, 16)).slice(0, 6),
    rules: sanitizeRules(b.rules, { autoApprove: false, minRep: 0, requireVerifiedCar: false, categories: [], strict: false, waitlist: true, trustedCrews: [] }),
    codes: [], attendees: [], banned: [], broadcasts: [], log: [], status: 'active', createdAt: Date.now(),
  };
  log(m, 'Evento creado. Canal cifrado abierto.');
  db().meets.push(m);
  req.user.rep += 20;
  save();
  res.json({ meet: view(m, req.user) });
});

r.patch('/:id', (req, res) => {
  const m = load(req, res, true);
  if (!m) return;
  const b = req.body;
  if (b.title) m.title = String(b.title).toUpperCase().slice(0, 40);
  if (typeof b.desc === 'string') m.desc = b.desc.slice(0, 600);
  if (b.capacity) m.capacity = Math.max(2, Math.min(500, Number(b.capacity)));
  if (b.startsAt) m.startsAt = Number(new Date(b.startsAt)) || m.startsAt;
  if (b.visibility) m.visibility = b.visibility === 'ghost' ? 'ghost' : 'underground';
  if (b.revealMode) m.revealMode = b.revealMode === 'hoursBefore' ? 'hoursBefore' : 'approved';
  if ('revealHoursBefore' in b) m.revealHoursBefore = Math.max(0, Math.min(48, Number(b.revealHoursBefore) || 0));
  if (b.spot && Number.isFinite(Number(b.spot.lat))) {
    m.spot = { lat: Number(b.spot.lat), lng: Number(b.spot.lng), label: String(b.spot.label || m.spot.label).slice(0, 60) };
    log(m, 'Spot reubicado', 'mod');
    for (const a of m.attendees.filter((x) => x.status === 'approved')) notify(a.userId, `${m.title}: el spot cambió. Revisá el mapa.`, `/juntadas/${m.id}`);
  }
  if (b.rules) {
    m.rules = sanitizeRules(b.rules, m.rules);
    log(m, 'Reglas de automatización actualizadas', 'mod');
  }
  if (b.capacity) promoteWaitlist(m);
  save();
  res.json({ meet: view(m, req.user) });
});

const STATUS_TEXT = { active: 'ACTIVA', locked: 'CERRADA', live: 'EN VIVO', ended: 'FINALIZADA', cancelled: 'CANCELADA' };

r.post('/:id/status', (req, res) => {
  const m = load(req, res, true);
  if (!m) return;
  const next = req.body.status;
  if (!['active', 'locked', 'live', 'ended', 'cancelled'].includes(next)) return res.status(400).json({ error: 'Estado inválido' });
  m.status = next;
  log(m, `Estado → ${STATUS_TEXT[next]}`, 'mod');
  if (['live', 'cancelled'].includes(next)) {
    for (const a of m.attendees.filter((x) => x.status === 'approved')) notify(a.userId, next === 'live' ? `${m.title} está EN VIVO.` : `${m.title} fue cancelado.`, `/juntadas/${m.id}`);
  }
  save();
  res.json({ meet: view(m, req.user) });
});

r.post('/:id/reveal', (req, res) => {
  const m = load(req, res, true);
  if (!m) return;
  m.revealedManually = true;
  log(m, 'Ubicación revelada a los aprobados', 'mod');
  for (const a of m.attendees.filter((x) => x.status === 'approved')) notify(a.userId, `${m.title}: ubicación desbloqueada 📍`, `/juntadas/${m.id}`);
  save();
  res.json({ meet: view(m, req.user) });
});

r.post('/:id/codes', (req, res) => {
  const m = load(req, res, true);
  if (!m) return;
  const prefix = (req.body.prefix || req.user.handle).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'VX';
  const code = {
    code: `${prefix}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    uses: 0,
    maxUses: Math.max(1, Math.min(500, Number(req.body.maxUses) || 1)),
    autoApprove: Boolean(req.body.autoApprove),
    expiresAt: req.body.expiresHours ? Date.now() + Number(req.body.expiresHours) * 3600_000 : null,
    createdAt: Date.now(),
  };
  m.codes.push(code);
  log(m, `Código ${code.code} generado (${code.maxUses} usos${code.autoApprove ? ', auto-aprueba' : ''})`, 'mod');
  save();
  res.json({ meet: view(m, req.user), code });
});

r.delete('/:id/codes/:code', (req, res) => {
  const m = load(req, res, true);
  if (!m) return;
  m.codes = m.codes.filter((c) => c.code !== req.params.code);
  log(m, `Código ${req.params.code} revocado`, 'mod');
  save();
  res.json({ meet: view(m, req.user) });
});

r.post('/:id/attendees/:userId', (req, res) => {
  const m = load(req, res, true);
  if (!m) return;
  const a = m.attendees.find((x) => x.userId === req.params.userId);
  if (!a) return res.status(404).json({ error: 'Asistente no encontrado' });
  const action = req.body.action;
  const actor = `@${req.user.handle}`;
  if (action === 'approve') applyDecision(m, a, 'approve', [], actor);
  else if (action === 'reject') { applyDecision(m, a, 'reject', req.body.reason ? [req.body.reason] : [], actor); promoteWaitlist(m); }
  else if (action === 'waitlist') applyDecision(m, a, 'waitlist', [], actor);
  else if (action === 'kick' || action === 'ban') {
    a.status = 'kicked';
    if (action === 'ban' && !m.banned.includes(a.userId)) m.banned.push(a.userId);
    log(m, `${actor} → ${action === 'ban' ? 'BANEÓ' : 'expulsó'} a @${userById(a.userId)?.handle}`, 'mod');
    notify(a.userId, `Fuiste removido de ${m.title}.`);
    promoteWaitlist(m);
  } else if (action === 'checkin') {
    a.checkedIn = true;
    log(m, `Check-in @${userById(a.userId)?.handle}`, 'mod');
  } else if (action === 'promote' && m.organizerId === req.user.id) {
    if (!m.coOrganizers.includes(a.userId)) m.coOrganizers.push(a.userId);
    log(m, `@${userById(a.userId)?.handle} ahora es co-organizador`, 'mod');
  } else return res.status(400).json({ error: 'Acción inválida' });
  save();
  res.json({ meet: view(m, req.user) });
});

// Aprobación masiva: aplica las reglas actuales a toda la cola pendiente.
r.post('/:id/automation/run', (req, res) => {
  const m = load(req, res, true);
  if (!m) return;
  let changed = 0;
  for (const a of m.attendees.filter((x) => x.status === 'pending' || x.status === 'waitlist')) {
    const u = userById(a.userId);
    const result = evaluate(m, u, u?.cars.find((c) => c.id === a.carId));
    if (result.decision !== 'manual' && STATUS_CHANGES(a.status, result.decision)) {
      applyDecision(m, a, result.decision, result.reasons);
      changed++;
    }
  }
  log(m, `Barrido automático: ${changed} solicitudes resueltas`, 'auto');
  save();
  res.json({ meet: view(m, req.user), changed });
});
const STATUS_CHANGES = (status, decision) => !(status === 'waitlist' && decision === 'waitlist');

r.post('/:id/checkin', (req, res) => {
  const m = load(req, res, true);
  if (!m) return;
  const code = String(req.body.passCode || '').trim().toUpperCase();
  const a = m.attendees.find((x) => x.status === 'approved' && x.passCode === code);
  if (!a) return res.status(404).json({ error: 'Pase inválido o no aprobado' });
  a.checkedIn = true;
  const u = userById(a.userId);
  log(m, `Check-in con pase: @${u?.handle}`, 'mod');
  save();
  res.json({ meet: view(m, req.user), user: mini(u) });
});

r.post('/:id/broadcast', (req, res) => {
  const m = load(req, res, true);
  if (!m) return;
  const text = String(req.body.text || '').trim().slice(0, 280);
  if (!text) return res.status(400).json({ error: 'Mensaje vacío' });
  m.broadcasts.unshift({ at: Date.now(), text, by: req.user.handle });
  log(m, `Broadcast: "${text.slice(0, 40)}"`, 'mod');
  for (const a of m.attendees.filter((x) => x.status === 'approved')) notify(a.userId, `📡 ${m.title}: ${text}`, `/juntadas/${m.id}`);
  save();
  res.json({ meet: view(m, req.user) });
});

export default r;
