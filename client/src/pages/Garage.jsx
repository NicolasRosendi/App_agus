import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { CATEGORIES } from '../lib/constants.js';
import Icon from '../components/Icon.jsx';
import { BackBar } from '../components/ui.jsx';
import { CarCard } from './Profile.jsx';

const Scene3D = lazy(() => import('../components/Scene3D.jsx'));
const SWATCHES = ['#ff6a00', '#00f0ff', '#ff2bd6', '#c9ff00', '#ff3b3b', '#1b6cff', '#f5f5f5', '#222222'];

export default function Garage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [color, setColor] = useState(user.cars[0]?.color || '#ff6a00');
  const [adding, setAdding] = useState(user.cars.length === 0);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  useEffect(() => {
    if (!photo) { setPhotoUrl(null); return undefined; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const [form, setForm] = useState({ make: '', model: '', year: '', category: 'JDM', plate: '', hp: '', mods: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    Object.entries({ ...form, color }).forEach(([k, v]) => fd.append(k, v));
    if (photo) fd.append('photo', photo);
    try {
      const d = await api('/users/me/cars', { method: 'POST', form: fd });
      setUser(d.user);
      toast('+15 REP · Auto agregado al garage', 'xp');
      setAdding(false);
      setPhoto(null);
      setForm({ make: '', model: '', year: '', category: 'JDM', plate: '', hp: '', mods: '' });
    } catch (err) { toast(err.message, 'err'); }
    setBusy(false);
  };

  const remove = async (car) => {
    if (!confirm(`¿Sacar ${car.model} del garage?`)) return;
    try { setUser((await api(`/users/me/cars/${car.id}`, { method: 'DELETE' })).user); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div className="screen page-enter">
      <BackBar title="Garage" sub="arrastrá para girar" right={<button className="icon-btn on" onClick={() => setAdding((a) => !a)} aria-label="Agregar auto"><Icon name={adding ? 'close' : 'plus'} /></button>} />
      <div className="garage-stage">
        <Suspense fallback={<div className="scene3d" />}>
          <Scene3D mode="garage" color={color} />
        </Suspense>
        <div className="garage-swatches">
          {SWATCHES.map((c) => <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}
        </div>
        <div className="garage-label tag-font">{user.cars[0]?.model || 'tu nave'}</div>
      </div>

      <div className="pad">
        {adding && (
          <form className="panel hud-frame mt" style={{ padding: 16 }} onSubmit={submit}>
            <div className="h-display h-sm mb">Nuevo auto</div>
            <label className="upload-zone small">
              <input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              {photoUrl ? <img src={photoUrl} alt="" /> : <div className="upload-hint mono"><Icon name="camera" size={30} /> Foto del auto (con patente visible)</div>}
            </label>
            <div className="grid-2 mt">
              <label className="field"><span className="label">Marca</span><input className="input" required value={form.make} onChange={set('make')} placeholder="Nissan" /></label>
              <label className="field"><span className="label">Modelo</span><input className="input" required value={form.model} onChange={set('model')} placeholder="Silvia S15" /></label>
              <label className="field"><span className="label">Año</span><input className="input" type="number" value={form.year} onChange={set('year')} placeholder="2001" /></label>
              <label className="field"><span className="label">HP</span><input className="input" type="number" value={form.hp} onChange={set('hp')} placeholder="250" /></label>
            </div>
            <label className="field"><span className="label">Categoría</span>
              <select className="select" value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="field"><span className="label">Patente (opcional · se muestra enmascarada)</span><input className="input plate-input" value={form.plate} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))} placeholder="AB123CD" maxLength={9} /></label>
            <label className="field"><span className="label">Mods (coma)</span><input className="input" value={form.mods} onChange={set('mods')} placeholder="Turbo, Coilovers, Escape" /></label>
            <div className="mono muted mb" style={{ fontSize: 12 }}>Foto + patente = auto verificado ◆ (requisito de muchas juntadas). Color: el que elegiste arriba.</div>
            <button className="btn block" disabled={busy}>{busy ? 'Subiendo…' : 'Guardar en garage'}</button>
          </form>
        )}
        <div className="section-title">Tus autos</div>
        {user.cars.length === 0 && <div className="empty">Garage vacío.</div>}
        <div className="stack">{user.cars.map((c) => <CarCard key={c.id} car={c} onDelete={remove} />)}</div>
      </div>
    </div>
  );
}
