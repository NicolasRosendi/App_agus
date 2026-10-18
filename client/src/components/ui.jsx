import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useNow } from '../lib/useInterval.js';
import { countdown } from '../lib/format.js';

export function Avatar({ user, size = '', onClick }) {
  if (!user) return null;
  return (
    <div className={`avatar ${size}`} style={{ '--c': user.color }} onClick={onClick}>
      {user.avatar ? <img src={user.avatar} alt="" /> : <span>{(user.handle || '?')[0].toUpperCase()}</span>}
    </div>
  );
}

export function Glitch({ text, as: Tag = 'span', className = '' }) {
  return <Tag className={`glitch ${className}`} data-text={text}>{text}</Tag>;
}

export function Countdown({ to, className = '' }) {
  useNow(1000);
  return <span className={`mono ${className}`}>{countdown(to)}</span>;
}

// Overlays van a un nodo dentro del shell: así no los afecta el scroll ni las transformaciones de la pantalla.
export function Overlay({ children }) {
  const root = document.getElementById('overlay-root');
  return root ? createPortal(children, root) : children;
}

export function Sheet({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <Overlay>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        {title && (
          <div className="row between mb">
            <h3 className="h-display h-md">{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
          </div>
        )}
        {children}
      </div>
    </Overlay>
  );
}

export function BackBar({ title, right, sub }) {
  const nav = useNavigate();
  return (
    <div className="topbar">
      <button className="icon-btn" onClick={() => nav(-1)} aria-label="Volver"><Icon name="back" /></button>
      <div className="grow">
        <div className="h-display h-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div className="label" style={{ fontSize: 10 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

const TABS = [
  { to: '/', icon: 'feed', label: 'Feed', end: true },
  { to: '/reels', icon: 'reels', label: 'Reels' },
  { to: '/mapa', icon: 'map', label: 'Mapa', center: true },
  { to: '/juntadas', icon: 'meets', label: 'Juntadas' },
  { to: '/perfil', icon: 'user', label: 'Perfil' },
];

export function TabBar() {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${t.center ? 'center' : ''} ${isActive ? 'active' : ''}`}>
          {t.center ? <div className="hex"><Icon name={t.icon} size={26} /></div> : <Icon name={t.icon} />}
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// Inclina el elemento en 3D siguiendo el dedo/mouse.
export function TiltCard({ children, className = '', max = 10, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(0)`;
      el.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
      el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    };
    const reset = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    el.addEventListener('pointerup', reset);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
      el.removeEventListener('pointerup', reset);
    };
  }, [max]);
  return <div ref={ref} className={`tilt ${className}`} style={style}>{children}</div>;
}
