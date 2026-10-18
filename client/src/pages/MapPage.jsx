import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, Marker, Polyline, useMapEvents } from 'react-leaflet';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { useInterval } from '../lib/useInterval.js';
import { REPORT_TYPES, POI_TYPES, DEFAULT_CENTER } from '../lib/constants.js';
import { dms, km, mins, timeAgo, dateLabel } from '../lib/format.js';
import { reportIcon, poiIcon, zoneIcon, spotIcon, meIcon, destIcon } from '../lib/mapIcons.js';
import Icon from '../components/Icon.jsx';
import TacticalMap from '../components/TacticalMap.jsx';
import { Countdown, Sheet } from '../components/ui.jsx';

function Tracker({ onMove, onPick }) {
  useMapEvents({
    move: (e) => onMove(e.target.getCenter()),
    click: (e) => onPick(e.latlng),
  });
  return null;
}

export default function MapPage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const mapRef = useRef(null);
  const prefs = user.prefs;

  const [reports, setReports] = useState([]);
  const [pois, setPois] = useState([]);
  const [meets, setMeets] = useState([]);
  const [me, setMe] = useState(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [selected, setSelected] = useState(null); // { kind, item }
  const [panel, setPanel] = useState(null); // 'report' | 'layers'
  const [placing, setPlacing] = useState(null); // tipo de reporte en colocación
  const [routeMode, setRouteMode] = useState(false);
  const [dest, setDest] = useState(null);
  const [route, setRoute] = useState(null);
  const [routing, setRouting] = useState(false);
  const [tilt, setTilt] = useState(false);

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
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading }),
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
    const from = me || center;
    setDest(to);
    setRouting(true);
    setSelected(null);
    try {
      const d = await api('/route/safe', { method: 'POST', body: { from, to } });
      setRoute(d);
      const pts = [...d.ghost.line, ...(d.fastest?.line || [])].map((p) => [p.lat, p.lng]);
      mapRef.current?.fitBounds(pts, { padding: [60, 60] });
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

  const clearRoute = () => { setRoute(null); setDest(null); };
  const hazardIds = new Set(route?.ghost.hazards.map((h) => h.id));

  return (
    <div className="screen full map-screen page-enter">
      <div className={`map-wrap ${tilt ? 'tilted' : ''}`}>
        <TacticalMap ref={mapRef} center={DEFAULT_CENTER} zoom={13}>
          <Tracker onMove={setCenter} onPick={onPick} />

          {prefs.layers.meets && meets.map((m) => (m.spot ? (
            <Marker key={m.id} position={[m.spot.lat, m.spot.lng]} icon={spotIcon(m.title)} eventHandlers={{ click: () => setSelected({ kind: 'meet', item: m }) }} />
          ) : (
            <Fragment key={m.id}>
              <Circle center={[m.zone.lat, m.zone.lng]} radius={m.zone.radius} pathOptions={{ className: 'zone-circle', color: '#ff2bd6', weight: 1.5, dashArray: '6 8', fillColor: '#ff2bd6', fillOpacity: 0.08 }} eventHandlers={{ click: () => setSelected({ kind: 'meet', item: m }) }} />
              <Marker position={[m.zone.lat, m.zone.lng]} icon={zoneIcon(m.title)} eventHandlers={{ click: () => setSelected({ kind: 'meet', item: m }) }} />
            </Fragment>
          )))}

          {visiblePois.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={poiIcon(p.type)} eventHandlers={{ click: () => setSelected({ kind: 'poi', item: p }) }} />
          ))}

          {visibleReports.map((r) => (
            <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r.type, r.fresh || hazardIds.has(r.id))} eventHandlers={{ click: () => setSelected({ kind: 'report', item: r }) }} />
          ))}

          {route?.fastest && (
            <Polyline positions={route.fastest.line.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#ff6a00', weight: 4, opacity: 0.55, dashArray: '2 10' }} />
          )}
          {route && (
            <>
              <Polyline positions={route.ghost.line.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#00f0ff', weight: 10, opacity: 0.18 }} />
              <Polyline positions={route.ghost.line.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#00f0ff', weight: 4, className: 'route-ghost' }} />
            </>
          )}
          {dest && <Marker position={[dest.lat, dest.lng]} icon={destIcon} />}
          {me && <Marker position={[me.lat, me.lng]} icon={meIcon} />}
        </TacticalMap>
      </div>

      {/* ---------- HUD ---------- */}
      <div className="map-hud-top">
        <div className="panel hud-frame map-coords">
          <div className="row between">
            <span className="label cyan">ctOS // VELOX</span>
            <span className="mono lime" style={{ fontSize: 11 }}><span className="dot-live" /> {visibleReports.length} ALERTAS</span>
          </div>
          <div className="mono" style={{ fontSize: 13 }}>{dms(center.lat, center.lng)}</div>
        </div>
        <div className="map-tools">
          <button className={`icon-btn ${panel === 'layers' ? 'on' : ''}`} onClick={() => setPanel('layers')} aria-label="Capas"><Icon name="layers" /></button>
          <button className={`icon-btn ${tilt ? 'on' : ''}`} onClick={() => setTilt((t) => !t)} aria-label="Vista 3D"><Icon name="cube" /></button>
          <button className="icon-btn" onClick={() => (me ? flyTo(me, 16) : toast('Sin GPS: activá la ubicación', 'err'))} aria-label="Mi ubicación"><Icon name="gps" /></button>
        </div>
      </div>
      <div className="map-scan" />
      {(placing || routeMode) && <div className="map-crosshair"><Icon name="crosshair" size={44} stroke={1.5} /></div>}

      {/* Barra de colocación de reporte */}
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
        <div className="map-bottom panel accent-cyan">
          <div className="label cyan">Ruta fantasma</div>
          <div className="mt-s">Tocá el destino en el mapa o elegí un lugar.</div>
          <div className="row mt-s">
            <button className="btn cyan sm" disabled={tilt} onClick={() => { setRouteMode(false); traceRoute(center); }}>Usar centro</button>
            <button className="btn ghost sm" onClick={() => setRouteMode(false)}><span>Cancelar</span></button>
          </div>
        </div>
      )}

      {route && !placing && !routeMode && (
        <div className="map-bottom panel accent-cyan route-card">
          <div className="row between">
            <div>
              <div className="label cyan">Ruta fantasma {route.ghost.avoided ? '· desvío inteligente' : ''}</div>
              <div className="h-display h-md">{mins(route.ghost.duration)} <span className="muted" style={{ fontSize: 18 }}>{km(route.ghost.distance)}</span></div>
            </div>
            <button className="icon-btn" onClick={clearRoute} aria-label="Cerrar ruta"><Icon name="close" /></button>
          </div>
          <div className="route-stats mono">
            <span className={route.ghost.hazards.length ? 'yellow' : 'lime'}>{route.ghost.hazards.length} alertas en ruta</span>
            {route.fastest && <span className="orange">rápida: {mins(route.fastest.duration)} · {route.fastest.hazards.length} alertas</span>}
            {route.saved > 0 && <span className="lime">esquivás {route.saved}</span>}
          </div>
          {route.ghost.hazards.length > 0 && (
            <div className="chips mt-s">
              {route.ghost.hazards.map((h) => <span key={h.id} className="badge" style={{ color: REPORT_TYPES[h.type].color }}>{REPORT_TYPES[h.type].label}</span>)}
            </div>
          )}
        </div>
      )}

      {!placing && !routeMode && !route && (
        <div className="map-actions">
          <button className="btn red" onClick={() => setPanel('report')}><Icon name="camera" size={20} /> Reportar</button>
          <button className="btn cyan" disabled={routing} onClick={() => setRouteMode(true)}><Icon name="route" size={20} /> {routing ? 'Calculando…' : 'Ruta fantasma'}</button>
        </div>
      )}

      {/* ---------- Sheets ---------- */}
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
            return <button key={k} className={`chip ${on ? 'on cyan' : ''}`} onClick={() => savePrefs({ poiTypes: on ? prefs.poiTypes.filter((x) => x !== k) : [...prefs.poiTypes, k] })}><span>{t.label}</span></button>;
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
              <button className="btn cyan block mt" onClick={() => traceRoute({ lat: p.lat, lng: p.lng })}><Icon name="route" size={20} /> Ruta fantasma hasta acá</button>
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
                {m.spot ? <span className="sticker lime">SPOT DESBLOQUEADO</span> : <span className="sticker magenta">ZONA CIFRADA</span>}
                <span className="badge muted">{dateLabel(m.startsAt)}</span>
              </div>
              <div className="mt-s mono">T-MENOS <Countdown to={m.startsAt} className="orange" /></div>
              {!m.spot && <p className="muted">La ubicación exacta está oculta. Solo aparece para los aprobados{m.revealAt ? ', y se revela poco antes de arrancar' : ''}.</p>}
              {m.spot && <p className="mono cyan">{m.spot.label}</p>}
              <div className="grid-2 mt">
                <button className="btn sm" onClick={() => nav(`/juntadas/${m.id}`)}>Ver juntada</button>
                {m.spot && <button className="btn cyan sm" onClick={() => traceRoute(m.spot)}>Ruta</button>}
              </div>
            </div>
          );
        })()}
      </Sheet>
    </div>
  );
}
