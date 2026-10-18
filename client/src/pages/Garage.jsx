import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { CATEGORIES } from '../lib/constants.js';
import { BODIES, bodyFor } from '../lib/car3d.js';
import { colorFromPhoto } from '../lib/photoColor.js';
import Icon from '../components/Icon.jsx';
import { BackBar } from '../components/ui.jsx';
import { CarCard } from './Profile.jsx';

const Scene3D = lazy(() => import('../components/Scene3D.jsx'));

// Fotos incluidas en la app para probar el flujo sin tener una a mano.
const DEMO_PHOTOS = [
  { file: 'r34.jpg', make: 'Nissan', model: 'Skyline R34', category: 'JDM', year: 1999, hp: 330 },
  { file: 'supra.jpg', make: 'Toyota', model: 'Supra MK4', category: 'JDM', year: 1997, hp: 500 },
  { file: 'm3.jpg', make: 'BMW', model: 'M3 E46', category: 'EURO', year: 2003, hp: 343 },
  { file: 'ae86.jpg', make: 'Toyota', model: 'Corolla AE86', category: 'JDM', year: 1986, hp: 130 },
  { file: 'falcon.jpg', make: 'Ford', model: 'Falcon Sprint', category: 'CLÁSICO', year: 1978, hp: 166 },
];
const EMPTY = { make: '', model: '', year: '', category: 'JDM', plate: '', hp: '', mods: '' };

