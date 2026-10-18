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
import { makeTrack, pointAt, alongTrack, bearing, distance } from '../lib/geo.js';
import { bodyFor } from '../lib/car3d.js';
import { reportIcon, poiIcon, zoneIcon, spotIcon, destIcon } from '../lib/mapIcons.js';
import Icon from '../components/Icon.jsx';
import TacticalMap, { MAP_STYLES, MAP_SOURCES } from '../components/TacticalMap.jsx';
import { Countdown, Sheet } from '../components/ui.jsx';

const MapCar3D = lazy(() => import('../components/MapCar3D.jsx'));

const NAV_ZOOM = 17;
const NAV_SECONDS = 50; // la simulación recorre cualquier ruta en ~50 s
const POI_MIN_ZOOM = 14; // los lugares aparecen al acercarse, para no saturar la vista general
const CHASE_OFFSET = 130; // px: en 3D el auto va más abajo del centro para ver más camino adelante
const OFF_ROUTE_M = 45; // a más de esto de la ruta (con GPS) se considera fuera de ruta
const TURN_GLYPH = { left: '↰', 'sharp left': '↰', 'slight left': '↖', right: '↱', 'sharp right': '↱', 'slight right': '↗', uturn: '↶', straight: '↑' };
const QUICK_LABEL = { taller: 'Taller', tuning: 'Tuning', lavadero: 'Lavadero', nafta: 'Estación', gomeria: 'Gomería' };
const glyph = (s) => (s.type === 'arrive' ? '◉' : s.type === 'depart' ? '▲' : s.type === 'roundabout' || s.type === 'rotary' ? '⟳' : TURN_GLYPH[s.modifier] || '↑');

// Interpolación de ángulos por el camino más corto.
const lerpAngle = (a, b, t) => a + ((((b - a + 540) % 360) - 180) * t);

