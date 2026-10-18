// "Foto" procedural para posts sin imagen: póster tipo tapa de revista tuning / pared pintada.
const PALETTES = {
  carbon: ['#e8621a', '#1b1d22', '#ece3cf'],
  ctos: ['#6fa8c7', '#0c1418', '#ece3cf'],
  neon: ['#c2417d', '#160b12', '#f2c230'],
  rust: ['#d8372b', '#1a0d07', '#f2c230'],
  toxic: ['#a9c93a', '#10140a', '#e8621a'],
  graffiti: ['#f2c230', '#111111', '#d8372b'],
};

export default function CarArt({ palette = 'carbon', car = 'VELOX', kicker = '' }) {
  const [a, bg, c] = PALETTES[palette] || PALETTES.carbon;
  return (
    <div className="car-art" style={{ '--a': a, '--bg': bg, '--c': c }}>
      <div className="car-art-grid" />
      <div className="car-art-sun" />
      <svg className="car-art-car" viewBox="0 0 400 140" aria-hidden="true">
        <path d="M20 108 L40 84 L110 70 L160 40 L270 38 L330 70 L378 78 L384 104 L360 112 L326 112 A30 30 0 0 0 266 112 L136 112 A30 30 0 0 0 76 112 L30 112 Z" fill="#000" stroke="var(--a)" strokeWidth="3" />
        <path d="M168 48 L262 46 L300 70 L140 72 Z" fill="var(--c)" opacity=".25" stroke="var(--c)" strokeWidth="2" />
        <circle cx="106" cy="112" r="22" fill="#050505" stroke="var(--c)" strokeWidth="4" />
        <circle cx="296" cy="112" r="22" fill="#050505" stroke="var(--c)" strokeWidth="4" />
        <circle cx="106" cy="112" r="8" fill="var(--a)" />
        <circle cx="296" cy="112" r="8" fill="var(--a)" />
        <path d="M372 84 L386 86" stroke="#fff" strokeWidth="4" />
        <path d="M0 126 H400" stroke="var(--a)" strokeWidth="2" strokeDasharray="30 14" />
      </svg>
      <div className="car-art-speed" />
      <div className="car-art-kicker tag-font">{kicker}</div>
      <div className="car-art-title h-display">{car}</div>
    </div>
  );
}
