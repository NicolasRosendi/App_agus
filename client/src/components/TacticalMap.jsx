import { forwardRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER } from '../lib/constants.js';

// Bases de CARTO: "calle" es la legible tipo Maps; "noche" es oscura pero con calles visibles.
export const MAP_STYLES = {
  calle: { label: 'Calle', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
  noche: { label: 'Noche', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
};

const TacticalMap = forwardRef(function TacticalMap({ center = DEFAULT_CENTER, zoom = 13, children, className = '', interactive = true, mapStyle = 'calle' }, ref) {
  const style = MAP_STYLES[mapStyle] || MAP_STYLES.calle;
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
      <TileLayer
        key={mapStyle}
        url={style.url}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />
      {children}
    </MapContainer>
  );
});

export default TacticalMap;
