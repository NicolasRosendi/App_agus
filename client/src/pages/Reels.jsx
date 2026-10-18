import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import Icon from '../components/Icon.jsx';
import { Media, Comments } from '../components/PostCard.jsx';
import { Avatar, Sheet } from '../components/ui.jsx';

function Reel({ reel: initial, muted, toggleMute }) {
  const [reel, setReel] = useState(initial);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const video = useRef(null);
  const toast = useToast();

  // Reproduce solo el reel visible.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      const v = video.current;
      if (!v) return;
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.6 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  const like = async () => {
    try { setReel((await api(`/feed/${reel.id}/like`, { method: 'POST' })).post); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <section className="reel" ref={box}>
      <Media media={reel.media} muted={muted} videoRef={video} />
      <div className="reel-shade" />
      <div className="reel-hud mono">
        <span className="dot-live" /> REC · {reel.tags[0] || 'VELOX'}
      </div>
      <div className="reel-side">
        <button className={`reel-act ${reel.liked ? 'on' : ''}`} onClick={like}><Icon name="heart" size={30} fill={reel.liked ? 'currentColor' : 'none'} /><b>{reel.likes}</b></button>
        <button className="reel-act" onClick={() => setOpen(true)}><Icon name="comment" size={30} /><b>{reel.comments.length}</b></button>
        <button className="reel-act" onClick={toggleMute}><Icon name={muted ? 'mute' : 'sound'} size={30} /></button>
      </div>
      <div className="reel-info">
        <Link to={`/perfil/${reel.author.handle}`} className="row">
          <Avatar user={reel.author} size="sm" />
          <b className="mono">@{reel.author.handle}</b>
          {reel.author.crew && <span className="badge cyan">{reel.author.crew}</span>}
        </Link>
        <p>{reel.text}</p>
        <div className="row wrap" style={{ gap: 6 }}>{reel.tags.map((t) => <span key={t} className="sticker">#{t}</span>)}</div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Comentarios">
        <Comments post={reel} onChange={setReel} />
      </Sheet>
    </section>
  );
}

export default function Reels() {
  const [reels, setReels] = useState(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => { api('/feed?type=reel').then((d) => setReels(d.posts)).catch(() => setReels([])); }, []);
  return (
    <div className="screen full reels page-enter">
      <div className="reels-top">
        <div className="h-display h-md">REELS</div>
        <Link to="/crear?tipo=reel" className="icon-btn on" aria-label="Subir reel"><Icon name="plus" /></Link>
      </div>
      {!reels && <div className="spinner" />}
      {reels?.length === 0 && <div className="empty">Sin reels todavía.</div>}
      {reels?.map((r) => <Reel key={r.id} reel={r} muted={muted} toggleMute={() => setMuted((m) => !m)} />)}
    </div>
  );
}