function Tracker({ onMove, onPick, onZoom }) {
  useMapEvents({
    move: (e) => onMove(e.target.getCenter()),
    zoomend: (e) => onZoom(e.target.getZoom()),
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

// OSD de videocasetera: ▶ PLAY + contador de cinta.
function VhsOsd() {
  const start = useRef(Date.now());
  const now = useNow(1000);
  const s = Math.floor((now - start.current) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return <div className="vhs-osd vhs-tl"><span className="vhs-blink">▶</span> PLAY {pad(Math.floor(s / 3600))}:{pad(Math.floor(s / 60) % 60)}:{pad(s % 60)}</div>;
}

// Destino rápido: buscador, "lo más cercano", guardados y juntadas. Sin mover el mapa.
function DestinationPicker({ me, pois, meets, places, onGo, onRemovePlace }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (q.trim().length < 3) { setResults(null); setError(null); return undefined; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const d = await api(`/geo/search?q=${encodeURIComponent(q)}&lat=${me.lat}&lng=${me.lng}`);
        setResults(d.results);
        setError(d.error);
      } catch (e) { setError(e.message); }
      setSearching(false);
    }, 450);
    return () => clearTimeout(t);
  }, [q, me.lat, me.lng]);

  const nearest = useMemo(() => Object.keys(POI_TYPES).map((type) => {
    const list = pois.filter((p) => p.type === type);
    if (!list.length) return null;
    const p = list.reduce((a, b) => (distance(me, a) <= distance(me, b) ? a : b));
    return { type, poi: p, d: distance(me, p) };
  }).filter(Boolean), [pois, me]);

  const spots = meets.filter((m) => m.spot);

  return (
    <div className="dest-picker">
      <div className="dest-search">
        <Icon name="target" size={18} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar dirección o lugar" autoComplete="off" />
      </div>
      {searching && <div className="mono muted mt-s">Buscando…</div>}
      {error && <div className="mono yellow mt-s" style={{ fontSize: 12 }}>{error}</div>}
      {results && (
        <div className="dest-list mt-s">
          {results.length === 0 && !searching && <div className="mono muted">Sin resultados.</div>}
          {results.map((r, i) => (
            <button key={i} className="dest-item" onClick={() => onGo(r, r.name)}>
              <Icon name={r.source === 'velox' ? POI_TYPES[r.type]?.icon || 'pin' : 'pin'} size={18} />
              <div className="grow"><b>{r.name}</b><small>{r.address}</small></div>
              <span className="mono muted">{km(r.distance)}</span>
            </button>
          ))}
        </div>
      )}

      {!results && (
        <>
          <div className="label mt mb">Lo más cercano</div>
          <div className="quick-grid">
            {nearest.map(({ type, poi, d }) => (
              <button key={type} className="quick" style={{ '--c': POI_TYPES[type].color }} onClick={() => onGo(poi, poi.name)}>
                <span className="quick-ico"><Icon name={POI_TYPES[type].icon} size={20} /></span>
                <b>{QUICK_LABEL[type]}</b>
                <small>{km(d)}</small>
              </button>
            ))}
          </div>

          <div className="label mt mb">Guardados</div>
          {places.length === 0 && <div className="mono muted" style={{ fontSize: 13 }}>Tocá un punto del mapa y guardalo para tenerlo a un toque.</div>}
          <div className="dest-list">
            {places.map((p) => (
              <div key={p.id} className="dest-item">
                <button className="dest-item-main" onClick={() => onGo(p, p.name)}>
                  <Icon name="pin" size={18} />
                  <div className="grow"><b>{p.name}</b><small>{km(distance(me, p))}</small></div>
                </button>
                <button className="icon-btn" onClick={() => onRemovePlace(p)} aria-label={`Borrar ${p.name}`}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>

          {spots.length > 0 && (
            <>
              <div className="label mt mb">Juntadas</div>
              <div className="dest-list">
                {spots.map((m) => (
                  <button key={m.id} className="dest-item" onClick={() => onGo(m.spot, m.title)}>
                    <Icon name="meets" size={18} />
                    <div className="grow"><b>{m.title}</b><small>{m.spot.label} · {km(distance(me, m.spot))}</small></div>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="mono muted mt" style={{ fontSize: 12 }}>También podés tocar cualquier punto del mapa.</div>
        </>
      )}
    </div>
  );
}

export default function MapPage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const mapRef = useRef(null);
  const wrapRef = useRef(null);
  const prefs = user.prefs;
  const places = prefs.places || [];
  const mapStyle = prefs.mapStyle || 'calle';
  const mapSource = prefs.mapSource || 'auto';
  const myCar = user.cars[0];
  const carLook = { body: bodyFor(myCar), color: myCar?.color || '#d8461b' };

  const [reports, setReports] = useState([]);
  const [pois, setPois] = useState([]);
  const [meets, setMeets] = useState([]);
  const [gps, setGps] = useState(null);
  const gpsRef = useRef(null);
  const centered = useRef(false);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(15);
  const [selected, setSelected] = useState(null); // { kind, item }
  const [panel, setPanel] = useState(null); // 'report' | 'layers' | 'steps' | 'dest'
  const [placing, setPlacing] = useState(null);
  const [picked, setPicked] = useState(null); // punto tocado en el mapa
  const [naming, setNaming] = useState(null); // nombre al guardar un lugar
  const [dest, setDest] = useState(null); // { lat, lng, name }
  const [route, setRoute] = useState(null);
  const [routing, setRouting] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [drive, setDrive] = useState(null); // estado de navegación para el HUD (10 Hz)
  const [navView, setNavView] = useState('3d');
  const navRef = useRef(null);
  const carHeadingRef = useRef(0);

  const me = gps || DEFAULT_CENTER; // sin GPS (ej. desktop) arrancamos en el centro de CABA

  const loadReports = useCallback(() => api('/map/reports').then((d) => setReports(d.reports)).catch(() => {}), []);
  useEffect(() => {
    loadReports();
    api('/map/pois').then((d) => setPois(d.pois)).catch(() => {});
    api('/meets').then((d) => setMeets(d.meets)).catch(() => {});
  }, [loadReports]);
  useInterval(loadReports, 30000);

  // Posición en tiempo real. El primer fix centra el mapa en vos.
  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading, speed: p.coords.speed, at: Date.now() };
        gpsRef.current = fix;
        setGps(fix);
        if (!centered.current && mapRef.current) {
          centered.current = true;
          mapRef.current.setView([fix.lat, fix.lng], 16);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const savePrefs = async (next) => {
    const merged = { ...prefs, ...next };
    setUser({ ...user, prefs: merged });
    try { await api('/users/me', { method: 'PATCH', body: { prefs: merged } }); } catch { /* se reintenta en el próximo cambio */ }
  };

  const visibleReports = useMemo(() => (prefs.layers.reports ? reports.filter((r) => prefs.reportTypes.includes(r.type)) : []), [reports, prefs]);
  const visiblePois = useMemo(() => (prefs.layers.pois && zoom >= POI_MIN_ZOOM ? pois.filter((p) => prefs.poiTypes.includes(p.type)) : []), [pois, prefs, zoom]);

  const flyTo = (p, z = 16) => mapRef.current?.flyTo([p.lat, p.lng], z, { duration: 0.8 });

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

  const traceRoute = async (to, name) => {
    const target = { lat: to.lat, lng: to.lng, name: name || null };
    setDest(target);
    setPicked(null);
    setPanel(null);
    setSelected(null);
    setRouting(true);
    try {
      const d = await api('/route/safe', { method: 'POST', body: { from: me, to: target } });
      setRoute(d);
      const pts = [...d.ghost.line, ...(d.fastest?.line || [])].map((p) => [p.lat, p.lng]);
      mapRef.current?.fitBounds(pts, { padding: [70, 70] });
      if (d.engine === 'offline') toast('Motor de rutas sin señal: línea directa', 'err');
    } catch (e) { toast(e.message, 'err'); }
    setRouting(false);
  };

  const savePlace = async (p, name) => {
    const place = { id: `p${Date.now().toString(36)}`, name: name.trim() || 'Lugar', lat: p.lat, lng: p.lng };
    await savePrefs({ places: [...places, place].slice(-12) });
    toast(`"${place.name}" guardado`, 'ok');
    setNaming(null);
  };
  const removePlace = (p) => savePrefs({ places: places.filter((x) => x.id !== p.id) });

  const onPick = (latlng) => {
    if (placing || navRef.current || tilt) return;
    setSelected(null);
    setNaming(null);
    setPicked({ lat: latlng.lat, lng: latlng.lng });
  };

  // ---------------- Navegación ----------------
  const buildNav = (r) => {
    const track = makeTrack(r.ghost.line);
    return {
      track,
      steps: r.ghost.steps.map((s) => ({ ...s, along: alongTrack(track, s.at).along })),
      hazards: reports.map((x) => ({ ...x, ...alongTrack(track, x) })).filter((x) => x.offset < 45),
    };
  };

  const startDrive = () => {
    const base = buildNav(route);
    const start = pointAt(base.track, 0);
    const source = gpsRef.current ? 'gps' : 'sim';
    navRef.current = {
      ...base,
      source,
      view: navView,
      d: 0,
      pos: { lat: start.lat, lng: start.lng },
      heading: start.heading,
      camHeading: start.heading,
      target: null,
      targetHeading: start.heading,
      lastFix: null,
      offSince: null,
      rerouting: false,
      last: performance.now(),
      lastUi: 0,
      speed: Math.max(20, base.track.total / NAV_SECONDS),
    };
    setPanel(null);
    setDrive({ d: 0, total: base.track.total, source, cut: start });
  };

  const stopDrive = () => {
    navRef.current = null;
    if (wrapRef.current) { wrapRef.current.style.transform = ''; wrapRef.current.style.removeProperty('--counter'); }
    setDrive(null);
  };

  const reroute = async (n) => {
    n.rerouting = true;
    toast('Fuera de ruta · recalculando', 'info');
    try {
      const d = await api('/route/safe', { method: 'POST', body: { from: n.pos, to: dest } });
      if (navRef.current !== n) return;
      setRoute(d);
      Object.assign(n, buildNav(d), { d: 0, offSince: null });
      setDrive((s) => ({ ...s, total: n.track.total }));
    } catch { /* se reintenta en el próximo fix fuera de ruta */ }
    n.rerouting = false;
  };

  const setSource = (source) => {
    const n = navRef.current;
    if (!n || (source === 'gps' && !gpsRef.current)) return;
    n.source = source;
    n.lastFix = null;
    n.offSince = null;
    setDrive((s) => ({ ...s, source }));
  };

  const toggleView = () => {
    const v = navView === '3d' ? '2d' : '3d';
    setNavView(v);
    if (navRef.current) navRef.current.view = v;
  };

  useEffect(() => {
    if (!drive) return undefined;
    const map = mapRef.current;
    const wrap = wrapRef.current;
    // El contenedor cambia de tamaño entre vistas: Leaflet tiene que recalcular.
    requestAnimationFrame(() => map?.invalidateSize({ animate: false }));
    let raf;
    const tick = (now) => {
      const n = navRef.current;
      if (!n) return;
      const dt = Math.min(0.1, (now - n.last) / 1000);
      n.last = now;

      if (n.source === 'sim') {
        n.d = Math.min(n.track.total, n.d + n.speed * dt);
        const p = pointAt(n.track, n.d);
        n.target = p;
        n.targetHeading = p.heading;
      } else {
        const fix = gpsRef.current;
        if (fix && fix !== n.lastFix) {
          n.lastFix = fix;
          const a = alongTrack(n.track, fix);
          if (a.offset < OFF_ROUTE_M) {
            // Pegado a la ruta: avanzamos sobre la línea (evita el "temblor" del GPS).
            const p = pointAt(n.track, a.along);
            n.d = Math.max(n.d, a.along);
            n.target = p;
            n.targetHeading = p.heading;
            n.offSince = null;
          } else {
            n.target = fix;
            if (fix.heading != null && !Number.isNaN(fix.heading)) n.targetHeading = fix.heading;
            else if (distance(n.pos, fix) > 3) n.targetHeading = bearing(n.pos, fix);
            n.offSince ??= now;
          }
        }
        if (n.offSince && now - n.offSince > 5000 && !n.rerouting) reroute(n);
      }

      const t = n.target || n.pos;
      const k = n.source === 'sim' ? 1 : Math.min(1, dt * 4);
      n.pos = { lat: n.pos.lat + (t.lat - n.pos.lat) * k, lng: n.pos.lng + (t.lng - n.pos.lng) * k };
      n.heading = lerpAngle(n.heading, n.targetHeading, Math.min(1, dt * 8));
      // Cámara de persecución: el mapa gira para que el auto siempre mire "hacia adelante".
      n.camHeading = n.view === '3d' ? lerpAngle(n.camHeading, n.heading, Math.min(1, dt * 2.5)) : 0;
      carHeadingRef.current = n.heading - n.camHeading;
      map?.setView([n.pos.lat, n.pos.lng], NAV_ZOOM, { animate: false });
      if (wrap) {
        wrap.style.transform = n.view === '3d' ? `perspective(1100px) translateY(${CHASE_OFFSET}px) rotateX(56deg) rotateZ(${-n.camHeading}deg)` : '';
        wrap.style.setProperty('--counter', `${n.camHeading}deg`);
      }

      if (now - n.lastUi > 100) {
        n.lastUi = now;
        const next = n.steps.find((s) => s.along > n.d + 5) || n.steps[n.steps.length - 1];
        const hazard = n.hazards.find((h) => h.along > n.d && h.along - n.d < 450);
        setDrive((s) => ({ ...s, d: n.d, total: n.track.total, cut: pointAt(n.track, n.d), next, hazard, done: n.d >= n.track.total - 20, off: Boolean(n.offSince) }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [Boolean(drive), navView]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drive) requestAnimationFrame(() => mapRef.current?.invalidateSize({ animate: false }));
  }, [Boolean(drive)]); // eslint-disable-line react-hooks/exhaustive-deps

  const driving = Boolean(drive);
  const traveled = drive?.cut && route ? route.ghost.line.slice(0, drive.cut.index).concat([drive.cut]) : null;
  const hazardIds = new Set(route?.ghost.hazards.map((h) => h.id));
  const line = (pts) => pts.map((p) => [p.lat, p.lng]);
  const wrapClass = driving ? (navView === '3d' ? 'nav3d' : 'nav2d') : tilt ? 'tilted' : '';
  const destLabel = dest?.name || (dest ? dms(dest.lat, dest.lng) : '');
  const destSaved = dest && places.some((p) => distance(p, dest) < 30);

  return (
    <div className={`screen full map-screen page-enter ${driving ? 'is-driving' : ''}`}>
      <div ref={wrapRef} className={`map-wrap ${wrapClass}`}>
        <TacticalMap ref={mapRef} center={DEFAULT_CENTER} zoom={15} mapStyle={mapStyle} source={mapSource}>
          <Tracker onMove={setCenter} onPick={onPick} onZoom={setZoom} />

          {prefs.layers.meets && meets.map((m) => (m.spot ? (
            <Marker key={m.id} position={[m.spot.lat, m.spot.lng]} icon={spotIcon(m.title)} eventHandlers={{ click: () => setSelected({ kind: 'meet', item: m }) }} />
          ) : (
            <Fragment key={m.id}>
              <Circle center={[m.zone.lat, m.zone.lng]} radius={m.zone.radius} bubblingMouseEvents={false} pathOptions={{ className: 'zone-circle', color: '#e8621a', weight: 2, dashArray: '2 10', lineCap: 'square', fillColor: '#e8621a', fillOpacity: 0.07 }} eventHandlers={{ click: () => setSelected({ kind: 'meet', item: m }) }} />
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
          {picked && <Marker position={[picked.lat, picked.lng]} icon={destIcon} />}
          {!driving && (
            <PlayerMarker position={me}>
              <Suspense fallback={null}>
                <MapCar3D body={carLook.body} color={carLook.color} heading={gps?.heading || 0} pitch={52} size={110} />
              </Suspense>
            </PlayerMarker>
          )}
        </TacticalMap>
      </div>

      {/* Horizonte: donde termina el mapa inclinado, cielo con niebla */}
      {driving && navView === '3d' && <div className="nav-horizon" />}

      {/* Auto en navegación: fijo en pantalla, el mapa se mueve (y en 3D gira) debajo */}
      {driving && (
        <div className={`nav-car ${navView}`} style={navView === '3d' ? { top: `calc(50% + ${CHASE_OFFSET}px)` } : undefined}>
          <Suspense fallback={null}>
            <MapCar3D key={navView} body={carLook.body} color={carLook.color} headingRef={carHeadingRef} pitch={navView === '3d' ? 34 : 86} size={navView === '3d' ? 190 : 120} driving />
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
            </div>
          </div>
          <div className="map-tools">
            <button className={`icon-btn ${panel === 'layers' ? 'on' : ''}`} onClick={() => setPanel('layers')} aria-label="Capas"><Icon name="layers" /></button>
            <button className="icon-btn" onClick={() => savePrefs({ mapStyle: mapStyle === 'calle' ? 'noche' : 'calle' })} aria-label="Estilo de mapa"><span className="mono" style={{ fontSize: 11 }}>{mapStyle === 'calle' ? 'NOCHE' : 'CALLE'}</span></button>
            <button className="icon-btn" onClick={() => flyTo(me, 16)} aria-label="Mi ubicación"><Icon name="gps" /></button>
          </div>
        </div>
      )}
      {placing && <div className="map-crosshair"><Icon name="crosshair" size={44} stroke={1.5} /></div>}

      {/* HUD de navegación */}
      {driving && (
        <>
          <div className="nav-banner">
            <div className="nav-glyph">{drive.next ? glyph(drive.next) : '▲'}</div>
            <div className="grow">
              <div className="nav-dist">{drive.next && !drive.done ? km(Math.max(0, drive.next.along - drive.d)) : ''}</div>
              <div className="nav-text">{drive.done ? 'Llegaste a destino' : drive.off ? 'Fuera de ruta' : drive.next?.text || 'Seguí la ruta'}</div>
            </div>
          </div>
          <div className="nav-side">
            <button className="nav-chip" onClick={toggleView} aria-label="Cambiar vista">{navView === '3d' ? '2D' : '3D'}</button>
            {gps && (
              <button className={`nav-chip ${drive.source === 'gps' ? 'live' : ''}`} onClick={() => setSource(drive.source === 'gps' ? 'sim' : 'gps')}>
                {drive.source === 'gps' ? 'GPS' : 'SIM'}
              </button>
            )}
          </div>
          <div className={`nav-source ${drive.source}`}>{drive.source === 'gps' ? '● EN VIVO' : 'SIMULACIÓN'}</div>
          {drive.hazard && !drive.done && (
            <div className="nav-hazard" style={{ '--c': REPORT_TYPES[drive.hazard.type].color }}>
              <Icon name={REPORT_TYPES[drive.hazard.type].icon} size={20} />
              <b>{REPORT_TYPES[drive.hazard.type].label.toUpperCase()}</b> a {km(drive.hazard.along - drive.d)}
            </div>
          )}
          {drive.done && <div className="nav-arrived tag-font">llegaste</div>}
          <div className="nav-bottom">
            <div>
              <div className="nav-eta">{drive.done ? 'Llegaste' : mins((route?.ghost.duration || 0) * Math.max(0, 1 - drive.d / drive.total))}</div>
              <div className="mono muted" style={{ fontSize: 12 }}>{km(Math.max(0, drive.total - drive.d))} · {destLabel}</div>
            </div>
            <div className="nav-speed">
              <b>{drive.source === 'gps' ? Math.round((gps?.speed || 0) * 3.6) : drive.done ? 0 : 58 + Math.round(Math.sin(drive.d / 90) * 6)}</b>
              <small>km/h</small>
            </div>
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

      {/* Punto tocado en el mapa */}
      {picked && !placing && !driving && (
        <div className="map-bottom panel accent">
          <div className="row between">
            <div>
              <div className="label">Destino marcado</div>
              <div className="mono mt-s">{dms(picked.lat, picked.lng)} · {km(distance(me, picked))}</div>
            </div>
            <button className="icon-btn" onClick={() => { setPicked(null); setNaming(null); }} aria-label="Cancelar"><Icon name="close" /></button>
          </div>
          {naming !== null ? (
            <form className="row mt" onSubmit={(e) => { e.preventDefault(); savePlace(picked, naming); }}>
              <input className="input" autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} placeholder="Nombre (Casa, Laburo…)" maxLength={30} />
              <button className="btn sm">Guardar</button>
            </form>
          ) : (
            <div className="grid-2 mt">
              <button className="btn ghost sm" onClick={() => setNaming('')}><span>Guardar</span></button>
              <button className="btn sm" disabled={routing} onClick={() => traceRoute(picked)}><Icon name="route" size={16} /> {routing ? '…' : 'Ir acá'}</button>
            </div>
          )}
        </div>
      )}

      {route && !placing && !picked && !driving && (
        <div className="map-bottom panel route-card">
          <div className="row between">
            <div style={{ minWidth: 0 }}>
              <div className="label">Hacia {destLabel}{route.ghost.avoided ? ' · desvío inteligente' : ''}</div>
              <div className="route-time">{mins(route.ghost.duration)} <span>{km(route.ghost.distance)}</span></div>
            </div>
            <button className="icon-btn" onClick={() => { stopDrive(); setRoute(null); setDest(null); }} aria-label="Cerrar ruta"><Icon name="close" /></button>
          </div>
          <div className="route-stats mono">
            <span className={route.ghost.hazards.length ? 'yellow' : 'lime'}>{route.ghost.hazards.length ? `${route.ghost.hazards.length} alertas en ruta` : 'ruta limpia'}</span>
            {route.fastest && <span className="muted">gris: más rápida ({mins(route.fastest.duration)}, {route.fastest.hazards.length} alertas)</span>}
            {route.saved > 0 && <span className="lime">esquivás {route.saved}</span>}
          </div>
          <div className="grid-2 mt">
            <button className="btn ghost sm" onClick={() => setPanel('steps')}><span>Paso a paso</span></button>
            <button className="btn sm" onClick={startDrive}><Icon name="play" size={16} /> Manejar</button>
          </div>
          {!destSaved && dest && (
            <button className="link-btn mt-s" onClick={() => { setPicked({ lat: dest.lat, lng: dest.lng }); setNaming(dest.name || ''); }}>★ Guardar este destino</button>
          )}
        </div>
      )}

      {!placing && !picked && !route && !driving && (
        <div className="map-actions">
          <button className="btn red" onClick={() => setPanel('report')}><Icon name="camera" size={20} /> Reportar</button>
          <button className="btn" disabled={routing} onClick={() => setPanel('dest')}><Icon name="route" size={20} /> {routing ? 'Calculando…' : '¿A dónde?'}</button>
        </div>
      )}

      {/* ---------- Sheets ---------- */}
      <Sheet open={panel === 'dest'} onClose={() => setPanel(null)} title="¿A dónde vamos?">
        <DestinationPicker me={me} pois={pois} meets={meets} places={places} onGo={(p, name) => traceRoute(p, name)} onRemovePlace={removePlace} />
      </Sheet>

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
            <button key={k} className="report-type" style={{ '--c': t.color }} onClick={() => { setPlacing(k); setPanel(null); setRoute(null); setPicked(null); }}>
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
        <div className="label mb">Fuente del mapa</div>
        <div className="chips mb">
          {Object.entries(MAP_SOURCES).map(([k, label]) => (
            <button key={k} className={`chip ${mapSource === k ? 'on' : ''}`} onClick={() => savePrefs({ mapSource: k })}><span>{label}</span></button>
          ))}
        </div>
        <label className="toggle">
          <span>Vista 3D inclinada</span>
          <input type="checkbox" checked={tilt} onChange={(e) => setTilt(e.target.checked)} />
          <span className="sw" />
        </label>
        {[['reports', 'Alertas de la comunidad'], ['pois', 'Talleres · lavaderos · estaciones (al acercar)'], ['meets', 'Juntadas']].map(([k, l]) => (
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
                <span className="badge muted">{km(distance(me, p))}</span>
              </div>
              <button className="btn block mt" onClick={() => traceRoute(p, p.name)}><Icon name="route" size={20} /> Ir acá</button>
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
                <button className="btn ghost sm" onClick={() => nav(`/juntadas/${m.id}`)}><span>Ver juntada</span></button>
                {m.spot && <button className="btn sm" onClick={() => traceRoute(m.spot, m.title)}>Ir acá</button>}
              </div>
            </div>
          );
        })()}
      </Sheet>
    </div>
  );
}
