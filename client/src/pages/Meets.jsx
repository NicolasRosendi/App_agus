import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { STATUS_LABEL } from '../lib/constants.js';
import { dateLabel } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import Notifications from '../components/Notifications.jsx';
import { Countdown, TiltCard } from '../components/ui.jsx';

export function MeetCard({ m }) {
  const st = m.me && STATUS_LABEL[m.me.status];
  const pct = Math.min(100, (m.approved / m.capacity) * 100);
  return (
    <TiltCard max={6} className="meet-card-wrap">
      <Link to={`/juntadas/${m.id}`} className={`meet-card panel ${m.visibility === 'ghost' ? 'ghost' : ''}`}>
        <div className="meet-card-bg" />
        <div className="row between">
          <span className="label">{dateLabel(m.startsAt)}</span>
          {m.role === 'organizer' && <span className="sticker orange">ORGANIZÁS</span>}
          {m.role === 'coorganizer' && <span className="sticker cyan">CO-ORG</span>}
          {m.status === 'live' && <span className="sticker red">EN VIVO</span>}
          {m.status === 'locked' && <span className="badge muted"><Icon name="lock" size={12} /> CERRADA</span>}
          {m.status === 'cancelled' && <span className="badge red">CANCELADA</span>}
        </div>
        <h3 className="h-display h-lg meet-card-title">{m.title}</h3>
        {m.tags.length > 0 && <div className="mono muted" style={{ fontSize: 12, letterSpacing: '0.08em' }}>{m.tags.slice(0, 3).join(' · ')}</div>}
        <div className="meet-card-meta mono">
          <span>{m.revealed ? <><Icon name="unlock" size={14} /> {m.spot.label}</> : <><Icon name="lock" size={14} /> UBICACIÓN CIFRADA</>}</span>
          <span>T- <Countdown to={m.startsAt} className="orange" /></span>
        </div>
        <div className="cap-bar"><div style={{ width: `${pct}%` }} /></div>
        <div className="row between mono" style={{ fontSize: 12 }}>
          <span className="muted">{m.approved}/{m.capacity} confirmados · por @{m.organizer.handle}</span>
          {st && <span style={{ color: st.color }}>{st.text}</span>}
        </div>
      </Link>
    </TiltCard>
  );
}

export default function Meets() {
  const [meets, setMeets] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const nav = useNavigate();

  useEffect(() => { api('/meets').then((d) => setMeets(d.meets)).catch((e) => toast(e.message, 'err')); }, [toast]);

  const redeem = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api('/meets/redeem', { method: 'POST', body: { code } });
      const msg = { approve: 'ACCESO CONCEDIDO', manual: 'Código válido · esperando validación', waitlist: 'En lista de espera', reject: `Denegado: ${d.reasons.join(', ')}` }[d.decision];
      toast(msg, d.decision === 'reject' ? 'err' : 'ok');
      nav(`/juntadas/${d.meet.id}`);
    } catch (err) { toast(err.message, 'err'); }
    setBusy(false);
  };

  const mine = meets?.filter((m) => m.role !== 'guest') || [];
  const radar = meets?.filter((m) => m.role === 'guest') || [];

  return (
    <div className="screen page-enter">
      <div className="topbar">
        <div className="grow">
          <div className="h-display h-md">JUNTADAS</div>
          <div className="label" style={{ fontSize: 10 }}>canal cifrado · solo con invitación</div>
        </div>
        <Notifications />
        <Link to="/juntadas/nueva" className="icon-btn on" aria-label="Crear juntada"><Icon name="plus" /></Link>
      </div>
      <div className="pad">
        <form className="panel hud-frame redeem mt" onSubmit={redeem}>
          <div className="label cyan mb"><Icon name="key" size={14} /> ¿Te pasaron un código?</div>
          <div className="row">
            <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-0000" autoCapitalize="characters" />
            <button className="btn cyan" disabled={busy || !code}>Hackear</button>
          </div>
        </form>

        {!meets && <div className="spinner" />}
        {mine.length > 0 && <div className="section-title">Tus operaciones</div>}
        <div className="stack">{mine.map((m) => <MeetCard key={m.id} m={m} />)}</div>
        {radar.length > 0 && <div className="section-title">En el radar</div>}
        <div className="stack">{radar.map((m) => <MeetCard key={m.id} m={m} />)}</div>
        {meets && meets.length === 0 && <div className="empty">No hay señales. Creá la primera.</div>}
        <div className="empty dim" style={{ paddingTop: 24 }}>// Las juntadas fantasma no aparecen acá. Solo se acceden con código.</div>
      </div>
    </div>
  );
}
