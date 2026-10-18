// Constructor de autos 3D procedurales (three.js puro, sin React).
// Lo usan el mapa (auto del jugador), el garage, el login y el generador de fotos demo.
// "Recrear el auto de la foto" = carrocería según marca/modelo/categoría + color sacado de la foto.
import * as THREE from 'three';

// Silueta lateral (x: largo, y: alto) y vidrios. Se extruyen a lo ancho.
export const BODIES = {
  coupe: {
    label: 'Coupé',
    profile: [[-2.2, 0.32], [-2.24, 0.78], [-1.95, 0.92], [-1.25, 0.98], [-0.65, 1.34], [0.45, 1.38], [1.15, 0.98], [2.05, 0.82], [2.26, 0.58], [2.2, 0.32]],
    glass: [[-1.12, 1.0], [-0.62, 1.3], [0.42, 1.33], [1.08, 1.0]],
    width: 1.74, wheelR: 0.36, axle: [-1.42, 1.38], wing: true,
  },
  sedan: {
    label: 'Sedán',
    profile: [[-2.3, 0.34], [-2.32, 0.84], [-1.75, 0.94], [-1.3, 0.99], [-0.85, 1.4], [0.5, 1.43], [1.12, 1.0], [2.1, 0.86], [2.3, 0.62], [2.25, 0.34]],
    glass: [[-1.22, 1.01], [-0.8, 1.36], [0.46, 1.39], [1.04, 1.02]],
    width: 1.76, wheelR: 0.36, axle: [-1.45, 1.42],
  },
  hatch: {
    label: 'Hatchback',
    profile: [[-1.95, 0.34], [-2.0, 0.94], [-1.78, 1.36], [0.32, 1.42], [1.02, 0.98], [1.9, 0.84], [2.05, 0.6], [2.0, 0.34]],
    glass: [[-1.74, 1.0], [-1.6, 1.32], [0.28, 1.37], [0.95, 1.0]],
    width: 1.7, wheelR: 0.34, axle: [-1.25, 1.3],
  },
  muscle: {
    label: 'Muscle',
    profile: [[-2.35, 0.34], [-2.38, 0.88], [-2.1, 0.97], [-1.55, 1.0], [-0.95, 1.3], [0.15, 1.34], [0.72, 1.0], [2.2, 0.9], [2.38, 0.66], [2.35, 0.34]],
    glass: [[-1.48, 1.02], [-0.92, 1.27], [0.12, 1.3], [0.66, 1.02]],
    width: 1.86, wheelR: 0.39, axle: [-1.5, 1.5], scoop: true, ducktail: true,
  },
  classic: {
    label: 'Clásico',
    profile: [[-2.3, 0.38], [-2.32, 0.9], [-1.4, 0.97], [-1.05, 1.4], [0.55, 1.43], [0.92, 1.0], [2.25, 0.94], [2.32, 0.7], [2.3, 0.38]],
    glass: [[-1.33, 0.99], [-1.02, 1.36], [0.52, 1.39], [0.86, 1.0]],
    width: 1.8, wheelR: 0.35, axle: [-1.5, 1.45], chrome: true,
  },
  suv: {
    label: 'SUV / 4x4',
    profile: [[-2.25, 0.5], [-2.28, 1.25], [-2.15, 1.78], [0.6, 1.82], [1.25, 1.22], [2.15, 1.08], [2.3, 0.8], [2.25, 0.5]],
    glass: [[-2.12, 1.3], [-2.04, 1.74], [0.56, 1.77], [1.15, 1.26]],
    width: 1.9, wheelR: 0.44, axle: [-1.45, 1.45], roofRack: true,
  },
};

const MATCHERS = [
  [/skyline|gt-?r|supra|silvia|s1[345]|180sx|rx-?[78]|350z|370z|nsx|brz|gt86|86\b|celica|eclipse|integra|prelude|m3|m4|tt|z4|porsche|911|cayman|scirocco|cupra/i, 'coupe'],
  [/ae86|trueno|levin|golf|gti|polo|206|207|208|clio|gol\b|civic|fiesta|focus|swift|yaris|mini|punto|uno|corsa|208|306|megane|ibiza|leon/i, 'hatch'],
  [/mustang|camaro|challenger|charger|corvette|chevelle|gto|torino|cuda|firebird/i, 'muscle'],
  [/falcon|torino|dodge 1500|chevy|fairlane|valiant|rambler|bel ?air|impala|fiat 125|peugeot 504|404/i, 'classic'],
  [/hilux|ranger|amarok|s10|wrangler|jeep|4x4|land ?cruiser|patrol|pajero|tracker|ecosport|duster|suv|raptor|bronco/i, 'suv'],
];
const BY_CATEGORY = { JDM: 'coupe', EURO: 'coupe', MUSCLE: 'muscle', 'CLÁSICO': 'classic', '4X4': 'suv', STANCE: 'sedan', DRIFT: 'coupe', TUNING: 'hatch', OTRO: 'sedan' };

export function bodyFor(car) {
  if (!car) return 'coupe';
  if (car.body && BODIES[car.body]) return car.body;
  const text = `${car.make || ''} ${car.model || ''}`;
  const hit = MATCHERS.find(([re]) => re.test(text));
  return hit ? hit[1] : BY_CATEGORY[car.category] || 'sedan';
}

