import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { Circle, Marker, Polyline, useMapEvents } from 'react-leaflet';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { useInterval, useNow } from '../lib/useInterval.js';
import { REPORT_TYPES, POI_TYPES, DEFAULT_CENTER } from '../lib/constants.js';
import { dms, km, mins, timeAgo, dateLabel } from '../lib/format.js';
import { makeTrack, pointAt, alongTrack } from '../lib/geo.js';
import { bodyFor } from '../lib/car3d.js';
import { reportIcon, poiIcon, zoneIcon, spotIcon, destIcon } from '../lib/mapIcons.js';
import Icon from '../components/Icon.jsx';
import TacticalMap, { MAP_STYLES } from '../components/TacticalMap.jsx';
import { Countdown, Sheet } from '../components/ui.jsx';

const MapCar3D = lazy(() => import('../components/MapCar3D.jsx'));

const NAV_ZOOM = 17;
const NAV_SECONDS = 50; // la demo recorre cualquier ruta en ~50 s
const TURN_GLYPH = { left: '↰', 'sharp left': '↰', 'slight left': '↖', right: '↱', 'sharp right': '↱', 'slight right': '↗', uturn: '↶', straight: '↑' };
const glyph = (s) => (s.type === 'arrive' ? '◉' : s.type === 'depart' ? '▲' : s.type === 'roundabout' || s.type === 'rotary' ? '⟳' : TURN_GLYPH[s.modifier] || '↑');

function Tracker({ onMove, onPick }) {
  useMapEvents({
    move: (e) => onMove(e.target.getCenter()),
    click: (e) => onPick(e.latlng),
  });
  return null;
}

// Marker de Leaflet que aloja un componente React (el auto 3D).
const SLOT_ICON = L.divIcon({ className: '', html: '<div class="player-slot"></div>', iconSize: [110, 110], iconAnchor: [55, 55] });
function PlayerMarker({ position, children }) {
  const [slot, setSlot] = useState(null);
  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={SLOT_ICON}
      interactive={false}
      zIndexOffset={1000}
      eventHandlers={{ add: (e) => setSlot(e.target.getElement()?.querySelector('.player-slot')) }}
    >
      {slot && createPortal(children, slot)}
    </Marker>
  );
}

