import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { CATEGORIES } from '../lib/constants.js';
import Icon from '../components/Icon.jsx';
import { BackBar } from '../components/ui.jsx';

const COLORS = ['#e8621a', '#6fa8c7', '#c2417d', '#a9c93a', '#d8372b', '#f2c230', '#ece3cf'];

function InstallCard() {
  const [prompt, setPrompt] = useState(null);
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (standalone) return <div className="mono lime">✔ App instalada</div>;
  return (
    <div className="panel accent-cyan" style={{ padding: 14 }}>
      <div className="h-display h-sm">Instalar en el celular</div>
      {prompt ? (
        <button className="btn cyan block mt-s" onClick={() => prompt.prompt()}>Instalar VELOX</button>
      ) : ios ? (
        <p className="mono muted" style={{ fontSize: 13 }}>iPhone: Safari → botón Compartir → “Agregar a inicio”.</p>
      ) : (
        <p className="mono muted" style={{ fontSize: 13 }}>Android: Chrome → menú ⋮ → “Instalar app” / “Agregar a pantalla principal”.</p>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, bio: user.bio || '', crew: user.crew || '', color: user.color, interests: user.interests });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (c) => setForm((f) => ({ ...f, interests: f.interests.includes(c) ? f.interests.filter((x) => x !== c) : [...f.interests, c] }));

  const save = async () => {
    try {
      setUser((await api('/users/me', { method: 'PATCH', body: form })).user);
      toast('Perfil actualizado', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div className="screen page-enter">
      <BackBar title="Ajustes" right={<button className="btn sm" onClick={save}>Guardar</button>} />
      <div className="pad">
        <div className="section-title">Identidad</div>
        <label className="field"><span className="label">Nombre</span><input className="input" value={form.name} onChange={set('name')} maxLength={30} /></label>
        <label className="field"><span className="label">Bio</span><textarea className="textarea" value={form.bio} onChange={set('bio')} maxLength={160} /></label>
        <label className="field"><span className="label">Crew</span><input className="input" value={form.crew} onChange={(e) => setForm((f) => ({ ...f, crew: e.target.value.toUpperCase() }))} maxLength={24} placeholder="NOCTURNOS" /></label>
        <div className="label mb">Color de firma</div>
        <div className="row">{COLORS.map((c) => <button key={c} className={`swatch ${form.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setForm((f) => ({ ...f, color: c }))} aria-label={c} />)}</div>

        <div className="section-title">Tus intereses</div>
        <div className="muted mb" style={{ fontSize: 13 }}>Personalizan tu feed "Para vos".</div>
        <div className="chips">{CATEGORIES.map((c) => <button key={c} className={`chip ${form.interests.includes(c) ? 'on' : ''}`} onClick={() => toggle(c)}><span>{c}</span></button>)}</div>

        <div className="section-title">App</div>
        <InstallCard />
        <div className="mono muted mt" style={{ fontSize: 12 }}>Capas del mapa y qué evita la ruta fantasma se configuran desde el mapa → <Icon name="layers" size={12} />.</div>

        <button className="btn ghost red block mt" onClick={logout}><span><Icon name="logout" size={18} /> Desconectar</span></button>
      </div>
    </div>
  );
}
