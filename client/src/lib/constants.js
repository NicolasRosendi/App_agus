export const REPORT_TYPES = {
  camara: { label: 'Cámara', color: '#e0392b', icon: 'camera', hint: 'Fotomulta fija' },
  radar: { label: 'Radar móvil', color: '#d8579a', icon: 'radar', hint: 'Control de velocidad' },
  control: { label: 'Control', color: '#3b82d6', icon: 'shield', hint: 'Policía / alcoholemia' },
  bache: { label: 'Calle rota', color: '#f2c230', icon: 'pothole', hint: 'Bache / pozo' },
  accidente: { label: 'Accidente', color: '#e8621a', icon: 'crash', hint: 'Choque en la vía' },
  obra: { label: 'Obra', color: '#f08a24', icon: 'cone', hint: 'Corte / desvío' },
};

export const POI_TYPES = {
  taller: { label: 'Talleres', color: '#e8621a', icon: 'wrench', letter: 'T' },
  tuning: { label: 'Tuning', color: '#c2417d', icon: 'bolt', letter: 'K' },
  lavadero: { label: 'Lavaderos', color: '#3b9fd6', icon: 'drop', letter: 'L' },
  nafta: { label: 'Estaciones', color: '#3fa34d', icon: 'fuel', letter: 'E' },
  gomeria: { label: 'Gomerías', color: '#d9a21b', icon: 'tire', letter: 'G' },
};

export const CATEGORIES = ['JDM', 'EURO', 'MUSCLE', 'TUNING', 'CLÁSICO', 'STANCE', 'DRIFT', '4X4', 'OTRO'];

export const DEFAULT_CENTER = { lat: -34.5960, lng: -58.4200 };

export const STATUS_LABEL = {
  approved: { text: 'ACCESO CONCEDIDO', color: 'var(--lime)' },
  pending: { text: 'EN VALIDACIÓN', color: 'var(--yellow)' },
  waitlist: { text: 'LISTA DE ESPERA', color: 'var(--cyan)' },
  rejected: { text: 'ACCESO DENEGADO', color: 'var(--red)' },
  kicked: { text: 'REMOVIDO', color: 'var(--red)' },
  left: { text: 'TE BAJASTE', color: 'var(--muted)' },
};

export const MEET_STATUS = { active: 'ACTIVA', locked: 'CERRADA', live: 'EN VIVO', ended: 'FINALIZADA', cancelled: 'CANCELADA' };
