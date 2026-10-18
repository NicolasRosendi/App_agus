import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useInterval } from '../lib/useInterval.js';
import { MEET_STATUS, STATUS_LABEL } from '../lib/constants.js';
import { timeAgo } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import RulesEditor from '../components/RulesEditor.jsx';
import { Avatar, BackBar, Countdown } from '../components/ui.jsx';

const TABS = [['cola', 'Cola'], ['lista', 'Lista'], ['codigos', 'Códigos'], ['auto', 'Auto'], ['control', 'Control'], ['log', 'Log']];

function AttendeeRow({ a, act, actions }) {
  const st = STATUS_LABEL[a.status];
  return (
    <div className="att-row panel">
      <Link to={`/perfil/${a.user.handle}`}><Avatar user={a.user} /></Link>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <b>@{a.user.handle}</b>
          {a.verified && <span className="cyan" title="Patente verificada">◆</span>}
          {a.checkedIn && <span className="badge lime">IN</span>}
        </div>
        <div className="mono muted" style={{ fontSize: 12 }}>
          {a.car ? `${a.car.make} ${a.car.model} · ${a.car.category}` : 'sin auto'} · {a.user.rep} rep · vía {a.via}
        </div>
        {a.message && <div className="att-msg">“{a.message}”</div>}
        {a.reason && <div className="mono dim" style={{ fontSize: 11 }}>{'> '}{a.reason}</div>}
        <div className="row wrap mt-s" style={{ gap: 6 }}>
          <span className="mono" style={{ color: st?.color, fontSize: 11 }}>{st?.text}</span>
          <div className="grow" />
          {actions.map(([action, label, cls]) => (
            <button key={action} className={`btn xs ${cls}`} onClick={() => act(a, action)}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MeetOps() {
  const { id } = useParams();
  const toast = useToast();
  const [meet, setMeet] = useState(null);
  const [tab, setTab] = useState('cola');
  const [rules, setRules] = useState(null);
  const [broadcast, setBroadcast] = useState('');
  const [pass, setPass] = useState('');
  const [codeOpts, setCodeOpts] = useState({ maxUses: 5, autoApprove: false, expiresHours: 0 });

  const load = () => api(`/meets/${id}`).then((d) => { setMeet(d.meet); setRules((r) => r || d.meet.rulesFull); }).catch((e) => toast(e.message, 'err'));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useInterval(load, 15000);

  const call = async (path, body, okMsg) => {
    try {
      const d = await api(`/meets/${id}${path}`, { method: 'POST', body });
      setMeet(d.meet);
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(d) : okMsg, 'ok');
      return d;
    } catch (e) { toast(e.message, 'err'); return null; }
  };

  if (!meet) return <div className="screen"><BackBar title="Ops" /><div className="spinner" /></div>;
  if (!meet.attendees) return <div className="screen"><BackBar title="Ops" /><div className="empty">Solo el organizador tiene acceso a este panel.</div></div>;

  const by = (s) => meet.attendees.filter((a) => s.includes(a.status));
  const queue = by(['pending', 'waitlist']);
  const act = (a, action) => {
    if (action === 'ban' && !confirm(`¿Banear a @${a.user.handle} de este evento?`)) return;
    call(`/attendees/${a.userId}`, { action }, `@${a.user.handle} → ${action}`);
  };
  const saveRules = async () => {
    try {
      const d = await api(`/meets/${id}`, { method: 'PATCH', body: { rules } });
      setMeet(d.meet);
      toast('Reglas guardadas', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast(`${text} copiado`, 'ok'); } catch { toast(text); }
  };
  const shareCode = async (c) => {
    const text = `Te paso acceso a una juntada. Código: ${c.code} — entrá a VELOX → Juntadas → Hackear. ${location.origin}`;
    if (navigator.share) navigator.share({ text }).catch(() => {}); else copy(text);
  };

  return (
    <div className="screen page-enter">
      <BackBar title="Panel de ops" sub={meet.title} right={<Link to={`/juntadas/${id}`} className="icon-btn"><Icon name="eye" /></Link>} />

      <div className="ops-summary pad">
        <div className="grid-3 mt">
          <div className="stat"><b className="lime">{by(['approved']).length}/{meet.capacity}</b><small>aprobados</small></div>
          <div className="stat"><b className="yellow">{by(['pending']).length}</b><small>en cola</small></div>
          <div className="stat"><b className="cyan">{by(['waitlist']).length}</b><small>espera</small></div>
        </div>
        <div className="row between mono mt-s" style={{ fontSize: 12 }}>
          <span>ESTADO: <b className="orange">{MEET_STATUS[meet.status]}</b></span>
          <span>T- <Countdown to={meet.startsAt} className="orange" /></span>
        </div>
      </div>

      <div className="ops-tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={`ops-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {l}{k === 'cola' && queue.length > 0 && <span className="notif-count static">{queue.length}</span>}
          </button>
        ))}
      </div>

      <div className="pad">
        {tab === 'cola' && (
          <div className="stack mt">
            {queue.length > 0 && (
              <button className="btn cyan block" onClick={() => call('/automation/run', {}, (d) => `Barrido: ${d.changed} resueltas`)}><Icon name="bolt" size={18} /> Aplicar reglas a la cola</button>
            )}
            {queue.length === 0 && <div className="empty">Cola vacía. La automatización está haciendo su trabajo.</div>}
            {queue.map((a) => (
              <AttendeeRow key={a.userId} a={a} act={act} actions={[['approve', 'Aprobar', 'lime'], ['reject', 'Rechazar', 'red'], ...(a.status === 'pending' ? [['waitlist', 'Espera', 'cyan']] : [])]} />
            ))}
          </div>
        )}

        {tab === 'lista' && (
          <div className="stack mt">
            {by(['approved']).map((a) => (
              <AttendeeRow key={a.userId} a={a} act={act} actions={[
                ...(!a.checkedIn ? [['checkin', 'Check-in', 'lime']] : []),
                ...(meet.role === 'organizer' && !meet.coOrganizers.some((c) => c.id === a.userId) ? [['promote', 'Co-org', 'cyan']] : []),
                ['kick', 'Expulsar', 'magenta'], ['ban', 'Ban', 'red'],
              ]} />
            ))}
            {by(['rejected', 'kicked', 'left']).length > 0 && <div className="section-title">Afuera</div>}
            {by(['rejected', 'kicked', 'left']).map((a) => <AttendeeRow key={a.userId} a={a} act={act} actions={[['approve', 'Readmitir', 'lime']]} />)}
            {meet.banned.length > 0 && <div className="mono red">Baneados: {meet.banned.map((u) => `@${u.handle}`).join(', ')}</div>}
          </div>
        )}

        {tab === 'codigos' && (
          <div className="mt">
            <div className="panel hud-frame" style={{ padding: 14 }}>
              <div className="label cyan mb">Generar invitación</div>
              <div className="grid-2">
                <label className="field"><span className="label">Usos</span><input className="input" type="number" min="1" value={codeOpts.maxUses} onChange={(e) => setCodeOpts((o) => ({ ...o, maxUses: e.target.value }))} /></label>
                <label className="field"><span className="label">Vence (hs, 0 = no)</span><input className="input" type="number" min="0" value={codeOpts.expiresHours} onChange={(e) => setCodeOpts((o) => ({ ...o, expiresHours: e.target.value }))} /></label>
              </div>
              <label className="toggle">
                <div><b>Auto-aprueba</b><div className="muted" style={{ fontSize: 13 }}>Quien lo use entra directo (si cumple lo mínimo).</div></div>
                <input type="checkbox" checked={codeOpts.autoApprove} onChange={(e) => setCodeOpts((o) => ({ ...o, autoApprove: e.target.checked }))} />
                <span className="sw" />
              </label>
              <button className="btn block mt" onClick={() => call('/codes', { ...codeOpts, expiresHours: Number(codeOpts.expiresHours) || null }, (d) => `Código ${d.code.code} listo`)}><Icon name="key" size={18} /> Generar código</button>
            </div>
            <div className="stack mt">
              {meet.codes.length === 0 && <div className="empty">Sin códigos activos.</div>}
              {meet.codes.map((c) => (
                <div key={c.code} className="code-row panel">
                  <div className="grow">
                    <div className="h-display h-sm code-txt">{c.code}</div>
                    <div className="mono muted" style={{ fontSize: 12 }}>
                      {c.uses}/{c.maxUses} usos{c.autoApprove ? ' · auto-aprueba' : ''}{c.expiresAt ? ` · vence ${c.expiresAt > Date.now() ? `en ${Math.ceil((c.expiresAt - Date.now()) / 3600000)}h` : 'VENCIDO'}` : ''}
                    </div>
                  </div>
                  <button className="icon-btn" onClick={() => shareCode(c)} aria-label="Compartir"><Icon name="share" size={18} /></button>
                  <button className="icon-btn" onClick={async () => { try { setMeet((await api(`/meets/${id}/codes/${c.code}`, { method: 'DELETE' })).meet); } catch (e) { toast(e.message, 'err'); } }} aria-label="Revocar"><Icon name="trash" size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'auto' && rules && (
          <div className="mt">
            <div className="panel accent mono" style={{ padding: 12, fontSize: 12 }}>
              {'> '}Orden de evaluación: baneo → cierre → reglas duras/blandas → cupo → crew de confianza → código → auto-aprobación → tu cola.
            </div>
            <RulesEditor rules={rules} onChange={setRules} />
            <div className="grid-2 mt">
              <button className="btn" onClick={saveRules}>Guardar</button>
              <button className="btn cyan" onClick={async () => { await saveRules(); call('/automation/run', {}, (d) => `Barrido: ${d.changed} resueltas`); }}>Guardar + barrer</button>
            </div>
          </div>
        )}

        {tab === 'control' && (
          <div className="mt">
            <div className="label mb">Estado del evento</div>
            <div className="grid-2">
              {meet.status !== 'live' && <button className="btn red sm" onClick={() => call('/status', { status: 'live' }, 'EN VIVO')}>Arrancar (en vivo)</button>}
              {meet.status === 'active' && <button className="btn ghost sm" onClick={() => call('/status', { status: 'locked' }, 'Convocatoria cerrada')}><span>Cerrar convocatoria</span></button>}
              {meet.status === 'locked' && <button className="btn lime sm" onClick={() => call('/status', { status: 'active' }, 'Convocatoria abierta')}>Reabrir</button>}
              {meet.status === 'live' && <button className="btn ghost sm" onClick={() => call('/status', { status: 'ended' }, 'Evento finalizado')}><span>Finalizar</span></button>}
              {meet.status !== 'cancelled' && <button className="btn ghost red sm" onClick={() => confirm('¿Cancelar el evento? Se notifica a todos.') && call('/status', { status: 'cancelled' }, 'Cancelado')}><span>Cancelar</span></button>}
            </div>

            <div className="label mt mb">Ubicación</div>
            <div className="panel" style={{ padding: 12 }}>
              <div className="mono cyan">{meet.spot.label}</div>
              <div className="mono muted" style={{ fontSize: 12 }}>
                {meet.revealedManually ? 'Revelada manualmente' : meet.revealMode === 'approved' ? 'Visible para aprobados' : <>Se revela en <Countdown to={meet.revealAt} /></>}
              </div>
              {!meet.revealedManually && meet.revealMode !== 'approved' && (
                <button className="btn lime sm mt-s" onClick={() => call('/reveal', {}, 'Ubicación revelada')}><Icon name="unlock" size={16} /> Revelar ahora</button>
              )}
            </div>

            <div className="label mt mb">Broadcast a aprobados</div>
            <div className="row">
              <input className="input" value={broadcast} maxLength={280} onChange={(e) => setBroadcast(e.target.value)} placeholder="Cambio de horario, entrada por…" />
              <button className="icon-btn on" onClick={async () => { if (await call('/broadcast', { text: broadcast }, 'Transmitido')) setBroadcast(''); }} aria-label="Enviar"><Icon name="send" /></button>
            </div>

            <div className="label mt mb">Check-in por código de pase</div>
            <div className="row">
              <input className="input" value={pass} onChange={(e) => setPass(e.target.value.toUpperCase())} placeholder="A1B2C3" />
              <button className="btn lime" onClick={async () => { const d = await call('/checkin', { passCode: pass }, (x) => `Check-in @${x.user.handle}`); if (d) setPass(''); }}>OK</button>
            </div>
          </div>
        )}

        {tab === 'log' && (
          <div className="terminal mt mono">
            {meet.log.map((l, i) => (
              <div key={i} className={`log-${l.kind}`}>
                <span className="dim">[{timeAgo(l.at)}]</span> <span className="log-kind">{l.kind.toUpperCase()}</span> {l.text}
              </div>
            ))}
            <div className="cursor">_</div>
          </div>
        )}
      </div>
    </div>
  );
}
