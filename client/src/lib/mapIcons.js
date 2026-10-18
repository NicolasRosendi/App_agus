import L from 'leaflet';
import { ICON_PATHS } from '../components/Icon.jsx';
import { REPORT_TYPES, POI_TYPES } from './constants.js';

const svg = (name, size = 16, color = 'currentColor') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="square"><path d="${ICON_PATHS[name]}"/></svg>`;

const cache = new Map();
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export const reportIcon = (type, fresh = false) => memo(`r:${type}:${fresh}`, () => {
  const t = REPORT_TYPES[type];
  return L.divIcon({
    className: '',
    html: `<div class="mk-report ${fresh ? 'fresh' : ''}" style="--c:${t.color}">${svg(t.icon, 16, '#000')}</div>`,
    iconSize: [30, 34],
    iconAnchor: [15, 34],
  });
});

export const poiIcon = (type) => memo(`p:${type}`, () => {
  const t = POI_TYPES[type];
  return L.divIcon({
    className: '',
    html: `<div class="mk-poi" style="--c:${t.color}">${svg(t.icon, 14)}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
});

export const zoneIcon = (title) => L.divIcon({
  className: '',
  html: `<div class="mk-zone"><span>◆ SEÑAL CIFRADA</span><b>${title.replace(/[<>&]/g, '')}</b></div>`,
  iconSize: [160, 40],
  iconAnchor: [80, 20],
});

export const spotIcon = (title) => L.divIcon({
  className: '',
  html: `<div class="mk-spot"><div class="mk-spot-ring"></div><div class="mk-spot-core">${svg('pin', 18, '#000')}</div><b>${title.replace(/[<>&]/g, '')}</b></div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

export const meIcon = memo('me', () => L.divIcon({
  className: '',
  html: '<div class="mk-me"><div class="mk-me-pulse"></div><svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 2l8 20-8-5-8 5z" fill="#00f0ff" stroke="#000" stroke-width="1.5"/></svg></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
}));

export const destIcon = memo('dest', () => L.divIcon({
  className: '',
  html: `<div class="mk-dest">${svg('target', 22, '#ff6a00')}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
}));
