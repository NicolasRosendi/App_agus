import { forwardRef, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER } from '../lib/constants.js';

// Proveedores de tiles sin API key, en orden de preferencia. Si uno falla en el
// dispositivo (bloqueado, caído, sin cuota), el mapa pasa solo al siguiente.
const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const PROVIDERS = {
  cartoVoyager: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', subdomains: 'abcd', maxZoom: 20, attribution: `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>` },
  cartoDark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd', maxZoom: 20, attribution: `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>` },
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, attribution: OSM },
  esri: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, attribution: 'Tiles &copy; Esri' },
};

// "dark" invierte con CSS un mapa claro cuando no está disponible el oscuro de CARTO.
export const MAP_STYLES = {
  calle: { label: 'Calle', chain: [['cartoVoyager'], ['osm'], ['esri']] },
  noche: { label: 'Noche', chain: [['cartoDark'], ['osm', 'dark'], ['esri', 'dark']] },
};

const MAX_ERRORS = 4; // errores sin ningún tile bueno antes de cambiar de proveedor
const STALL_MS = 8000; // tiempo máximo sin ningún tile cargado

const memoKey = (style) => `velox.tiles.${style}`;
const readMemo = (style) => {
  try { return Number(sessionStorage.getItem(memoKey(style))) || 0; } catch { return 0; }
};
const writeMemo = (style, i) => {
  try { sessionStorage.setItem(memoKey(style), String(i)); } catch { /* modo privado */ }
};

function FallbackTiles({ mapStyle, onStatus }) {
  const chain = (MAP_STYLES[mapStyle] || MAP_STYLES.calle).chain;
  const [index, setIndex] = useState(() => Math.min(readMemo(mapStyle), chain.length - 1));
  const stats = useRef({ loaded: 0, errors: 0 });

  useEffect(() => { setIndex(Math.min(readMemo(mapStyle), chain.length - 1)); }, [mapStyle, chain.length]);

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
  }, [index, mapStyle]); // eslint-disable-line react-hooks/exhaustive-deps

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
            writeMemo(mapStyle, index);
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

const TacticalMap = forwardRef(function TacticalMap({ center = DEFAULT_CENTER, zoom = 13, children, className = '', interactive = true, mapStyle = 'calle' }, ref) {
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
      <FallbackTiles key={retry} mapStyle={mapStyle} onStatus={setStatus} />
      {status === 'failed' && (
        <div className="map-offline">
          <b>No pudimos cargar el mapa</b>
          <span>Revisá la conexión o si algún bloqueador frena los mapas.</span>
          <button
            className="btn sm"
            onClick={() => {
              try { sessionStorage.removeItem(memoKey(mapStyle)); } catch { /* nada */ }
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