// OSD de videocasetera: ▶ PLAY + contador de cinta + fecha.
function VhsOsd() {
  const start = useRef(Date.now());
  const now = useNow(1000);
  const s = Math.floor((now - start.current) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date(now);
  return (
    <>
      <div className="vhs-osd vhs-tl"><span className="vhs-blink">▶</span> PLAY <span className="dim">SP</span><br />{pad(Math.floor(s / 3600))}:{pad(Math.floor(s / 60) % 60)}:{pad(s % 60)}</div>
      <div className="vhs-osd vhs-br">{d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', '')} {d.getFullYear()}<br />{pad(d.getHours())}:{pad(d.getMinutes())}</div>
    </>
  );
}

export default function MapPage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const mapRef = useRef(null);
  const prefs = user.prefs;
  const mapStyle = prefs.mapStyle || 'calle';
  const myCar = user.cars[0];
  const carLook = { body: bodyFor(myCar), color: myCar?.color || '#d8461b' };

  const [reports, setReports] = useState([]);
  const [pois, setPois] = useState([]);
  const [meets, setMeets] = useState([]);
  const [gps, setGps] = useState(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [selected, setSelected] = useState(null); // { kind, item }
  const [panel, setPanel] = useState(null); // 'report' | 'layers' | 'steps'
  const [placing, setPlacing] = useState(null);
  const [routeMode, setRouteMode] = useState(false);
  const [dest, setDest] = useState(null);
  const [route, setRoute] = useState(null);
  const [routing, setRouting] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [drive, setDrive] = useState(null); // estado de navegación para el HUD (10 Hz)
  const navRef = useRef(null);
  const headingRef = useRef(0);

  const me = gps || DEFAULT_CENTER; // sin GPS (ej. desktop) arrancamos en el centro de CABA

  const loadReports = useCallback(() => api('/map/reports').then((d) => setReports(d.reports)).catch(() => {}), []);
  useEffect(() => {
    loadReports();
    api('/map/pois').then((d) => setPois(d.pois)).catch(() => {});
    api('/meets').then((d) => setMeets(d.meets)).catch(() => {});
  }, [loadReports]);
  useInterval(loadReports, 30000);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const savePrefs = async (next) => {
    const merged = { ...prefs, ...next };
    setUser({ ...user, prefs: merged });
    try { await api('/users/me', { method: 'PATCH', body: { prefs: merged } }); } catch { /* se reintenta en el próximo cambio */ }
  };

  const visibleReports = useMemo(() => (prefs.layers.reports ? reports.filter((r) => prefs.reportTypes.includes(r.type)) : []), [reports, prefs]);
  const visiblePois = useMemo(() => (prefs.layers.pois ? pois.filter((p) => prefs.poiTypes.includes(p.type)) : []), [pois, prefs]);

  const flyTo = (p, z = 15) => mapRef.current?.flyTo([p.lat, p.lng], z, { duration: 0.8 });

  const placeReport = async () => {
    try {
      const d = await api('/map/reports', { method: 'POST', body: { type: placing, lat: center.lat, lng: center.lng } });
      setReports((l) => [...l, { ...d.report, fresh: true }]);
      toast(`+${d.gained.rep} REP · +${d.gained.points} PTS · Reporte cargado`, 'xp');
      setPlacing(null);
    } catch (e) { toast(e.message, 'err'); }
  };

  const vote = async (r, value) => {
    try {
      const d = await api(`/map/reports/${r.id}/vote`, { method: 'POST', body: { value } });
      if (d.removed) { setReports((l) => l.filter((x) => x.id !== r.id)); toast('Reporte desmentido por la comunidad', 'ok'); }
      else setReports((l) => l.map((x) => (x.id === r.id ? d.report : x)));
      setSelected(null);
      toast('+2 PTS · Gracias por validar', 'xp');
    } catch (e) { toast(e.message, 'err'); }
  };

  const traceRoute = async (to) => {
    setDest(to);
    setRouting(true);
    setSelected(null);
    try {
      const d = await api('/route/safe', { method: 'POST', body: { from: me, to } });
      setRoute(d);
      const pts = [...d.ghost.line, ...(d.fastest?.line || [])].map((p) => [p.lat, p.lng]);
      mapRef.current?.fitBounds(pts, { padding: [70, 70] });
      if (d.engine === 'offline') toast('Motor de rutas sin señal: línea directa', 'err');
    } catch (e) { toast(e.message, 'err'); }
    setRouting(false);
  };

  const onPick = (latlng) => {
    if (routeMode && !tilt) {
      setRouteMode(false);
      traceRoute({ lat: latlng.lat, lng: latlng.lng });
    }
  };

  const clearRoute = () => { stopDrive(); setRoute(null); setDest(null); };

  // ---------------- Navegación animada ----------------
  const startDrive = () => {
    const track = makeTrack(route.ghost.line);
    const steps = route.ghost.steps.map((s) => ({ ...s, along: alongTrack(track, s.at).along }));
    const hazards = reports
      .map((r) => ({ ...r, ...alongTrack(track, r) }))
      .filter((r) => r.offset < 45);
    navRef.current = { track, steps, hazards, d: 0, last: performance.now(), lastUi: 0, speed: Math.max(20, track.total / NAV_SECONDS), warned: new Set() };
    headingRef.current = pointAt(track, 0).heading;
    setPanel(null);
    setDrive({ d: 0, total: track.total });
  };

  const stopDrive = () => {
    navRef.current = null;
    setDrive(null);
  };

  useEffect(() => {
    if (!drive) return undefined;
    const map = mapRef.current;
    // El contenedor del mapa cambia de tamaño (se agranda para la vista inclinada).
    requestAnimationFrame(() => map?.invalidateSize({ animate: false }));
    let raf;
    const tick = (now) => {
      const n = navRef.current;
      if (!n) return;
      const dt = Math.min(0.1, (now - n.last) / 1000);
      n.last = now;
      n.d = Math.min(n.track.total, n.d + n.speed * dt);
      const p = pointAt(n.track, n.d);
      headingRef.current = p.heading;
      map?.setView([p.lat, p.lng], NAV_ZOOM, { animate: false });
      if (now - n.lastUi > 100 || n.d >= n.track.total) {
        n.lastUi = now;
        const next = n.steps.find((s) => s.along > n.d + 5) || n.steps[n.steps.length - 1];
        const hazard = n.hazards.find((h) => h.along > n.d && h.along - n.d < 450);
        if (hazard && !n.warned.has(hazard.id)) n.warned.add(hazard.id);
        setDrive({ d: n.d, total: n.track.total, pos: p, next, hazard, done: n.d >= n.track.total });
      }
      if (n.d < n.track.total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [drive?.total]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drive) requestAnimationFrame(() => mapRef.current?.invalidateSize({ animate: false }));
  }, [drive]);

  const driving = Boolean(drive);
  const traveled = drive?.pos ? route.ghost.line.slice(0, drive.pos.index).concat([drive.pos]) : null;
  const hazardIds = new Set(route?.ghost.hazards.map((h) => h.id));
  const line = (pts) => pts.map((p) => [p.lat, p.lng]);

  return (
    <div className={`screen full map-screen page-enter ${driving ? 'is-driving' : ''}`}>
      <div className={`map-wrap ${tilt || driving ? 'tilted' : ''}`}>
        <TacticalMap ref={mapRef} center={DEFAULT_CENTER} zoom={13} mapStyle={mapStyle}>
          <Tracker onMove={setCenter} onPick={onPick} />

          {prefs.layers.meets && meets.map((m) => (m.spot ? (
            <Marker key={m.id} position={[m.spot.lat, m.spot.lng]} icon={spotIcon(m.title)} eventHandlers={{ click: () => setSelected({ kind: 'meet', item: m }) }} />
          ) : (
            <Fragment key={m.id}>
              <Circle center={[m.zone.lat, m.zone.lng]} radius={m.zone.radius} pathOptions={{ className: 'zone-circle', color: '#e8621a', weight: 2, dashArray: '2 10', lineCap: 'square', fillColor: '#e8621a', fillOpacity: 0.07 }} eventHandlers={{ click: () => setSelected({ kind: 'meet', item: m }) }} />
              <Marker position={[m.zone.lat, m.zone.lng]} icon={zoneIcon(m.title)} eventHandlers={{ click: () => setSelected({ kind: 'meet', item: m }) }} />
            </Fragment>
          )))}

          {visiblePois.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={poiIcon(p.type)} eventHandlers={{ click: () => setSelected({ kind: 'poi', item: p }) }} />
          ))}

          {visibleReports.map((r) => (
            <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r.type, r.fresh || hazardIds.has(r.id))} eventHandlers={{ click: () => setSelected({ kind: 'report', item: r }) }} />
          ))}

          {/* Ruta estilo Maps: alternativa gris, principal azul con borde, tramo recorrido apagado */}
          {route?.fastest && !driving && (
            <>
              <Polyline positions={line(route.fastest.line)} pathOptions={{ color: '#6b7178', weight: 11, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />
              <Polyline positions={line(route.fastest.line)} pathOptions={{ color: '#b9bfc6', weight: 7, lineCap: 'round', lineJoin: 'round' }} />
            </>
          )}
          {route && (
            <>
              <Polyline positions={line(route.ghost.line)} pathOptions={{ color: '#0f3d8a', weight: 12, lineCap: 'round', lineJoin: 'round' }} />
              <Polyline positions={line(route.ghost.line)} pathOptions={{ color: '#3d8bff', weight: 7, lineCap: 'round', lineJoin: 'round' }} />
              {traveled && <Polyline positions={line(traveled)} pathOptions={{ color: '#8e98a4', weight: 7, lineCap: 'round', lineJoin: 'round' }} />}
            </>
          )}
          {dest && <Marker position={[dest.lat, dest.lng]} icon={destIcon} />}
          {!driving && (
            <PlayerMarker position={me}>
              <Suspense fallback={null}>
                <MapCar3D body={carLook.body} color={carLook.color} heading={gps?.heading || 0} pitch={52} size={110} />
              </Suspense>
            </PlayerMarker>
          )}
        </TacticalMap>
      </div>

      {/* Auto en modo navegación: fijo al centro, el mapa se mueve debajo */}
      {driving && (
        <div className="nav-car">
          <Suspense fallback={null}>
            <MapCar3D body={carLook.body} color={carLook.color} headingRef={headingRef} pitch={40} size={170} driving />
          </Suspense>
        </div>
      )}

      <div className="vhs-tracking" />
      <VhsOsd />

      {/* ---------- HUD ---------- */}
      {!driving && (
        <div className="map-hud-top">
          <div className="cassette">
            <div className="cassette-label">
              <div className="row between">
                <span className="cassette-title">VELOX.SYS — LADO A</span>
                <span className="cassette-reels"><i /><i /></span>
              </div>
              <div className="cassette-coords mono">{dms(center.lat, center.lng)}</div>
              <div className="cassette-meta mono">{visibleReports.length} alertas · {visiblePois.length} lugares</div>
            </div>
          </div>
          <div className="map-tools">
            <button className={`icon-btn ${panel === 'layers' ? 'on' : ''}`} onClick={() => setPanel('layers')} aria-label="Capas"><Icon name="layers" /></button>
            <button className="icon-btn" onClick={() => savePrefs({ mapStyle: mapStyle === 'calle' ? 'noche' : 'calle' })} aria-label="Estilo de mapa"><span className="mono" style={{ fontSize: 11 }}>{mapStyle === 'calle' ? 'NOCHE' : 'CALLE'}</span></button>
            <button className={`icon-btn ${tilt ? 'on' : ''}`} onClick={() => setTilt((t) => !t)} aria-label="Vista 3D"><Icon name="cube" /></button>
            <button className="icon-btn" onClick={() => flyTo(me, 16)} aria-label="Mi ubicación"><Icon name="gps" /></button>
          </div>
        </div>
      )}
      {(placing || routeMode) && <div className="map-crosshair"><Icon name="crosshair" size={44} stroke={1.5} /></div>}

      {/* HUD de navegación */}
      {driving && (
        <>
          <div className="nav-banner">
            <div className="nav-glyph">{drive.next ? glyph(drive.next) : '▲'}</div>
            <div className="grow">
              <div className="nav-dist">{drive.next ? km(Math.max(0, drive.next.along - drive.d)) : ''}</div>
              <div className="nav-text">{drive.done ? 'Llegaste a destino' : drive.next?.text || 'Seguí la ruta'}</div>
            </div>
          </div>
          {drive.hazard && !drive.done && (
            <div className="nav-hazard" style={{ '--c': REPORT_TYPES[drive.hazard.type].color }}>
              <Icon name={REPORT_TYPES[drive.hazard.type].icon} size={20} />
              <b>{REPORT_TYPES[drive.hazard.type].label.toUpperCase()}</b> a {km(drive.hazard.along - drive.d)}
            </div>
          )}
          {drive.done && <div className="nav-arrived tag-font">llegaste</div>}
          <div className="nav-bottom">
            <div>
              <div className="nav-eta">{mins(route.ghost.duration * (1 - drive.d / drive.total))}</div>
              <div className="mono muted" style={{ fontSize: 12 }}>{km(drive.total - drive.d)} · {route.ghost.hazards.length} alertas en ruta</div>
            </div>
            <div className="nav-speed"><b>{drive.done ? 0 : 58 + Math.round(Math.sin(drive.d / 90) * 6)}</b><small>km/h</small></div>
            <button className="btn red sm" onClick={stopDrive}>Salir</button>
          </div>
        </>
      )}

      {placing && (
        <div className="map-bottom panel accent">
          <div className="label">Centrá el mapa sobre el punto</div>
          <div className="h-display h-sm mt-s" style={{ color: REPORT_TYPES[placing].color }}>{REPORT_TYPES[placing].label}</div>
          <div className="row mt-s">
            <button className="btn sm" onClick={placeReport}><Icon name="check" size={18} /> Confirmar</button>
            <button className="btn ghost sm" onClick={() => setPlacing(null)}><span>Cancelar</span></button>
          </div>
        </div>
      )}

      {routeMode && (
        <div className="map-bottom panel accent">
          <div className="label">Ruta fantasma</div>
          <div className="mt-s">Tocá el destino en el mapa o elegí un lugar.</div>
          <div className="row mt-s">
            <button className="btn sm" disabled={tilt} onClick={() => { setRouteMode(false); traceRoute(center); }}>Usar centro</button>
            <button className="btn ghost sm" onClick={() => setRouteMode(false)}><span>Cancelar</span></button>
          </div>
        </div>
      )}

      {route && !placing && !routeMode && !driving && (
        <div className="map-bottom panel route-card">
          <div className="row between">
            <div>
              <div className="label">Ruta fantasma {route.ghost.avoided ? '· desvío inteligente' : ''}</div>
              <div className="route-time">{mins(route.ghost.duration)} <span>{km(route.ghost.distance)}</span></div>
            </div>
            <button className="icon-btn" onClick={clearRoute} aria-label="Cerrar ruta"><Icon name="close" /></button>
          </div>
          <div className="route-stats mono">
            <span className={route.ghost.hazards.length ? 'yellow' : 'lime'}>{route.ghost.hazards.length ? `${route.ghost.hazards.length} alertas en ruta` : 'ruta limpia'}</span>
            {route.fastest && <span className="muted">gris: más rápida ({mins(route.fastest.duration)}, {route.fastest.hazards.length} alertas)</span>}
            {route.saved > 0 && <span className="lime">esquivás {route.saved}</span>}
          </div>
          <div className="grid-2 mt-s">
            <button className="btn ghost sm" onClick={() => setPanel('steps')}><span>Paso a paso</span></button>
            <button className="btn sm" onClick={startDrive}><Icon name="play" size={16} /> Manejar</button>
          </div>
        </div>
      )}

      {!placing && !routeMode && !route && (
        <div className="map-actions">
          <button className="btn red" onClick={() => setPanel('report')}><Icon name="camera" size={20} /> Reportar</button>
          <button className="btn" disabled={routing} onClick={() => setRouteMode(true)}><Icon name="route" size={20} /> {routing ? 'Calculando…' : 'Ruta fantasma'}</button>
        </div>
      )}

      {/* ---------- Sheets ---------- */}
      <Sheet open={panel === 'steps'} onClose={() => setPanel(null)} title="Paso a paso">
        {route && (
          <ol className="steps-list">
            {route.ghost.steps.map((s, i) => (
              <li key={i}>
                <span className="step-glyph">{glyph(s)}</span>
                <div className="grow">{s.text}</div>
                {s.distance > 0 && <span className="mono muted">{km(s.distance)}</span>}
              </li>
            ))}
          </ol>
        )}
        <button className="btn block mt" onClick={startDrive}><Icon name="play" size={16} /> Manejar</button>
      </Sheet>

      <Sheet open={panel === 'report'} onClose={() => setPanel(null)} title="Reportar">
        <div className="report-grid">
          {Object.entries(REPORT_TYPES).map(([k, t]) => (
            <button key={k} className="report-type" style={{ '--c': t.color }} onClick={() => { setPlacing(k); setPanel(null); setRoute(null); }}>
              <div className="report-hex"><Icon name={t.icon} size={26} /></div>
              <b>{t.label}</b>
              <small className="muted">{t.hint}</small>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={panel === 'layers'} onClose={() => setPanel(null)} title="Capas">
        <div className="label mb">Estilo del mapa</div>
        <div className="chips mb">
          {Object.entries(MAP_STYLES).map(([k, s]) => (
            <button key={k} className={`chip ${mapStyle === k ? 'on' : ''}`} onClick={() => savePrefs({ mapStyle: k })}><span>{s.label}</span></button>
          ))}
        </div>
        {[['reports', 'Alertas de la comunidad'], ['pois', 'Talleres · lavaderos · estaciones'], ['meets', 'Juntadas']].map(([k, l]) => (
          <label key={k} className="toggle">
            <span>{l}</span>
            <input type="checkbox" checked={prefs.layers[k]} onChange={(e) => savePrefs({ layers: { ...prefs.layers, [k]: e.target.checked } })} />
            <span className="sw" />
          </label>
        ))}
        <div className="label mt mb">Alertas visibles</div>
        <div className="chips">
          {Object.entries(REPORT_TYPES).map(([k, t]) => {
            const on = prefs.reportTypes.includes(k);
            return <button key={k} className={`chip ${on ? 'on' : ''}`} onClick={() => savePrefs({ reportTypes: on ? prefs.reportTypes.filter((x) => x !== k) : [...prefs.reportTypes, k] })}><span>{t.label}</span></button>;
          })}
        </div>
        <div className="label mt mb">Lugares</div>
        <div className="chips">
          {Object.entries(POI_TYPES).map(([k, t]) => {
            const on = prefs.poiTypes.includes(k);
            return <button key={k} className={`chip ${on ? 'on' : ''}`} onClick={() => savePrefs({ poiTypes: on ? prefs.poiTypes.filter((x) => x !== k) : [...prefs.poiTypes, k] })}><span>{t.label}</span></button>;
          })}
        </div>
        <div className="label mt mb">La ruta fantasma evita</div>
        <div className="chips">
          {Object.entries(REPORT_TYPES).map(([k, t]) => {
            const on = prefs.avoid[k];
            return <button key={k} className={`chip ${on ? 'on' : ''}`} onClick={() => savePrefs({ avoid: { ...prefs.avoid, [k]: !on } })}><span>{t.label}</span></button>;
          })}
        </div>
      </Sheet>

      <Sheet open={selected?.kind === 'report'} onClose={() => setSelected(null)} title={selected?.kind === 'report' ? REPORT_TYPES[selected.item.type].label : ''}>
        {selected?.kind === 'report' && (() => {
          const r = selected.item;
          return (
            <div>
              {r.note && <p>{r.note}</p>}
              <div className="mono muted">Reportado por @{r.handle} · hace {timeAgo(r.createdAt)}</div>
              <div className="mono mt-s"><span className="lime">▲ {r.confirms} confirman</span> · <span className="red">▼ {r.denies} desmienten</span></div>
              <div className="grid-2 mt">
                <button className="btn lime sm" onClick={() => vote(r, 'confirm')}>Sigue ahí</button>
                <button className="btn ghost red sm" onClick={() => vote(r, 'deny')}><span>Ya no está</span></button>
              </div>
            </div>
          );
        })()}
      </Sheet>

      <Sheet open={selected?.kind === 'poi'} onClose={() => setSelected(null)} title={selected?.kind === 'poi' ? selected.item.name : ''}>
        {selected?.kind === 'poi' && (() => {
          const p = selected.item;
          const t = POI_TYPES[p.type];
          return (
            <div>
              <div className="row wrap">
                <span className="badge" style={{ color: t.color }}><Icon name={t.icon} size={14} /> {t.label}</span>
                {p.rating && <span className="badge yellow">★ {p.rating.toFixed(1)}</span>}
                {p.open24 && <span className="badge lime">24H</span>}
                {p.tags?.map((x) => <span key={x} className="badge muted">{x}</span>)}
              </div>
              <div className="mono muted mt-s">{dms(p.lat, p.lng)}</div>
              <button className="btn block mt" onClick={() => traceRoute({ lat: p.lat, lng: p.lng })}><Icon name="route" size={20} /> Ruta fantasma hasta acá</button>
            </div>
          );
        })()}
      </Sheet>

      <Sheet open={selected?.kind === 'meet'} onClose={() => setSelected(null)} title={selected?.kind === 'meet' ? selected.item.title : ''}>
        {selected?.kind === 'meet' && (() => {
          const m = selected.item;
          return (
            <div>
              <div className="row wrap">
                {m.spot ? <span className="sticker lime">SPOT DESBLOQUEADO</span> : <span className="sticker orange">ZONA CIFRADA</span>}
                <span className="badge muted">{dateLabel(m.startsAt)}</span>
              </div>
              <div className="mt-s mono">T-MENOS <Countdown to={m.startsAt} className="orange" /></div>
              {!m.spot && <p className="muted">La ubicación exacta está oculta. Solo aparece para los aprobados{m.revealAt ? ', y se revela poco antes de arrancar' : ''}.</p>}
              {m.spot && <p className="mono">{m.spot.label}</p>}
              <div className="grid-2 mt">
                <button className="btn sm" onClick={() => nav(`/juntadas/${m.id}`)}>Ver juntada</button>
                {m.spot && <button className="btn ghost sm" onClick={() => traceRoute(m.spot)}><span>Ruta</span></button>}
              </div>
            </div>
          );
        })()}
      </Sheet>
    </div>
  );
}
