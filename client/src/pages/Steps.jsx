import { useAuth } from '../lib/auth.jsx';
import Icon from '../components/Icon.jsx';
import { BackBar, Glitch } from '../components/ui.jsx';

const REWARDS = [
  { pts: 500, title: '10% OFF lavado', where: 'Lavaderos partner', color: 'var(--cyan)' },
  { pts: 1200, title: 'Cambio de aceite -15%', where: 'Talleres partner', color: 'var(--orange)' },
  { pts: 2000, title: 'Tanque de nafta -5%', where: 'Estaciones partner', color: 'var(--lime)' },
  { pts: 3500, title: 'Sesión de dyno', where: 'Racing Lab', color: 'var(--magenta)' },
];

const EARN = [
  ['camera', 'Reportar cámaras, controles y calles rotas', '+5'],
  ['check', 'Validar reportes de otros', '+2'],
  ['pin', 'Sumar talleres / lavaderos al mapa', '+10'],
  ['steps', 'Caminar / manejar con el modo pasos activo', 'pronto'],
];

export default function Steps() {
  const { user } = useAuth();
  return (
    <div className="screen page-enter">
      <BackBar title="Modo pasos" sub="beta cerrada" />
      <div className="pad">
        <div className="coin-stage">
          <div className="coin"><div className="coin-face">V</div><div className="coin-face back">V</div></div>
        </div>
        <div className="steps-points">
          <div className="label">Tus puntos</div>
          <div className="h-display h-xl orange">{user.points}</div>
        </div>
        <div className="tape mt" />
        <h2 className="h-display h-md mt"><Glitch text="PRÓXIMAMENTE" /></h2>
        <p className="muted">Juntá puntos moviéndote y ayudando a la comunidad. Canjealos por descuentos en talleres, lavaderos y estaciones del mapa.</p>

        <div className="section-title">Cómo sumar</div>
        <div className="stack">
          {EARN.map(([icon, text, pts]) => (
            <div key={text} className="row panel" style={{ padding: 12 }}>
              <Icon name={icon} className="cyan" />
              <div className="grow">{text}</div>
              <b className="mono lime">{pts}</b>
            </div>
          ))}
        </div>

        <div className="section-title">Recompensas</div>
        <div className="stack">
          {REWARDS.map((r) => {
            const pct = Math.min(100, (user.points / r.pts) * 100);
            return (
              <div key={r.title} className="reward panel" style={{ '--c': r.color }}>
                <div className="row between">
                  <div><b>{r.title}</b><div className="mono muted" style={{ fontSize: 12 }}>{r.where}</div></div>
                  <Icon name={pct >= 100 ? 'unlock' : 'lock'} style={{ color: r.color }} />
                </div>
                <div className="cap-bar mt-s"><div style={{ width: `${pct}%`, background: r.color }} /></div>
                <div className="mono dim" style={{ fontSize: 11 }}>{user.points}/{r.pts} pts</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
