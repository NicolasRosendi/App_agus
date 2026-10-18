// Abre la navegación en la app de mapas del teléfono con los links oficiales de cada
// servicio (no requieren API key). En iPhone el primero es Apple Maps; en el resto, Google.
const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function nativeMapLinks(dest, origin) {
  const d = `${dest.lat},${dest.lng}`;
  const google = {
    id: 'google',
    label: 'Google Maps',
    url: `https://www.google.com/maps/dir/?api=1&destination=${d}${origin ? `&origin=${origin.lat},${origin.lng}` : ''}&travelmode=driving`,
  };
  const apple = { id: 'apple', label: 'Apple Maps', url: `https://maps.apple.com/?daddr=${d}&dirflg=d${origin ? `&saddr=${origin.lat},${origin.lng}` : ''}` };
  const waze = { id: 'waze', label: 'Waze', url: `https://waze.com/ul?ll=${d}&navigate=yes` };
  return isIOS() ? [apple, google, waze] : [google, waze, apple];
}
