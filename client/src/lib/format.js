export function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function countdown(ts) {
  let s = Math.floor((ts - Date.now()) / 1000);
  if (s <= 0) return '00:00:00';
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d ? `${d}D ` : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function dateLabel(ts) {
  return new Date(ts).toLocaleString('es-AR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase();
}

export const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
export const mins = (s) => `${Math.max(1, Math.round(s / 60))} min`;

// Coordenadas estilo ctOS: -34.6037 → 34°36'13"S
export function dms(lat, lng) {
  const f = (v, pos, neg) => {
    const a = Math.abs(v);
    const d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60);
    return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"${v >= 0 ? pos : neg}`;
  };
  return `${f(lat, 'N', 'S')} ${f(lng, 'E', 'O')}`;
}
