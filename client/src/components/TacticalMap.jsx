import { forwardRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER } from '../lib/constants.js';

// Base oscura (CARTO) + filtro de color para el look ctOS/GTA.
const TacticalMap = forwardRef(function TacticalMap({ center = DEFAULT_CENTER, zoom = 13, children, className = '', interactive = true }, ref) {
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
      className={`tactical-map ${className}`}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      {children}
    </MapContainer>
  );
});

export default TacticalMap;
