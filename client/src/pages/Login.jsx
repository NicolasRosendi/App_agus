import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { Glitch } from '../components/ui.jsx';

const Scene3D = lazy(() => import('../components/Scene3D.jsx'));

const BOOT = [
  'VELOX OS v0.1 // kernel underground',
  'montando red mesh............ OK',
  'cifrando canal p2p........... OK',
  'cargando mapa táctico........ OK',
  'ocultando juntadas........... OK',
  'esperando credenciales_',
];

const DEMO = [
  { handle: 'ghost', who: 'Organizador', color: 'var(--orange)' },
  { handle: 'turbo_vale', who: 'Piloto', color: 'var(--magenta)' },
  { handle: 'drift_kid', who: 'Novato', color: 'var(--lime)' },
];

export default function Login() {
  const { enter } = useAuth();
  const [lines, setLines] = useState(0);
  const [mode, setMode] = useState('login');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lines >= BOOT.length) return undefined;
    const t = setTimeout(() => setLines((n) => n + 1), 220);
    return () => clearTimeout(t);
  }, [lines]);

  const submit = async (e, h = handle, p = password, m = mode) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try { await enter(m, h, p); } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="login">
      <Suspense fallback={<div className="scene3d" />}>
        <Scene3D mode="drive" color="#c8401a" className="login-bg" />
      </Suspense>
      <div className="login-shade" />
      <div className="login-content">
        <div className="login-brand">
          <div className="tag-font login-spray">underground</div>
          <h1 className="h-display h-xl"><Glitch text="VELOX" /></h1>
          <div className="label cyan">// drive · convoy · desaparecer</div>
        </div>

        <pre className="boot mono">
          {BOOT.slice(0, lines).map((l, i) => <div key={i} style={{ animationDelay: `${i * 20}ms` }}>{'> '}{l}</div>)}
        </pre>

        <form className="panel hud-frame login-form" onSubmit={submit}>
          <div className="row mb">
            <button type="button" className={`chip ${mode === 'login' ? 'on' : ''}`} onClick={() => setMode('login')}><span>Ingresar</span></button>
            <button type="button" className={`chip ${mode === 'register' ? 'on cyan' : ''}`} onClick={() => setMode('register')}><span>Nuevo alias</span></button>
          </div>
          <label className="field">
            <span className="label">Alias</span>
            <input className="input" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="ghost" autoCapitalize="none" autoComplete="username" required />
          </label>
          <label className="field">
            <span className="label">Clave</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </label>
          {error && <div className="mono red mb">! {error}</div>}
          <button className="btn block" disabled={busy}>{busy ? 'Conectando…' : mode === 'login' ? 'Entrar al sistema' : 'Crear identidad'}</button>
        </form>

        <div className="demo-access">
          <div className="label mb">Acceso rápido demo · clave: velox</div>
          <div className="row">
            {DEMO.map((d) => (
              <button key={d.handle} className="demo-chip" style={{ '--c': d.color }} disabled={busy} onClick={() => submit(null, d.handle, 'velox', 'login')}>
                <b>@{d.handle}</b><small>{d.who}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
