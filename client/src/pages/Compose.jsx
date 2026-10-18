import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { CATEGORIES } from '../lib/constants.js';
import Icon from '../components/Icon.jsx';
import CarArt from '../components/CarArt.jsx';
import { BackBar } from '../components/ui.jsx';

const PALETTES = ['graffiti', 'carbon', 'ctos', 'neon', 'rust', 'toxic'];
const EXTRA_TAGS = ['AVISO', 'RUTA', 'TALLER', 'LAVADO'];

export default function Compose() {
  const [params] = useSearchParams();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [type, setType] = useState(params.get('tipo') === 'reel' ? 'reel' : 'post');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState('');
  const [tags, setTags] = useState([]);
  const [place, setPlace] = useState('');
  const [palette, setPalette] = useState('graffiti');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('video/')) setType('reel');
  };

  const toggleTag = (t) => setTags((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t].slice(0, 5)));

  const submit = async () => {
    if (type === 'reel' && !file) return toast('Un reel necesita un video', 'err');
    setBusy(true);
    const form = new FormData();
    if (file) form.append('media', file);
    form.append('text', text);
    form.append('type', type);
    form.append('tags', tags.join(','));
    form.append('place', place);
    form.append('palette', palette);
    try {
      await api('/feed', { method: 'POST', form });
      toast('+5 REP · Transmisión publicada', 'xp');
      refresh();
      nav(type === 'reel' ? '/reels' : '/');
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  const isVideo = file?.type.startsWith('video/');
  return (
    <div className="screen page-enter">
      <BackBar title="Nueva transmisión" right={<button className="btn sm" disabled={busy} onClick={submit}>{busy ? '…' : 'Publicar'}</button>} />
      <div className="pad">
        <div className="row mt">
          <button className={`chip ${type === 'post' ? 'on' : ''}`} onClick={() => setType('post')}><span>Post</span></button>
          <button className={`chip ${type === 'reel' ? 'on cyan' : ''}`} onClick={() => setType('reel')}><span>Reel</span></button>
        </div>

        <label className={`upload-zone mt ${type === 'reel' ? 'tall' : ''}`}>
          <input type="file" accept={type === 'reel' ? 'video/*' : 'image/*,video/*'} onChange={pick} hidden />
          {preview ? (isVideo ? <video src={preview} muted autoPlay loop playsInline /> : <img src={preview} alt="" />) : type === 'post' ? (
            <div className="upload-art">
              <CarArt palette={palette} car={(user.cars[0]?.model || user.handle).toUpperCase()} kicker={tags[0] || 'POST'} />
              <div className="upload-hint mono"><Icon name="image" /> Tocá para subir foto · o publicá con arte generado</div>
            </div>
          ) : (
            <div className="upload-hint mono"><Icon name="reels" size={40} /> Subí un video vertical</div>
          )}
        </label>
        {file && <button className="btn ghost sm mt-s" onClick={() => setFile(null)}><span>Quitar archivo</span></button>}

        {!file && type === 'post' && (
          <div className="chips mt">
            {PALETTES.map((p) => <button key={p} className={`chip ${palette === p ? 'on' : ''}`} onClick={() => setPalette(p)}><span>{p}</span></button>)}
          </div>
        )}

        <label className="field mt">
          <span className="label">Texto</span>
          <textarea className="textarea" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="¿Qué está pasando en la calle?" />
        </label>
        <label className="field">
          <span className="label">Lugar (opcional)</span>
          <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ej: Lavadero Espuma Negra" />
        </label>
        <div className="label mb">Tags</div>
        <div className="chips">
          {[...CATEGORIES.filter((c) => c !== 'OTRO'), ...EXTRA_TAGS].map((t) => (
            <button key={t} className={`chip ${tags.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(t)}><span>#{t}</span></button>
          ))}
        </div>
      </div>
    </div>
  );
}
