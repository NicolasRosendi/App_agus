import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import Icon from '../components/Icon.jsx';
import { Media } from '../components/PostCard.jsx';
import PostCard from '../components/PostCard.jsx';
import { Avatar, BackBar, Sheet, TiltCard } from '../components/ui.jsx';

const LEVELS = [[0, 'NOVATO'], [100, 'CALLEJERO'], [300, 'PILOTO'], [700, 'LEYENDA'], [1500, 'FANTASMA']];

function RepBar({ rep }) {
  const idx = LEVELS.findLastIndex(([min]) => rep >= min);
  const [min] = LEVELS[idx];
  const next = LEVELS[idx + 1];
  const pct = next ? ((rep - min) / (next[0] - min)) * 100 : 100;
  return (
    <div className="rep-bar">
      <div className="row between mono" style={{ fontSize: 11 }}>
        <span className="orange">{LEVELS[idx][1]}</span>
        <span className="muted">{next ? `${rep}/${next[0]} → ${next[1]}` : 'NIVEL MÁXIMO'}</span>
      </div>
      <div className="cap-bar"><div style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function CarCard({ car, onDelete }) {
  return (
    <TiltCard max={12} className="car-card-wrap">
      <div className="car-card" style={{ '--c': car.color }}>
        {car.photo ? <img src={car.photo} alt="" className="car-photo" /> : <div className="car-photo car-photo-empty"><Icon name="car" size={60} stroke={1.2} /></div>}
        <div className="car-card-shade" />
        <div className="car-card-body">
          <div className="row between">
            <span className="badge" style={{ color: car.color }}>{car.category}</span>
            {car.plateVerified && <span className="sticker cyan">VERIFICADO</span>}
          </div>
          <div className="h-display h-md mt-s">{car.make} <span style={{ color: car.color }}>{car.model}</span></div>
          <div className="row between mono" style={{ fontSize: 12 }}>
            <span>{car.year || '—'}{car.hp ? ` · ${car.hp} HP` : ''}</span>
            {car.plate && <span className="plate">{car.plate}</span>}
          </div>
          {car.mods?.length > 0 && <div className="row wrap mt-s" style={{ gap: 4 }}>{car.mods.map((m) => <span key={m} className="badge muted">{m}</span>)}</div>}
          {onDelete && <button className="btn ghost red xs mt-s" onClick={() => onDelete(car)}><span>Quitar</span></button>}
        </div>
      </div>
    </TiltCard>
  );
}

export default function Profile() {
  const { handle: param } = useParams();
  const { user: me, setUser } = useAuth();
  const handle = param || me.handle;
  const self = handle === me.handle;
  const [data, setData] = useState(null);
  const [view, setView] = useState('grid');
  const [openPost, setOpenPost] = useState(null);
  const toast = useToast();

  useEffect(() => {
    setData(null);
    api(`/users/${handle}`).then(setData).catch((e) => toast(e.message, 'err'));
  }, [handle, toast]);

  const follow = async () => {
    try {
      const d = await api(`/users/${handle}/follow`, { method: 'POST' });
      setData((x) => ({ ...x, user: d.user }));
    } catch (e) { toast(e.message, 'err'); }
  };

  const pickAvatar = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const form = new FormData();
    form.append('file', f);
    try {
      const d = await api('/users/me/avatar', { method: 'POST', form });
      setUser(d.user);
      setData((x) => ({ ...x, user: { ...x.user, avatar: d.user.avatar } }));
    } catch (err) { toast(err.message, 'err'); }
  };

  if (!data) return <div className="screen">{param && <BackBar title={`@${handle}`} />}<div className="spinner" /></div>;
  const u = data.user;

  return (
    <div className="screen page-enter">
      {param && !self ? <BackBar title={`@${u.handle}`} /> : (
        <div className="topbar">
          <div className="h-display h-md grow">PERFIL</div>
          <Link to="/garage" className="icon-btn" aria-label="Garage"><Icon name="car" /></Link>
          <Link to="/ajustes" className="icon-btn" aria-label="Ajustes"><Icon name="settings" /></Link>
        </div>
      )}
      <div className="profile-head" style={{ '--c': u.color }}>
        <div className="profile-bg tag-font">{u.crew || u.handle}</div>
        <div className="pad">
          <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
            <label style={{ cursor: self ? 'pointer' : 'default' }}>
              <Avatar user={u} size="lg" />
              {self && <input type="file" accept="image/*" hidden onChange={pickAvatar} />}
            </label>
            <div className="grow" style={{ minWidth: 0 }}>
              <h1 className="h-display h-lg" style={{ overflowWrap: 'anywhere' }}>{u.name}</h1>
              <div className="mono muted">@{u.handle} {u.verified && <span className="cyan">◆ verificado</span>}</div>
              {u.crew && <span className="sticker mt-s" style={{ background: u.color }}>CREW {u.crew}</span>}
            </div>
          </div>
          {u.bio && <p className="mt">{u.bio}</p>}
          <div className="grid-3 mt">
            <div className="stat"><b>{data.stats.posts}</b><small>posts</small></div>
            <div className="stat"><b>{u.followers}</b><small>seguidores</small></div>
            <div className="stat"><b>{u.rep}</b><small>rep</small></div>
          </div>
          <RepBar rep={u.rep} />
          {u.badges.length > 0 && <div className="row wrap mt-s" style={{ gap: 6 }}>{u.badges.map((b) => <span key={b} className="badge cyan">{b}</span>)}</div>}
          <div className="row mt">
            {self ? (
              <>
                <Link to="/ajustes" className="btn ghost sm" style={{ flex: 1 }}><span>Editar perfil</span></Link>
                <Link to="/garage" className="btn sm" style={{ flex: 1 }}>Mi garage</Link>
              </>
            ) : (
              <button className={`btn ${u.isFollowing ? 'ghost' : ''} block`} onClick={follow}>{u.isFollowing ? <span>Siguiendo</span> : 'Seguir'}</button>
            )}
          </div>
        </div>
      </div>

      <div className="pad">
        <div className="section-title">Garage</div>
        {u.cars.length === 0 && <div className="empty">{self ? <Link to="/garage" className="orange">Agregá tu primer auto →</Link> : 'Garage vacío.'}</div>}
        <div className="car-scroller">{u.cars.map((c) => <CarCard key={c.id} car={c} />)}</div>

        <div className="section-title">Transmisiones</div>
        <div className="row mb">
          <button className={`icon-btn ${view === 'grid' ? 'on' : ''}`} onClick={() => setView('grid')} aria-label="Grilla"><Icon name="feed" /></button>
          <button className={`icon-btn ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')} aria-label="Lista"><Icon name="reels" /></button>
        </div>
        {data.posts.length === 0 && <div className="empty">Sin posts todavía.</div>}
        {view === 'grid' ? (
          <div className="grid-3">
            {data.posts.map((p) => (
              <button key={p.id} className="grid-tile" onClick={() => setOpenPost(p)}>
                <Media media={p.media} />
                {p.type === 'reel' && <Icon name="play" size={16} className="grid-tile-badge" />}
              </button>
            ))}
          </div>
        ) : (
          <div className="feed" style={{ margin: '0 -16px' }}>{data.posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        )}
      </div>
      <Sheet open={!!openPost} onClose={() => setOpenPost(null)}>
        {openPost && <div style={{ margin: '0 -16px' }}><PostCard post={openPost} /></div>}
      </Sheet>
    </div>
  );
}
