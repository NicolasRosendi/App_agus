import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapEvents } from 'react-leaflet';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useAuth } from '../lib/auth.jsx';
import { DEFAULT_CENTER } from '../lib/constants.js';
import { dms } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import TacticalMap from '../components/TacticalMap.jsx';
import RulesEditor from '../components/RulesEditor.jsx';
import { BackBar } from '../components/ui.jsx';

function CenterWatcher({ onMove }) {
  useMapEvents({ moveend: (e) => onMove(e.target.getCenter()) });
  return null;
}

const tomorrowNight = () => {
  const d = new Date(Date.now() + 86400000);
  d.setHours(23, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function CreateMeet() {
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const mapRef = useRef(null);
  const [spot, setSpot] = useState(DEFAULT_CENTER);
  const [form, setForm] = useState({
    title: '', desc: '', label: '', startsAt: tomorrowNight(), capacity: 20,
    visibility: 'underground', revealMode: 'hoursBefore', revealHoursBefore: 2, tags: '',
  });
  const [rules, setRules] = useState({ autoApprove: true, strict: false, requireVerifiedCar: false, waitlist: true, minRep: 50, categories: [], trustedCrews: [] });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api('/meets', {
        method: 'POST',
        body: {
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          spot: { lat: spot.lat, lng: spot.lng, label: form.label || 'Spot secreto' },
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          rules,
        },
      });
      toast('+20 REP · Operación creada', 'xp');
      nav(`/juntadas/${d.meet.id}/ops`, { replace: true });
    } catch (err) { toast(err.message, 'err'); setBusy(false); }
  };

  return (
    <form className="screen page-enter" onSubmit={submit}>
      <BackBar title="Nueva operación" right={<button className="btn sm" disabled={busy}>Lanzar</button>} />
      <div className="pad">
        <div className="section-title">01 · Briefing</div>
        <label className="field"><span className="label">Nombre en clave</span><input className="input" required maxLength={40} value={form.title} onChange={set('title')} placeholder="MIDNIGHT // DÁRSENA" /></label>
        <label className="field"><span className="label">Descripción / reglas de la casa</span><textarea className="textarea" value={form.desc} onChange={set('desc')} placeholder="Llegada escalonada, cero quemes…" /></label>
        <div className="grid-2">
          <label className="field"><span className="label">Fecha y hora</span><input className="input" type="datetime-local" required value={form.startsAt} onChange={set('startsAt')} /></label>
          <label className="field"><span className="label">Cupo</span><input className="input" type="number" min="2" max="500" value={form.capacity} onChange={set('capacity')} /></label>
        </div>
        <label className="field"><span className="label">Tags (coma)</span><input className="input" value={form.tags} onChange={set('tags')} placeholder="JDM, NOCTURNA, SIN QUEMES" /></label>

        <div className="section-title">02 · El spot</div>
        <div className="spot-picker">
          <TacticalMap ref={mapRef} center={DEFAULT_CENTER} zoom={13} mapStyle={user.prefs.mapStyle} source={user.prefs.mapSource}>
            <CenterWatcher onMove={(c) => setSpot({ lat: c.lat, lng: c.lng })} />
          </TacticalMap>
          <div className="map-crosshair"><Icon name="crosshair" size={44} stroke={1.5} /></div>
          <div className="spot-coords mono">{dms(spot.lat, spot.lng)}</div>
        </div>
        <label className="field mt"><span className="label">Nombre del spot (solo lo ven los aprobados)</span><input className="input" value={form.label} onChange={set('label')} placeholder="Playón Dársena Sur" /></label>

        <div className="section-title">03 · Privacidad</div>
        <div className="grid-2">
          <button type="button" className={`vis-opt panel ${form.visibility === 'underground' ? 'on' : ''}`} onClick={() => setForm((f) => ({ ...f, visibility: 'underground' }))}>
            <Icon name="eye" /><b>Underground</b><small>Aparece como zona cifrada. Se puede pedir acceso.</small>
          </button>
          <button type="button" className={`vis-opt panel ${form.visibility === 'ghost' ? 'on' : ''}`} onClick={() => setForm((f) => ({ ...f, visibility: 'ghost' }))}>
            <Icon name="skull" /><b>Fantasma</b><small>Invisible. Solo existe con código de invitación.</small>
          </button>
        </div>
        <label className="field mt">
          <span className="label">Revelar ubicación exacta</span>
          <select className="select" value={form.revealMode} onChange={set('revealMode')}>
            <option value="approved">Apenas lo apruebo</option>
            <option value="hoursBefore">X horas antes del evento</option>
          </select>
        </label>
        {form.revealMode === 'hoursBefore' && (
          <label className="field"><span className="label">Horas antes: <b className="orange">{form.revealHoursBefore}</b></span><input type="range" className="range" min="0" max="24" value={form.revealHoursBefore} onChange={set('revealHoursBefore')} /></label>
        )}

        <div className="section-title">04 · Automatización</div>
        <RulesEditor rules={rules} onChange={setRules} />

        <button className="btn block mt" disabled={busy}>{busy ? 'Cifrando…' : 'Lanzar operación'}</button>
      </div>
    </form>
  );
}
