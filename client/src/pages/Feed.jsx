import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import Icon from '../components/Icon.jsx';
import PostCard from '../components/PostCard.jsx';
import Notifications from '../components/Notifications.jsx';
import { Avatar } from '../components/ui.jsx';

const MODES = [['para-vos', 'Para vos'], ['siguiendo', 'Siguiendo'], ['recientes', 'Recientes']];

function Ticker() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    Promise.all([api('/map/reports'), api('/meets')]).then(([r, m]) => {
      const count = (t) => r.reports.filter((x) => x.type === t).length;
      setItems([
        `${count('control')} CONTROLES ACTIVOS`,
        `${count('camara')} CÁMARAS MAPEADAS`,
        `${m.meets.filter((x) => x.status !== 'ended').length} JUNTADAS EN EL RADAR`,
        `${count('bache')} CALLES ROTAS`,
        'NO QUEMES EN ZONA URBANA',
        'RESPETÁ EL SPOT O PERDÉS EL ACCESO',
      ]);
    }).catch(() => {});
  }, []);
  if (!items.length) return null;
  const text = items.join('  ///  ');
  return (
    <div className="ticker">
      <span className="ticker-tag">LIVE</span>
      <div className="ticker-track"><span>{text}  ///  {text}  ///  </span></div>
    </div>
  );
}

function Radar() {
  const [users, setUsers] = useState([]);
  useEffect(() => { api('/users/search').then((d) => setUsers(d.users)).catch(() => {}); }, []);
  return (
    <div className="radar-row">
      <Link to="/crear" className="radar-item">
        <div className="avatar radar-add"><Icon name="plus" /></div>
        <small>Subir</small>
      </Link>
      {users.map((u) => (
        <Link key={u.id} to={`/perfil/${u.handle}`} className="radar-item">
          <div className="radar-ring" style={{ '--c': u.color }}><Avatar user={u} /></div>
          <small>{u.handle}</small>
        </Link>
      ))}
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const [mode, setMode] = useState('para-vos');
  const [posts, setPosts] = useState(null);
  const toast = useToast();

  useEffect(() => {
    setPosts(null);
    api(`/feed?mode=${mode}`).then((d) => setPosts(d.posts)).catch((e) => toast(e.message, 'err'));
  }, [mode, toast]);

  const remove = async (p) => {
    if (!confirm('¿Borrar este post?')) return;
    await api(`/feed/${p.id}`, { method: 'DELETE' });
    setPosts((l) => l.filter((x) => x.id !== p.id));
  };

  return (
    <div className="screen page-enter">
      <div className="topbar">
        <div className="brand grow">VEL<b>O</b>X<small>underground</small></div>
        <Link to="/pasos" className="icon-btn" aria-label="Modo pasos"><Icon name="steps" /></Link>
        <Notifications />
        <Link to="/crear" className="icon-btn on" aria-label="Crear post"><Icon name="plus" /></Link>
      </div>
      <Ticker />
      <Radar />
      <div className="feed-modes">
        {MODES.map(([k, l]) => (
          <button key={k} className={`feed-mode ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      {!posts && <div className="spinner" />}
      {posts && posts.length === 0 && <div className="empty">Nada por acá todavía. Seguí gente o subí algo.</div>}
      <div className="feed">
        {posts?.map((p) => <PostCard key={p.id} post={p} onDelete={p.author.id === user.id ? remove : null} />)}
      </div>
    </div>
  );
}
