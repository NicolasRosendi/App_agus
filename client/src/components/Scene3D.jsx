import { Component, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCar } from '../lib/car3d.js';

const SCAN_TIME = 1.8;

// Reflejos para la pintura y las llantas (sin esto el metal se ve negro).
export function Environment({ intensity = 0.45 }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => { env.dispose(); pm.dispose(); };
  }, [gl, scene, intensity]);
  return null;
}

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

const speckle = (g, w, h, base, n) => {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = 30 + Math.random() * 45;
    g.fillStyle = `rgba(${v},${v},${v + 3},.5)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
};

/**
 * Auto + animación de "reconstrucción": un plano de escaneo recorre el auto,
 * detrás queda la pintura y adelante todavía el wireframe.
 */
export function CarModel({ body, color, spin = false, scan = false }) {
  const built = useMemo(() => buildCar({ body, color }), [body, color]);
  const wire = useMemo(() => {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: '#f2a03d', wireframe: true, transparent: true, opacity: 0.55 });
    built.group.updateMatrixWorld(true);
    built.group.traverse((o) => {
      if (!o.isMesh) return;
      const w = new THREE.Mesh(o.geometry, m);
      w.applyMatrix4(o.matrixWorld);
      g.add(w);
    });
    return { g, m };
  }, [built]);
  const planes = useMemo(() => ({ solid: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 99), wire: new THREE.Plane(new THREE.Vector3(1, 0, 0), -99) }), []);
  const bar = useRef();
  const t0 = useRef(null);

  useEffect(() => {
    built.materials.forEach((m) => { m.clippingPlanes = [planes.solid]; });
    wire.m.clippingPlanes = [planes.wire];
    t0.current = scan ? null : -1;
  }, [built, wire, planes, scan]);
  useEffect(() => () => { built.dispose(); wire.m.dispose(); }, [built, wire]);

  useFrame(({ clock }, dt) => {
    if (spin) built.wheels.forEach((w) => { w.rotation.z -= dt * 16; });
    if (t0.current === null) t0.current = clock.elapsedTime;
    const p = t0.current < 0 ? 1 : Math.min(1, (clock.elapsedTime - t0.current) / SCAN_TIME);
    const x = -2.6 + p * 5.4; // de atrás hacia adelante
    planes.solid.constant = p >= 1 ? 99 : x;
    planes.wire.constant = p >= 1 ? -99 : -x;
    if (bar.current) {
      bar.current.visible = p < 1;
      bar.current.position.x = x;
    }
  });

  return (
    <group>
      <primitive object={built.group} />
      <primitive object={wire.g} />
      <mesh ref={bar} visible={false} position={[0, 0.9, 0]}>
        <boxGeometry args={[0.03, 2.2, 2.4]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// ---------------- Garage: cemento, ladrillo y graffiti ----------------
function GarageSet() {
  const floor = useMemo(() => canvasTexture(1024, 1024, (g, w, h) => {
    speckle(g, w, h, '#3a3b3e', 60000);
    for (let i = 0; i < 10; i++) {
      g.fillStyle = `rgba(12,12,14,${0.12 + Math.random() * 0.2})`;
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 90, 25 + Math.random() * 50, Math.random() * 3, 0, 7);
      g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 3;
    for (let x = 0; x < w; x += 256) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, [3, 3]), []);
  const wall = useMemo(() => canvasTexture(2048, 640, (g, w, h) => {
    g.fillStyle = '#2b2422';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 40) {
      for (let x = (y / 40) % 2 ? -40 : 0; x < w; x += 80) {
        const v = 70 + Math.random() * 30;
        g.fillStyle = `rgb(${v},${v * 0.62},${v * 0.5})`;
        g.fillRect(x + 3, y + 3, 74, 34);
      }
    }
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(0, 0, w, h);
    // Tag
    g.save();
    g.translate(w * 0.24, h * 0.66);
    g.rotate(-0.07);
    g.font = '230px "Sedgwick Ave Display", "Permanent Marker", Impact, sans-serif';
    g.lineJoin = 'round';
    g.lineWidth = 26;
    g.strokeStyle = '#111';
    g.strokeText('Velox', 0, 0);
    g.fillStyle = '#e8691e';
    g.fillText('Velox', 0, 0);
    g.lineWidth = 6;
    g.strokeStyle = '#f4e3c3';
    g.strokeText('Velox', -4, -4);
    g.restore();
    g.fillStyle = 'rgba(232,105,30,.85)';
    for (let i = 0; i < 16; i++) g.fillRect(w * 0.26 + Math.random() * 900, h * 0.66, 4, 20 + Math.random() * 90);
    g.font = '64px "Permanent Marker", sans-serif';
    g.fillStyle = '#e9e1d0';
    g.fillText('CREW · CABA · 99', w * 0.64, h * 0.2);
  }), []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial map={floor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 4, -5.5]}>
        <planeGeometry args={[26, 8.1]} />
        <meshStandardMaterial map={wall} roughness={0.95} />
      </mesh>
      {/* Tubo fluorescente */}
      <mesh position={[0, 6, -1]}>
        <boxGeometry args={[3, 0.08, 0.12]} />
        <meshStandardMaterial color="#fff" emissive="#f1f4ff" emissiveIntensity={3} />
      </mesh>
      <spotLight position={[0, 7, 1]} angle={0.7} penumbra={0.8} intensity={120} color="#f4f1e8" castShadow />
      <pointLight position={[-4, 1.6, 3]} intensity={14} color="#ff8a3d" distance={12} />
      <directionalLight position={[5, 3, -4]} intensity={0.9} color="#9db7ff" />
      <ambientLight intensity={0.25} />
    </>
  );
}

// ---------------- Login: calle de noche que pasa ----------------
function StreetSet() {
  const road = useMemo(() => canvasTexture(512, 512, (g, w, h) => {
    speckle(g, w, h, '#232428', 25000);
    g.fillStyle = '#d6c27a';
    g.fillRect(0, h / 2 - 5, w * 0.55, 10);
  }, [8, 1]), []);
  const windows = useMemo(() => canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#0d0f13';
    g.fillRect(0, 0, w, h);
    for (let x = 8; x < w; x += 26) {
      for (let y = 12; y < h; y += 30) {
        g.fillStyle = Math.random() < 0.25 ? (Math.random() < 0.6 ? '#e9c27d' : '#b9c7e0') : '#08090b';
        g.fillRect(x, y, 14, 18);
      }
    }
  }), []);
  const lamps = useRef();
  useFrame((_, dt) => {
    road.offset.x = (road.offset.x + dt * 1.6) % 1;
    lamps.current?.children.forEach((l) => {
      l.position.x -= dt * 26;
      if (l.position.x < -40) l.position.x += 80;
    });
  });
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 14]} />
        <meshStandardMaterial map={road} roughness={0.4} metalness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 6, s * 13]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[90, 12]} />
          <meshStandardMaterial map={windows} emissiveMap={windows} emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
      ))}
      <group ref={lamps}>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} position={[-40 + i * 14, 0, -6.5]}>
            <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.07, 0.09, 6]} /><meshStandardMaterial color="#25262a" /></mesh>
            <mesh position={[0, 6, 0.6]}><boxGeometry args={[0.5, 0.12, 0.3]} /><meshStandardMaterial color="#ffd9a0" emissive="#ffc777" emissiveIntensity={3} /></mesh>
            {i % 2 === 0 && <pointLight position={[0, 5.6, 1.5]} intensity={30} distance={14} color="#ffc777" />}
          </group>
        ))}
      </group>
      <hemisphereLight args={['#5d6f96', '#140f0b', 0.4]} />
      <spotLight position={[4, 6, 5]} angle={0.6} penumbra={0.7} intensity={70} color="#ffd2a1" castShadow />
    </>
  );
}

function Rig({ mode, dragRef }) {
  const target = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3());
  useFrame(({ camera, clock, pointer, size }) => {
    const t = clock.getElapsedTime();
    const aspect = size.width / size.height;
    // En pantallas verticales alejamos la cámara para que el auto entre completo.
    const fit = (mode === 'garage' ? 3.7 : 3.8) / (Math.tan((camera.fov * Math.PI) / 360) * Math.min(aspect, 1.6));
    const r = Math.min(18, Math.max(7.5, fit));
    const ang = mode === 'garage' ? 0.55 + Math.sin(t * 0.18) * 0.5 + (dragRef?.current || 0) : 0.75 + pointer.x * 0.3;
    target.current.set(0, mode === 'drive' && aspect < 1 ? -r * 0.11 : 0.6, 0);
    pos.current.set(Math.cos(ang) * r, (mode === 'garage' ? 2 : 1.6 + pointer.y * 0.5) + r * 0.07, Math.sin(ang) * r);
    camera.position.lerp(pos.current, 0.06);
    camera.lookAt(target.current);
  });
  return null;
}

export class GLBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (this.props.fallback ?? <div className="scene-fallback">// 3D no disponible en este equipo</div>) : this.props.children;
  }
}

/** mode: 'drive' (fondo del login) | 'garage' (turntable + reconstrucción) */
export default function Scene3D({ body = 'coupe', color = '#d8461b', mode = 'drive', scanKey, className = '' }) {
  const drag = useRef(0);
  const last = useRef(null);
  const handlers = mode === 'garage' ? {
    onPointerDown: (e) => { last.current = e.clientX; },
    onPointerMove: (e) => { if (last.current != null) { drag.current += (e.clientX - last.current) * 0.01; last.current = e.clientX; } },
    onPointerUp: () => { last.current = null; },
    onPointerLeave: () => { last.current = null; },
  } : {};
  const bg = mode === 'garage' ? '#17171a' : '#0a0c10';
  return (
    <div className={`scene3d ${className}`} {...handlers}>
      <GLBoundary>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ fov: 40, position: [8, 3, 8] }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
          onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        >
          <color attach="background" args={[bg]} />
          <fog attach="fog" args={[bg, 12, 36]} />
          <Environment />
          <CarModel key={scanKey} body={body} color={color} spin={mode === 'drive'} scan={mode === 'garage'} />
          {mode === 'garage' ? <GarageSet /> : <StreetSet />}
          <Rig mode={mode} dragRef={drag} />
        </Canvas>
      </GLBoundary>
    </div>
  );
}
