// Motor de reglas de la juntada: decide solo lo que el organizador configuró
// y deja en cola manual todo lo dudoso. Cada decisión queda en el log de ops.
import crypto from 'node:crypto';
import { db } from './db.js';
import { notify } from './notify.js';

export const passCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

export const approvedCount = (meet) => meet.attendees.filter((a) => a.status === 'approved').length;

export function log(meet, text, kind = 'sys') {
  meet.log.unshift({ at: Date.now(), kind, text });
  meet.log.length = Math.min(meet.log.length, 200);
}

/**
 * @returns {{ decision: 'approve'|'reject'|'manual'|'waitlist', reasons: string[] }}
 */
export function evaluate(meet, user, car, { code } = {}) {
  const rules = meet.rules;
  const hard = [];
  const soft = [];

  if (meet.banned.includes(user.id)) return { decision: 'reject', reasons: ['Usuario baneado por el organizador'] };
  if (meet.status === 'locked') return { decision: 'reject', reasons: ['Convocatoria cerrada'] };
  if (meet.status === 'cancelled') return { decision: 'reject', reasons: ['Evento cancelado'] };

  const fail = (msg) => (rules.strict ? hard : soft).push(msg);
  if (user.rep < (rules.minRep || 0)) fail(`Rep ${user.rep} < mínimo ${rules.minRep}`);
  if (rules.requireVerifiedCar && !car?.plateVerified) fail('Auto sin patente verificada');
  if (rules.categories?.length && !rules.categories.includes(car?.category)) fail(`Categoría ${car?.category || '—'} fuera de la convocatoria`);
  if (!car) hard.push('Sin auto en el garage');

  if (hard.length) return { decision: 'reject', reasons: hard };

  const full = approvedCount(meet) >= meet.capacity;
  const trusted = user.crew && rules.trustedCrews?.includes(user.crew);
  const codeOk = code?.autoApprove;
  const reasons = [...soft];

  if (soft.length) return { decision: 'manual', reasons };
  if (full) return { decision: rules.waitlist ? 'waitlist' : 'reject', reasons: ['Cupo completo'] };
  if (trusted) return { decision: 'approve', reasons: [`Crew de confianza: ${user.crew}`] };
  if (codeOk) return { decision: 'approve', reasons: [`Código ${code.code} con auto-aprobación`] };
  if (rules.autoApprove) return { decision: 'approve', reasons: ['Cumple todas las reglas'] };
  return { decision: 'manual', reasons: ['Revisión manual del organizador'] };
}

const STATUS_FOR = { approve: 'approved', reject: 'rejected', manual: 'pending', waitlist: 'waitlist' };

export function applyDecision(meet, attendee, decision, reasons, actor = 'AUTO') {
  attendee.status = STATUS_FOR[decision];
  attendee.reason = reasons.join(' · ');
  if (attendee.status === 'approved' && !attendee.passCode) attendee.passCode = passCode();
  const u = db().users.find((x) => x.id === attendee.userId);
  log(meet, `${actor} → @${u?.handle} ${attendee.status.toUpperCase()}${reasons.length ? ` (${attendee.reason})` : ''}`, actor === 'AUTO' ? 'auto' : 'mod');
  const msgs = {
    approved: `ACCESO CONCEDIDO a ${meet.title}. Tu pase está listo.`,
    rejected: `Solicitud rechazada para ${meet.title}.`,
    waitlist: `Estás en lista de espera para ${meet.title}.`,
    pending: `Solicitud enviada a ${meet.title}. Esperando validación.`,
  };
  notify(attendee.userId, msgs[attendee.status], `/juntadas/${meet.id}`);
}

// Cuando se libera un lugar, sube el primero de la lista de espera.
export function promoteWaitlist(meet) {
  while (approvedCount(meet) < meet.capacity) {
    const next = meet.attendees.filter((a) => a.status === 'waitlist').sort((a, b) => a.at - b.at)[0];
    if (!next) return;
    applyDecision(meet, next, 'approve', ['Se liberó cupo (lista de espera)']);
  }
}
