import crypto from 'node:crypto';
import { hashPassword } from './auth.js';

// Datos ficticios alrededor de CABA para que la demo arranque con vida.
const HOUR = 3600_000;
const uid = (p) => `${p}_${crypto.randomBytes(6).toString('hex')}`;
const pass = () => crypto.randomBytes(3).toString('hex').toUpperCase();

export function seed() {
  const now = Date.now();
  const pw = hashPassword('velox');

  const car = (o) => ({ id: uid('car'), photo: null, plateVerified: false, mods: [], ...o });

  const users = [
    {
      id: 'u_ghost', handle: 'ghost', name: 'GHOST', crew: 'NOCTURNOS', color: '#e8621a',
      bio: 'Organizo. No pregunten dónde. // ex-trackday',
      rep: 820, points: 1340, badges: ['ORGANIZADOR', 'FUNDADOR', 'OJO DE HALCÓN'],
      interests: ['JDM', 'TUNING', 'DRIFT'],
      cars: [car({ make: 'Nissan', model: 'Skyline R34 GT-T', year: 1999, category: 'JDM', color: '#1b4fd6', body: 'coupe', photo: '/demo/r34.jpg', plate: 'AB123CD', plateVerified: true, hp: 380, mods: ['Turbo HKS', 'Coilovers', 'Escape full'] })],
    },
    {
      id: 'u_nyx', handle: 'nyx', name: 'NYX', crew: 'NOCTURNOS', color: '#6fa8c7',
      bio: 'Hackeo semáforos (mentira). Euro lover.', rep: 540, points: 610,
      badges: ['ORGANIZADORA', 'CAZACÁMARAS'], interests: ['EURO', 'STANCE'],
      cars: [car({ make: 'BMW', model: 'M3 E46', year: 2003, category: 'EURO', color: '#e0b41a', body: 'coupe', photo: '/demo/m3.jpg', plate: 'AC777XZ', plateVerified: true, hp: 343, mods: ['Llantas BBS', 'Stance'] })],
    },
    {
      id: 'u_vale', handle: 'turbo_vale', name: 'VALE TURBO', crew: 'SUR KINGS', color: '#c2417d',
      bio: 'Si suena a turbo, me interesa.', rep: 260, points: 300,
      badges: ['REPORTERA'], interests: ['JDM', 'DRIFT'],
      cars: [car({ make: 'Toyota', model: 'Supra MK4', year: 1997, category: 'JDM', color: '#b8141b', body: 'coupe', photo: '/demo/supra.jpg', plate: 'AD456EF', plateVerified: true, hp: 520 })],
    },
    {
      id: 'u_drift', handle: 'drift_kid', name: 'DRIFT KID', crew: null, color: '#a9c93a',
      bio: 'Recién arranco. Corolla con alma de AE86.', rep: 40, points: 55,
      badges: [], interests: ['DRIFT', 'JDM'],
      cars: [car({ make: 'Toyota', model: 'Corolla AE86', year: 1986, category: 'JDM', color: '#efefef', body: 'hatch', photo: '/demo/ae86.jpg', plate: 'RTA932', hp: 130 })],
    },
    {
      id: 'u_bruno', handle: 'v8bruno', name: 'BRUNO V8', crew: 'MUSCLE OESTE', color: '#d8372b',
      bio: 'Cilindrada no se reemplaza.', rep: 180, points: 220,
      badges: ['REPORTERO'], interests: ['MUSCLE', 'CLÁSICOS'],
      cars: [car({ make: 'Ford', model: 'Falcon Sprint', year: 1978, category: 'CLÁSICO', color: '#a3221b', body: 'classic', photo: '/demo/falcon.jpg', plate: 'XKC221', plateVerified: true, hp: 210 })],
    },
  ].map((u) => ({
    ...u,
    passwordHash: pw,
    avatar: null,
    following: [],
    prefs: {
      layers: { reports: true, pois: true, meets: true },
      reportTypes: ['camara', 'control', 'bache', 'accidente', 'obra', 'radar'],
      poiTypes: ['taller', 'lavadero', 'nafta', 'tuning', 'gomeria'],
      avoid: { camara: true, control: true, bache: true, radar: true, accidente: true, obra: false },
    },
    createdAt: now - 90 * 24 * HOUR,
  }));
  const by = Object.fromEntries(users.map((u) => [u.handle, u]));
  by.ghost.following = ['u_nyx', 'u_vale'];
  // Destinos guardados de ejemplo para la elección rápida en el mapa.
  by.ghost.prefs.places = [
    { id: 'casa', name: 'Casa', lat: -34.5876, lng: -58.4310 },
    { id: 'garage', name: 'Garage del crew', lat: -34.6115, lng: -58.3712 },
  ];
  by.turbo_vale.prefs.places = [{ id: 'casa', name: 'Casa', lat: -34.6290, lng: -58.4010 }];
  by.nyx.following = ['u_ghost'];
  by.turbo_vale.following = ['u_ghost', 'u_nyx', 'u_drift'];
  by.drift_kid.following = ['u_ghost', 'u_vale'];
  by.v8bruno.following = ['u_ghost'];

  const art = (palette, carName, kicker) => ({ kind: 'art', palette, car: carName, kicker });
  const VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';
  const post = (userId, hoursAgo, o) => ({
    id: uid('p'), userId, type: 'post', tags: [], likes: [], comments: [], place: null,
    createdAt: now - hoursAgo * HOUR, ...o,
  });

  const posts = [
    post('u_ghost', 2, { text: 'El R34 volvió del taller. 380hp limpios. La próxima juntada se viene pesada 👻', tags: ['JDM', 'TUNING'], media: { kind: 'image', url: '/demo/r34.jpg' }, likes: ['u_nyx', 'u_vale', 'u_drift'], comments: [{ id: uid('c'), userId: 'u_vale', text: 'Esa bestia 🔥', at: now - HOUR }] }),
    post('u_nyx', 5, { text: 'Cámara nueva en Libertador y Pampa. Ya está en el mapa. De nada.', tags: ['AVISO'], media: art('ctos', 'CTOS // ALERTA', 'CÁMARA NUEVA'), likes: ['u_ghost', 'u_bruno'] }),
    post('u_vale', 9, { type: 'reel', text: 'Pull de 2da a 4ta 🚀', tags: ['JDM', 'DRIFT'], media: { kind: 'video', url: `${VIDEO}/ForBiggerJoyrides.mp4`, fallback: art('neon', 'SUPRA MK4', '2JZ') }, likes: ['u_ghost', 'u_drift'] }),
    post('u_bruno', 14, { text: 'Domingo de lavado. El Falcon brilla más que mi futuro.', tags: ['CLÁSICOS'], media: { kind: 'image', url: '/demo/falcon.jpg' }, place: 'Lavadero Espuma Negra', likes: ['u_ghost'] }),
    post('u_drift', 20, { type: 'reel', text: 'Primer intento de drift (en playón cerrado, tranqui)', tags: ['DRIFT'], media: { kind: 'video', url: `${VIDEO}/ForBiggerEscapes.mp4`, fallback: art('toxic', 'AE86', 'FIRST SLIDE') }, likes: ['u_vale'] }),
    post('u_nyx', 30, { type: 'reel', text: 'Stance check. Cero roce.', tags: ['EURO', 'STANCE'], media: { kind: 'video', url: `${VIDEO}/ForBiggerBlazes.mp4`, fallback: art('ctos', 'M3 E46', 'STANCE') }, likes: ['u_ghost'] }),
    post('u_ghost', 48, { text: 'Recordatorio: en las juntadas no se queman gomas en zona urbana. El que rompe la regla queda afuera del sistema.', tags: ['REGLAS'], media: art('graffiti', 'NO RULES = NO MEETS', 'MANIFIESTO'), likes: ['u_nyx', 'u_vale', 'u_bruno', 'u_drift'] }),
    post('u_vale', 70, { type: 'reel', text: 'Ruta de noche. Sin cámaras gracias al modo predictivo 😎', tags: ['RUTA'], media: { kind: 'video', url: `${VIDEO}/ForBiggerFun.mp4`, fallback: art('neon', 'NIGHT RUN', 'GHOST ROUTE') } }),
  ];

  const poi = (type, name, lat, lng, extra = {}) => ({ id: uid('poi'), type, name, lat, lng, rating: 4 + Math.round(Math.random() * 10) / 10, open24: false, ...extra });
  const pois = [
    poi('taller', 'Taller Boxer Garage', -34.5895, -58.4270, { tags: ['JDM', 'turbo'] }),
    poi('taller', 'Mecánica El Turco', -34.6205, -58.4410),
    poi('taller', 'Racing Lab Saavedra', -34.5530, -58.4860, { tags: ['dyno'] }),
    poi('taller', 'Motor Sur', -34.6400, -58.3800),
    poi('tuning', 'Neon Kustoms', -34.6010, -58.4520, { tags: ['wrap', 'luces'] }),
    poi('tuning', 'Stance Factory', -34.5770, -58.4380, { tags: ['suspensión'] }),
    poi('tuning', 'Carbon Works', -34.6120, -58.3990),
    poi('lavadero', 'Lavadero Espuma Negra', -34.5980, -58.4120, { open24: true }),
    poi('lavadero', 'Detail King', -34.5700, -58.4600),
    poi('lavadero', 'Shine Box', -34.6290, -58.4170),
    poi('nafta', 'Estación Ruta 0', -34.5850, -58.3960, { open24: true }),
    poi('nafta', 'Servicentro Libertador', -34.5650, -58.4450, { open24: true }),
    poi('nafta', 'Estación Puerto', -34.6150, -58.3650, { open24: true }),
    poi('nafta', 'Estación Gral. Paz', -34.5480, -58.4950),
    poi('nafta', 'Estación Boedo', -34.6300, -58.4180),
    poi('gomeria', 'Gomería 24h El Rulo', -34.6060, -58.4320, { open24: true }),
    poi('gomeria', 'Gomería Chacarita', -34.5880, -58.4530),
  ];

  const rep = (type, lat, lng, hoursAgo, userId, extra = {}) => ({
    id: uid('r'), type, lat, lng, userId, note: '', confirms: [], denies: [],
    createdAt: now - hoursAgo * HOUR,
    expiresAt: ['camara', 'radar_fijo'].includes(type) ? null : now + (type === 'control' ? 3 : 48) * HOUR,
    ...extra,
  });
  const reports = [
    rep('camara', -34.5652, -58.4512, 5, 'u_nyx', { note: 'Fotomulta Libertador y Pampa' }),
    rep('camara', -34.6037, -58.3816, 200, 'u_ghost', { note: '9 de Julio y Corrientes' }),
    rep('camara', -34.5881, -58.4043, 120, 'u_vale'),
    rep('camara', -34.6090, -58.4050, 80, 'u_bruno'),
    rep('camara', -34.5745, -58.4210, 60, 'u_ghost'),
    rep('camara', -34.6175, -58.3860, 40, 'u_nyx'),
    rep('radar', -34.5550, -58.4720, 10, 'u_ghost', { note: 'Radar móvil Gral. Paz' }),
    rep('radar', -34.5960, -58.3720, 3, 'u_vale'),
    rep('control', -34.5800, -58.4300, 1, 'u_vale', { note: 'Control de alcoholemia', confirms: ['u_ghost'] }),
    rep('control', -34.6130, -58.4280, 0.5, 'u_bruno'),
    rep('control', -34.5930, -58.3920, 1.5, 'u_drift'),
    rep('bache', -34.6000, -58.4180, 30, 'u_drift', { note: 'Pozo enorme carril derecho' }),
    rep('bache', -34.6210, -58.4050, 22, 'u_bruno'),
    rep('bache', -34.5850, -58.4390, 12, 'u_vale'),
    rep('bache', -34.6080, -58.3950, 6, 'u_ghost'),
    rep('obra', -34.5920, -58.4110, 18, 'u_nyx', { note: 'Corte parcial' }),
    rep('accidente', -34.6020, -58.4410, 0.7, 'u_ghost', { note: 'Choque, carril izq.' }),
  ];

  const tomorrow = new Date(now + 24 * HOUR);
  tomorrow.setHours(23, 30, 0, 0);
  const saturday = new Date(now + 3 * 24 * HOUR);
  saturday.setHours(22, 0, 0, 0);
  const sunday = new Date(now + 5 * 24 * HOUR);
  sunday.setHours(9, 0, 0, 0);

  const att = (userId, status, carId, extra = {}) => ({ userId, status, carId, message: '', via: 'apply', at: now - 3 * HOUR, passCode: pass(), checkedIn: false, ...extra });
  const meets = [
    {
      id: 'm_midnight', title: 'MIDNIGHT // DÁRSENA', organizerId: 'u_ghost', coOrganizers: ['u_nyx'],
      desc: 'Juntada nocturna. Spot nuevo, amplio, sin vecinos. Llegada escalonada, cero quemes, cero música fuerte. El que no respeta, queda baneado del sistema.',
      spot: { lat: -34.6080, lng: -58.3610, label: 'Playón Dársena Sur' },
      startsAt: tomorrow.getTime(), capacity: 25, visibility: 'underground',
      revealMode: 'hoursBefore', revealHoursBefore: 2, revealedManually: false,
      tags: ['JDM', 'EURO', 'NOCTURNA', 'SIN QUEMES'],
      rules: { autoApprove: true, minRep: 100, requireVerifiedCar: true, categories: ['JDM', 'EURO', 'TUNING'], strict: false, waitlist: true, trustedCrews: ['NOCTURNOS'] },
      codes: [{ code: 'GHOST-2077', uses: 2, maxUses: 10, autoApprove: true, createdAt: now - 10 * HOUR }],
      attendees: [
        att('u_nyx', 'approved', by.nyx.cars[0].id, { via: 'crew' }),
        att('u_vale', 'approved', by.turbo_vale.cars[0].id, { via: 'code' }),
        att('u_drift', 'pending', by.drift_kid.cars[0].id, { message: 'Primera juntada, prometo portarme bien 🙏' }),
      ],
      banned: [], broadcasts: [{ at: now - 2 * HOUR, text: 'Llegada escalonada: grupo A 23:30, grupo B 23:50. Luces bajas al entrar.' }],
      log: [], status: 'active', createdAt: now - 12 * HOUR,
    },
    {
      id: 'm_costanera', title: 'OPERACIÓN COSTANERA', organizerId: 'u_nyx', coOrganizers: [],
      desc: 'Solo por invitación. Si estás leyendo esto, alguien confió en vos. Euro & stance.',
      spot: { lat: -34.5560, lng: -58.4010, label: 'Costanera Norte — playón 3' },
      startsAt: saturday.getTime(), capacity: 12, visibility: 'ghost',
      revealMode: 'approved', revealHoursBefore: 0, revealedManually: false,
      tags: ['EURO', 'STANCE', 'INVITACIÓN'],
      rules: { autoApprove: false, minRep: 200, requireVerifiedCar: true, categories: ['EURO'], strict: true, waitlist: false, trustedCrews: [] },
      codes: [{ code: 'NYX-0451', uses: 1, maxUses: 5, autoApprove: false, createdAt: now - 20 * HOUR }],
      attendees: [att('u_ghost', 'approved', by.ghost.cars[0].id, { via: 'code' })],
      banned: [], broadcasts: [], log: [], status: 'active', createdAt: now - 24 * HOUR,
    },
    {
      id: 'm_sunday', title: 'JDM SUNDAY // DESAYUNO', organizerId: 'u_vale', coOrganizers: [],
      desc: 'Desayuno tranqui, fotos y charla. Ideal para los que recién arrancan.',
      spot: { lat: -34.5710, lng: -58.4190, label: 'Bosques de Palermo' },
      startsAt: sunday.getTime(), capacity: 40, visibility: 'underground',
      revealMode: 'approved', revealHoursBefore: 0, revealedManually: false,
      tags: ['JDM', 'DÍA', 'NOVATOS OK'],
      rules: { autoApprove: true, minRep: 0, requireVerifiedCar: false, categories: [], strict: false, waitlist: true, trustedCrews: [] },
      codes: [], attendees: [att('u_ghost', 'approved', by.ghost.cars[0].id)],
      banned: [], broadcasts: [], log: [], status: 'active', createdAt: now - 30 * HOUR,
    },
  ];
  for (const m of meets) m.log.push({ at: m.createdAt, kind: 'sys', text: 'Evento creado. Canal cifrado abierto.' });

  return { users, posts, pois, reports, meets, notifications: [] };
}
