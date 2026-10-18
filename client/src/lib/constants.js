export const REPORT_TYPES = {
  camara: { label: 'Cámara', color: '#ff3b3b', icon: 'camera', hint: 'Fotomulta fija' },
  radar: { label: 'Radar móvil', color: '#ff2bd6', icon: 'radar', hint: 'Control de velocidad' },
  control: { label: 'Control', color: '#00a2ff', icon: 'shield', hint: 'Policía / alcoholemia' },
  bache: { label: 'Calle rota', color: '#ffd400', icon: 'pothole', hint: 'Bache / pozo' },
  accidente: { label: 'Accidente', color: '#ff6a00', icon: 'crash', hint: 'Choque en la vía' },
  obra: { label: 'Obra', color: '#c9ff00', icon: 'cone', hint: 'Corte / desvío' },
};

export const POI_TYPES = {
  taller: { label: 'Talleres', color: '#ff6a00', icon: 'wrench', letter: 'T' },
  tuning: { label: 'Tuning', color: '#ff2bd6', icon: 'bolt', letter: 'K' },
  lavadero: { label: 'Lavaderos', color: '#00f0ff', icon: 'drop', letter: 'L' },
  nafta: { label: 'Estaciones', color: '#c9ff00', icon: 'fuel', letter: 'E' },
  gomeria: { label: 'Gomerías', color: '#ffd400', icon: 'tire', letter: 'G' },
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
