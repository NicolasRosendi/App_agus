import { forwardRef, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER } from '../lib/constants.js';

// Proveedores de tiles sin API key. OpenStreetMap va primero: es el mapa abierto y nunca
// pide key. Si uno falla en el dispositivo (bloqueado, caído), el mapa pasa al siguiente.
// Ojo: algunos proveedores responden 200 con una imagen de "API key requerida"; eso no se
// detecta como error, por eso también se puede elegir la fuente a mano (prop `source`).
const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const PROVIDERS = {
  cartoVoyager: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', subdomains: 'abcd', maxZoom: 20, attribution: `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>` },
  cartoDark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd', maxZoom: 20, attribution: `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>` },
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, attribution: OSM },
  esri: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, attribution: 'Tiles &copy; Esri' },
};

// "dark" oscurece con CSS un mapa claro.
export const MAP_STYLES = {
  calle: { label: 'Calle', chain: [['osm'], ['esri'], ['cartoVoyager']] },
  noche: { label: 'Noche', chain: [['osm', 'dark'], ['esri', 'dark'], ['cartoDark']] },
};

export const MAP_SOURCES = {
  auto: 'Automática',
  osm: 'OpenStreetMap',
  esri: 'Esri',
  carto: 'CARTO',
};

// Con una fuente elegida a mano, va primera y el resto queda de respaldo.
function chainFor(mapStyle, source) {
  const base = (MAP_STYLES[mapStyle] || MAP_STYLES.calle).chain;
  if (!source || source === 'auto') return base;
  const match = ([id]) => id === source || (source === 'carto' && id.startsWith('carto'));
  return [...base.filter(match), ...base.filter((p) => !match(p))];
}

const MAX_ERRORS = 4; // errores sin ningún tile bueno antes de cambiar de proveedor
const STALL_MS = 8000; // tiempo máximo sin ningún tile cargado

const memoKey = (style) => `velox.tiles.v2.${style}`;
const readMemo = (style) => {
  try { return Number(sessionStorage.getItem(memoKey(style))) || 0; } catch { return 0; }
};
const writeMemo = (style, i) => {
  try { sessionStorage.setItem(memoKey(style), String(i)); } catch { /* modo privado */ }
};

function FallbackTiles({ mapStyle, source, onStatus }) {
  const chain = chainFor(mapStyle, source);
  const memo = `${mapStyle}.${source || 'auto'}`;
  const [index, setIndex] = useState(() => Math.min(readMemo(memo), chain.length - 1));
  const stats = useRef({ loaded: 0, errors: 0 });

  useEffect(() => { setIndex(Math.min(readMemo(memo), chain.length - 1)); }, [memo, chain.length]);

  const next = () => {
    if (stats.current.loaded > 0) return;
    if (index + 1 < chain.length) setIndex(index + 1);
    else onStatus?.('failed');
  };

  useEffect(() => {
    stats.current = { loaded: 0, errors: 0 };
    onStatus?.('loading');
    const t = setTimeout(next, STALL_MS);
    return () => clearTimeout(t);
  }, [index, memo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (index >= chain.length) return null;
  const [id, variant] = chain[index];
  const p = PROVIDERS[id];
  return (
    <TileLayer
      key={`${mapStyle}-${id}`}
      url={p.url}
      subdomains={p.subdomains || 'abc'}
      maxZoom={p.maxZoom}
      maxNativeZoom={p.maxZoom}
      attribution={p.attribution}
      className={variant === 'dark' ? 'tiles-dark' : ''}
      eventHandlers={{
        tileload: () => {
          if (stats.current.loaded++ === 0) {
            writeMemo(memo, index);
            onStatus?.('ok', id);
          }
        },
        tileerror: () => {
          stats.current.errors++;
          if (stats.current.errors >= MAX_ERRORS) next();
        },
      }}
    />
  );
}

const TacticalMap = forwardRef(function TacticalMap({ center = DEFAULT_CENTER, zoom = 13, children, className = '', interactive = true, mapStyle = 'calle', source = 'auto' }, ref) {
  const [status, setStatus] = useState('loading');
  const [retry, setRetry] = useState(0);
  return (
    <MapContainer
      ref={ref}
      center={[center.lat, center.lng]}
      zoom={zoom}
      zoomControl={false}
      attributionControl
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      className={`tactical-map map-${mapStyle} ${className}`}
    >
      <FallbackTiles key={`${retry}-${source}`} mapStyle={mapStyle} source={source} onStatus={setStatus} />
      {status === 'failed' && (
        <div className="map-offline">
          <b>No pudimos cargar el mapa</b>
          <span>Revisá la conexión o si algún bloqueador frena los mapas.</span>
          <button
            className="btn sm"
            onClick={() => {
              try { sessionStorage.removeItem(memoKey(`${mapStyle}.${source}`)); } catch { /* nada */ }
              setStatus('loading');
              setRetry((r) => r + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {children}
    </MapContainer>
  );
});

export default TacticalMap;