export default function Garage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [activeId, setActiveId] = useState(user.cars[0]?.id || null);
  const [adding, setAdding] = useState(user.cars.length === 0);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [color, setColor] = useState('#d8461b');
  const [colorKind, setColorKind] = useState(null);
  const [bodyOverride, setBodyOverride] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!photo) { setPhotoUrl(null); return undefined; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const active = user.cars.find((c) => c.id === activeId) || user.cars[0];
  const draftBody = bodyOverride || bodyFor(form);
  const stage = adding ? { body: draftBody, color } : { body: bodyFor(active), color: active?.color || '#d8461b' };

  const analyze = async (file) => {
    setPhoto(file);
    setAnalyzing(true);
    try {
      const res = await colorFromPhoto(file);
      setColor(res.color);
      setColorKind(res.kind);
    } catch {
      toast('No pude leer la foto, elegí el color a mano', 'err');
    }
    setAnalyzing(false);
  };

  const useDemo = async () => {
    const demo = DEMO_PHOTOS[Math.floor(Math.random() * DEMO_PHOTOS.length)];
    const blob = await (await fetch(`/demo/${demo.file}`)).blob();
    setForm({ ...EMPTY, make: demo.make, model: demo.model, category: demo.category, year: String(demo.year), hp: String(demo.hp), plate: 'AA000AA' });
    setBodyOverride(null);
    await analyze(new File([blob], demo.file, { type: 'image/jpeg' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    Object.entries({ ...form, color, body: draftBody }).forEach(([k, v]) => fd.append(k, v));
    if (photo) fd.append('photo', photo);
    try {
      const d = await api('/users/me/cars', { method: 'POST', form: fd });
      setUser(d.user);
      setActiveId(d.user.cars[d.user.cars.length - 1].id);
      toast('+15 REP · Auto agregado al garage', 'xp');
      setAdding(false);
      setPhoto(null);
      setForm(EMPTY);
      setBodyOverride(null);
      setColorKind(null);
    } catch (err) { toast(err.message, 'err'); }
    setBusy(false);
  };

  const remove = async (car) => {
    if (!confirm(`¿Sacar ${car.model} del garage?`)) return;
    try { setUser((await api(`/users/me/cars/${car.id}`, { method: 'DELETE' })).user); } catch (err) { toast(err.message, 'err'); }
  };

  return (
    <div className="screen page-enter">
      <BackBar title="Garage" sub="arrastrá para girar" right={<button className="icon-btn on" onClick={() => setAdding((a) => !a)} aria-label="Agregar auto"><Icon name={adding ? 'close' : 'plus'} /></button>} />
      <div className="garage-stage">
        <Suspense fallback={<div className="scene3d" />}>
          <Scene3D mode="garage" body={stage.body} color={stage.color} scanKey={`${stage.body}-${stage.color}`} />
        </Suspense>
        <div className="garage-label">
          <span className="label">Modelo 3D</span>
          <b>{adding ? (form.model || 'Tu auto') : `${active?.make || ''} ${active?.model || ''}`}</b>
          <small className="mono">{BODIES[stage.body].label} · {stage.color.toUpperCase()}</small>
        </div>
        {photoUrl && adding && <img src={photoUrl} alt="" className="garage-source" />}
      </div>

      <div className="pad">
        {!adding && user.cars.length > 1 && (
          <div className="chips mt">
            {user.cars.map((c) => (
              <button key={c.id} className={`chip ${c.id === active?.id ? 'on' : ''}`} onClick={() => setActiveId(c.id)}><span>{c.model}</span></button>
            ))}
          </div>
        )}

        {adding && (
          <form className="panel mt" style={{ padding: 16 }} onSubmit={submit}>
            <div className="h-display h-sm mb">Nuevo auto</div>
            <label className="upload-zone small">
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && analyze(e.target.files[0])} />
              {photoUrl ? <img src={photoUrl} alt="" /> : <div className="upload-hint mono"><Icon name="camera" size={30} /> Subí la foto del auto (patente visible)</div>}
            </label>
            <button type="button" className="btn ghost sm mt-s" onClick={useDemo}><span>Usar foto demo</span></button>

            {(photo || analyzing) && (
              <div className="recon mt">
                <div className="label">Reconstrucción 3D</div>
                {analyzing ? <div className="mono">Analizando la foto…</div> : (
                  <div className="recon-row">
                    <span className="recon-swatch" style={{ background: color }} />
                    <div className="grow">
                      <div className="mono">Color {colorKind === 'neutral' ? 'neutro' : 'detectado'}: <b>{color.toUpperCase()}</b></div>
                      <div className="mono muted" style={{ fontSize: 12 }}>Carrocería: {BODIES[draftBody].label}{bodyOverride ? ' (manual)' : ' (por modelo)'}</div>
                    </div>
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Ajustar color" className="color-input" />
                  </div>
                )}
              </div>
            )}

            <div className="grid-2 mt">
              <label className="field"><span className="label">Marca</span><input className="input" required value={form.make} onChange={set('make')} placeholder="Nissan" /></label>
              <label className="field"><span className="label">Modelo</span><input className="input" required value={form.model} onChange={set('model')} placeholder="Silvia S15" /></label>
              <label className="field"><span className="label">Año</span><input className="input" type="number" value={form.year} onChange={set('year')} placeholder="2001" /></label>
              <label className="field"><span className="label">HP</span><input className="input" type="number" value={form.hp} onChange={set('hp')} placeholder="250" /></label>
            </div>
            <label className="field"><span className="label">Categoría</span>
              <select className="select" value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <div className="label mb">Carrocería</div>
            <div className="chips mb">
              {Object.entries(BODIES).map(([k, b]) => (
                <button type="button" key={k} className={`chip ${draftBody === k ? 'on' : ''}`} onClick={() => setBodyOverride(k)}><span>{b.label}</span></button>
              ))}
            </div>
            <label className="field"><span className="label">Patente (opcional · se muestra enmascarada)</span><input className="input plate-input" value={form.plate} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))} placeholder="AB123CD" maxLength={9} /></label>
            <label className="field"><span className="label">Mods (coma)</span><input className="input" value={form.mods} onChange={set('mods')} placeholder="Turbo, Coilovers, Escape" /></label>
            <div className="mono muted mb" style={{ fontSize: 12 }}>Foto + patente = auto verificado ◆ (lo piden muchas juntadas). Este auto es el que vas a ver manejando en el mapa.</div>
            <button className="btn block" disabled={busy || analyzing}>{busy ? 'Subiendo…' : 'Guardar en garage'}</button>
          </form>
        )}
        <div className="section-title">Tus autos</div>
        {user.cars.length === 0 && <div className="empty">Garage vacío.</div>}
        <div className="stack">{user.cars.map((c) => <CarCard key={c.id} car={c} onDelete={remove} />)}</div>
      </div>
    </div>
  );
}
