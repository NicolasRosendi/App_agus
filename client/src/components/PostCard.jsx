import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';
import Icon from './Icon.jsx';
import CarArt from './CarArt.jsx';
import { Avatar, Sheet, TiltCard } from './ui.jsx';

export function Media({ media, autoPlay = false, muted = true, videoRef }) {
  const [failed, setFailed] = useState(false);
  if (!media) return null;
  if (media.kind === 'image') return <img className="media-img" src={media.url} alt="" loading="lazy" />;
  if (media.kind === 'video' && !failed) {
    return (
      <video ref={videoRef} className="media-img" src={media.url} muted={muted} loop playsInline autoPlay={autoPlay} preload="metadata" onError={() => setFailed(true)} />
    );
  }
  const art = media.kind === 'art' ? media : media.fallback;
  return art ? <CarArt {...art} /> : <div className="media-img media-missing mono">SIN SEÑAL</div>;
}

export function Comments({ post, onChange }) {
  const [text, setText] = useState('');
  const toast = useToast();
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const d = await api(`/feed/${post.id}/comments`, { method: 'POST', body: { text } });
      setText('');
      onChange(d.post);
    } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <div>
      <div className="stack">
        {post.comments.length === 0 && <div className="empty">Silencio de radio. Sé el primero.</div>}
        {post.comments.map((c) => (
          <div key={c.id} className="comment">
            <Link to={`/perfil/${c.handle}`} className="mono" style={{ color: c.color }}>@{c.handle}</Link> {c.text}
            <span className="dim mono"> · {timeAgo(c.at)}</span>
          </div>
        ))}
      </div>
      <form className="row mt" onSubmit={send}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí algo…" />
        <button className="icon-btn on" aria-label="Enviar"><Icon name="send" /></button>
      </form>
    </div>
  );
}

export default function PostCard({ post: initial, onDelete }) {
  const [post, setPost] = useState(initial);
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(false);
  const lastTap = useRef(0);
  const toast = useToast();

  const like = async () => {
    setPost((p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }));
    try { setPost((await api(`/feed/${post.id}/like`, { method: 'POST' })).post); } catch (err) { toast(err.message, 'err'); }
  };
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!post.liked) like();
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
    }
    lastTap.current = now;
  };
  const share = async () => {
    const url = `${location.origin}/perfil/${post.author.handle}`;
    try {
      if (navigator.share) await navigator.share({ title: 'VELOX', text: post.text, url });
      else { await navigator.clipboard.writeText(url); toast('Link copiado', 'ok'); }
    } catch { /* cancelado */ }
  };

  return (
    <article className="post">
      <header className="post-head">
        <Link to={`/perfil/${post.author.handle}`} className="row">
          <Avatar user={post.author} />
          <div>
            <div className="post-handle">@{post.author.handle} {post.author.verified && <span className="cyan" title="Patente verificada">◆</span>}</div>
            <div className="label" style={{ fontSize: 10 }}>{post.author.crew ? `${post.author.crew} · ` : ''}{timeAgo(post.createdAt)}{post.place ? ` · ${post.place}` : ''}</div>
          </div>
        </Link>
        <div className="grow" />
        {post.type === 'reel' && <span className="sticker magenta">REEL</span>}
        {onDelete && <button className="icon-btn" onClick={() => onDelete(post)} aria-label="Borrar"><Icon name="trash" size={18} /></button>}
      </header>
      <TiltCard className="post-media" max={8}>
        <div onClick={tap}>
          <Media media={post.media} autoPlay={post.type === 'reel'} />
        </div>
        {burst && <div className="like-burst"><Icon name="heart" size={110} fill="currentColor" /></div>}
        <div className="post-glare" />
      </TiltCard>
      <div className="post-actions">
        <button className={`act ${post.liked ? 'on' : ''}`} onClick={like}><Icon name="heart" fill={post.liked ? 'currentColor' : 'none'} /> <b>{post.likes}</b></button>
        <button className="act" onClick={() => setOpen(true)}><Icon name="comment" /> <b>{post.comments.length}</b></button>
        <button className="act" onClick={share}><Icon name="share" /></button>
        <div className="grow" />
        <div className="row" style={{ gap: 6 }}>{post.tags.map((t) => <span key={t} className="badge orange">#{t}</span>)}</div>
      </div>
      {post.text && <p className="post-text"><b className="mono">@{post.author.handle}</b> {post.text}</p>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Comentarios">
        <Comments post={post} onChange={setPost} />
      </Sheet>
    </article>
  );
}
