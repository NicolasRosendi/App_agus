import { useMemo, useState } from 'react';
import { dateLabel } from '../lib/format.js';

// Patrón tipo QR determinístico a partir del código de pase (visual; el check-in usa el código).
function PseudoQR({ value, size = 21 }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967295; };
    for (const ch of value) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => rnd() > 0.52));
    const finder = (r0, c0) => {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = edge || core;
      }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    return grid;
  }, [value, size]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="pseudo-qr" shapeRendering="crispEdges">
      {cells.flatMap((row, r) => row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" /> : null)))}
    </svg>
  );
}

export default function PassCard({ meet, user, car }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <>
      <div className={`pass ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
        <div className="pass-inner">
          <div className="pass-face pass-front">
            <div className="pass-holo" />
            <div className="row between">
              <span className="label" style={{ color: '#000' }}>PASE // ACCESO</span>
              <span className="mono" style={{ fontSize: 11 }}>{meet.id.toUpperCase()}</span>
            </div>
            <div className="h-display h-md pass-title">{meet.title}</div>
            <div className="mono">{dateLabel(meet.startsAt)}</div>
            <div className="pass-bottom">
              <div>
                <div className="h-display h-sm">@{user.handle}</div>
                {car && <div className="mono" style={{ fontSize: 12 }}>{car.make} {car.model} · {car.plate || '—'}</div>}
                <div className="pass-code mono">{meet.me.passCode}</div>
              </div>
              <PseudoQR value={meet.me.passCode} />
            </div>
          </div>
          <div className="pass-face pass-back">
            <div className="tape" />
            <div className="h-display h-sm mt">PROTOCOLO</div>
            <ol className="mono pass-rules">
              <li>No compartas este pase ni la ubicación.</li>
              <li>Llegá con luces bajas y sin música fuerte.</li>
              <li>Cero quemes / picadas en zona urbana.</li>
              <li>Mostrá el código al organizador para el check-in.</li>
              <li>El que rompe el protocolo queda fuera del sistema.</li>
            </ol>
            <div className="tag-font pass-tag">respect the spot</div>
          </div>
        </div>
      </div>
      <div className="pass-hint mono">tocá el pase para ver el protocolo</div>
    </>
  );
}
