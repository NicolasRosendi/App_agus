import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Circle, Marker } from 'react-leaflet';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { useInterval } from '../lib/useInterval.js';
import { MEET_STATUS, STATUS_LABEL } from '../lib/constants.js';
import { dateLabel, timeAgo } from '../lib/format.js';
import { spotIcon } from '../lib/mapIcons.js';
import Icon from '../components/Icon.jsx';
import TacticalMap from '../components/TacticalMap.jsx';
import PassCard from '../components/PassCard.jsx';
import { Avatar, BackBar, Countdown, Glitch, Overlay } from '../components/ui.jsx';

function AccessFlash({ decision, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 1900); return () => clearTimeout(t); }, [onDone]);
  const map = {
    approve: ['ACCESO CONCEDIDO', 'lime'],
    manual: ['EN VALIDACIÓN', 'yellow'],
    waitlist: ['LISTA DE ESPERA', 'cyan'],
    reject: ['ACCESO DENEGADO', 'red'],
  };
  const [text, color] = map[decision];
  return (
    <Overlay>
      <div className={`access-flash ${color}`}>
        <div className="mono">{'>'} handshake… {decision === 'reject' ? 'FAIL' : 'OK'}</div>
        <h2 className="h-display h-xl"><Glitch text={text} /></h2>
      </div>
    </Overlay>
  );
}