function extrude(points, depth, bevel) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/**
 * Arma el auto. Frente hacia +X, ruedas apoyadas en y=0, centrado en x/z.
 * @returns {{ group: THREE.Group, wheels: THREE.Object3D[], materials: THREE.Material[], dispose: () => void }}
 */
export function buildCar({ body = 'coupe', color = '#d8461b', lightsOn = true } = {}) {
  const spec = BODIES[body] || BODIES.coupe;
  const group = new THREE.Group();
  const geometries = [];
  const materials = [];
  const geo = (g) => { geometries.push(g); return g; };
  const mat = (m) => { materials.push(m); return m; };
  const add = (g, m, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  const W = spec.width;
  const paint = mat(new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 }));
  const glass = mat(new THREE.MeshPhysicalMaterial({ color: '#0b0d10', metalness: 0.9, roughness: 0.08 }));
  const trim = mat(new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.6, metalness: 0.3 }));
  const chrome = mat(new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 1, roughness: spec.chrome ? 0.12 : 0.28 }));
  const tire = mat(new THREE.MeshStandardMaterial({ color: '#0c0c0c', roughness: 0.95 }));
  const head = mat(new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4d0', emissiveIntensity: lightsOn ? 2.2 : 0.2 }));
  const tail = mat(new THREE.MeshStandardMaterial({ color: '#8a0b0b', emissive: '#ff1d1d', emissiveIntensity: lightsOn ? 1.6 : 0.3 }));

  add(geo(extrude(spec.profile, W - 0.1, 0.06)), paint);
  add(geo(extrude(spec.glass, W - 0.04, 0.02)), glass);

  const xs = spec.profile.map((p) => p[0]);
  const front = Math.max(...xs) + 0.06; // + bisel de la extrusión
  const rear = Math.min(...xs) - 0.06;
  const ride = spec.profile[0][1];

  // Paragolpes, zócalos y espejos
  add(geo(box(0.1, 0.12, W * 0.9)), trim, [front - 0.01, ride + 0.03, 0]);
  add(geo(box(0.1, 0.12, W * 0.9)), trim, [rear + 0.01, ride + 0.05, 0]);
  add(geo(box(0.05, 0.11, W * 0.34)), trim, [front + 0.02, ride + 0.24, 0]);
  add(geo(box(Math.abs(spec.axle[1] - spec.axle[0]) - spec.wheelR * 2.3, 0.1, W + 0.02)), trim, [(spec.axle[0] + spec.axle[1]) / 2, ride + 0.02, 0]);
  const mirrorX = spec.glass[3][0] - 0.05;
  for (const s of [-1, 1]) add(geo(box(0.16, 0.1, 0.12)), paint, [mirrorX, spec.glass[3][1] + 0.05, s * (W / 2 + 0.06)]);

  // Ópticas
  for (const s of [-1, 1]) {
    add(geo(box(0.06, 0.1, 0.38)), head, [front + 0.01, ride + 0.32, s * (W / 2 - 0.3)]);
    add(geo(box(0.06, 0.1, 0.42)), tail, [rear - 0.01, ride + 0.4, s * (W / 2 - 0.3)]);
  }
  if (spec.chrome) add(geo(box(0.04, 0.16, W * 0.5)), chrome, [front + 0.02, ride + 0.3, 0]);

  // Extras por carrocería
  if (spec.wing) {
    add(geo(box(0.34, 0.04, W - 0.05)), trim, [rear + 0.22, spec.profile[2][1] + 0.26, 0]);
    for (const s of [-1, 1]) add(geo(box(0.05, 0.24, 0.05)), trim, [rear + 0.25, spec.profile[2][1] + 0.12, s * (W / 2 - 0.35)]);
  }
  if (spec.ducktail) add(geo(box(0.3, 0.06, W - 0.15)), paint, [rear + 0.2, spec.profile[2][1] + 0.04, 0], [0, 0, 0.18]);
  if (spec.scoop) add(geo(box(0.6, 0.1, 0.5)), trim, [1.3, 0.97, 0]);
  if (spec.roofRack) for (const s of [-1, 1]) add(geo(box(2.2, 0.05, 0.05)), trim, [-0.8, 1.86, s * 0.6]);

  // Ruedas
  const wheels = [];
  const tireGeo = geo(new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, 0.28, 28));
  const rimGeo = geo(new THREE.CylinderGeometry(spec.wheelR * 0.68, spec.wheelR * 0.68, 0.29, 24));
  const spokeGeo = geo(box(0.05, spec.wheelR * 1.25, 0.02));
  for (const x of spec.axle) {
    for (const s of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, spec.wheelR, s * (W / 2 - 0.1));
      const t = new THREE.Mesh(tireGeo, tire);
      t.rotation.x = Math.PI / 2;
      const r = new THREE.Mesh(rimGeo, chrome);
      r.rotation.x = Math.PI / 2;
      wheel.add(t, r);
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(spokeGeo, trim);
        sp.position.z = s * 0.15;
        sp.rotation.z = (i * Math.PI * 2) / 5;
        wheel.add(sp);
      }
      group.add(wheel);
      wheels.push(wheel);
    }
  }

  return {
    group,
    wheels,
    materials,
    length: front - rear,
    dispose: () => { geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); },
  };
}