export default function MeetDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [meet, setMeet] = useState(null);
  const [carId, setCarId] = useState(user.cars[0]?.id || '');
  const [message, setMessage] = useState('');
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api(`/meets/${id}`).then((d) => setMeet(d.meet)).catch((e) => { toast(e.message, 'err'); nav('/juntadas'); });
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useInterval(load, 30000);

  if (!meet) return <div className="screen"><BackBar title="Descifrando…" /><div className="spinner" /></div>;

  const apply = async () => {
    setBusy(true);
    try {
      const d = await api(`/meets/${id}/apply`, { method: 'POST', body: { carId, message } });
      setMeet(d.meet);
      setFlash(d.decision);
    } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const leave = async () => {
    if (!confirm('¿Bajarte de la juntada? Tu lugar pasa a la lista de espera.')) return;
    try { setMeet((await api(`/meets/${id}/leave`, { method: 'POST' })).meet); } catch (e) { toast(e.message, 'err'); }
  };

  const staff = meet.role === 'organizer' || meet.role === 'coorganizer';
  const st = meet.me && STATUS_LABEL[meet.me.status];
  const canApply = !staff && (!meet.me || ['rejected', 'left'].includes(meet.me.status)) && meet.status === 'active';
  const myCar = user.cars.find((c) => c.id === meet.me?.carId);
  const center = meet.spot || meet.zone;

  return (
    <div className="screen page-enter">
      {flash && <AccessFlash decision={flash} onDone={() => setFlash(null)} />}
      <BackBar title={meet.title} sub={`por @${meet.organizer.handle}`} right={staff && <Link to={`/juntadas/${id}/ops`} className="btn sm">Ops</Link>} />

      <div className="meet-hero">
        <TacticalMap center={center} zoom={meet.spot ? 15 : 13} interactive={false} className="meet-map" mapStyle={user.prefs.mapStyle} source={user.prefs.mapSource}>
          {meet.spot ? (
            <Marker position={[meet.spot.lat, meet.spot.lng]} icon={spotIcon(meet.spot.label)} />
          ) : (
            <Circle center={[meet.zone.lat, meet.zone.lng]} radius={meet.zone.radius} pathOptions={{ className: 'zone-circle', color: '#e8621a', weight: 2, dashArray: '2 10', fillColor: '#e8621a', fillOpacity: 0.1 }} />
          )}
        </TacticalMap>
        {!meet.spot && (
          <div className="meet-hero-lock">
            <Icon name="lock" size={34} />
            <div className="h-display h-sm">UBICACIÓN CIFRADA</div>
            <div className="mono" style={{ fontSize: 12 }}>
              {meet.me?.status === 'approved' && meet.revealAt ? <>se revela en <Countdown to={meet.revealAt} className="lime" /></> : 'solo para aprobados'}
            </div>
          </div>
        )}
        <div className="meet-hero-count panel">
          <div className="label">T-menos</div>
          <Countdown to={meet.startsAt} className="h-display h-md orange" />
        </div>
      </div>

      <div className="pad">
        <div className="row wrap mt">
          {meet.visibility === 'ghost' && <span className="sticker magenta">FANTASMA</span>}
          {st && <span className="sticker" style={{ background: st.color }}>{st.text}</span>}
          {meet.status !== 'active' && <span className="sticker red">{MEET_STATUS[meet.status]}</span>}
          <span className="badge muted">{dateLabel(meet.startsAt)}</span>
        </div>
        <p className="meet-desc">{meet.desc}</p>
        {meet.spot && <div className="mono cyan"><Icon name="pin" size={14} /> {meet.spot.label}</div>}

        <div className="grid-3 mt meet-stats">
          <div className="stat"><b>{meet.approved}</b><small>confirmados</small></div>
          <div className="stat"><b>{meet.capacity}</b><small>cupo</small></div>
          <div className="stat"><b>{meet.rules.minRep}</b><small>rep mín.</small></div>
        </div>

        <div className="section-title">Requisitos</div>
        <ul className="req-list mono">
          <li className={user.rep >= meet.rules.minRep ? 'ok' : 'ko'}>Rep ≥ {meet.rules.minRep} <span className="dim">(tenés {user.rep})</span></li>
          {meet.rules.requireVerifiedCar && <li className={user.verified ? 'ok' : 'ko'}>Auto con patente verificada</li>}
          {meet.rules.categories.length > 0 && <li className={user.cars.some((c) => meet.rules.categories.includes(c.category)) ? 'ok' : 'ko'}>Categorías: {meet.rules.categories.join(' · ')}</li>}
          {meet.rules.waitlist && <li className="ok">Lista de espera automática si se llena</li>}
        </ul>

        {meet.me?.reason && meet.me.status !== 'approved' && <div className="panel accent mono mt" style={{ padding: 12, fontSize: 13 }}>{'> '}{meet.me.reason}</div>}

        {canApply && (
          <div className="panel hud-frame mt" style={{ padding: 16 }}>
            <div className="h-display h-sm mb">Solicitar acceso</div>
            {user.cars.length === 0 ? (
              <div className="mono muted">Necesitás un auto en tu garage. <Link to="/garage" className="orange">Agregar →</Link></div>
            ) : (
              <>
                <label className="field">
                  <span className="label">Con qué auto vas</span>
                  <select className="select" value={carId} onChange={(e) => setCarId(e.target.value)}>
                    {user.cars.map((c) => <option key={c.id} value={c.id}>{c.make} {c.model} · {c.category}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Mensaje al organizador</span>
                  <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Quién sos, quién te invitó…" />
                </label>
                <button className="btn block" disabled={busy} onClick={apply}>{busy ? 'Validando…' : 'Solicitar acceso'}</button>
              </>
            )}
          </div>
        )}

        {meet.me?.status === 'approved' && (
          <>
            <div className="section-title">Tu pase</div>
            <PassCard meet={meet} user={user} car={myCar} />
            {meet.me.checkedIn && <div className="mono lime mt-s">✔ CHECK-IN REALIZADO</div>}
          </>
        )}

        {meet.broadcasts.length > 0 && (
          <>
            <div className="section-title">Canal del organizador</div>
            <div className="stack">
              {meet.broadcasts.map((b, i) => (
                <div key={i} className="broadcast">
                  <Icon name="broadcast" size={16} className="orange" />
                  <div><div>{b.text}</div><div className="mono dim" style={{ fontSize: 11 }}>{b.by ? `@${b.by} · ` : ''}hace {timeAgo(b.at)}</div></div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="section-title">Organiza</div>
        <Link to={`/perfil/${meet.organizer.handle}`} className="row panel" style={{ padding: 12 }}>
          <Avatar user={meet.organizer} />
          <div className="grow"><b>@{meet.organizer.handle}</b><div className="mono muted" style={{ fontSize: 12 }}>{meet.organizer.crew || 'sin crew'} · {meet.organizer.rep} rep</div></div>
          <Icon name="back" style={{ transform: 'rotate(180deg)' }} />
        </Link>

        {meet.me && ['approved', 'pending', 'waitlist'].includes(meet.me.status) && !staff && (
          <button className="btn ghost red block mt" onClick={leave}><span>Bajarme</span></button>
        )}
      </div>
    </div>
  );
}
