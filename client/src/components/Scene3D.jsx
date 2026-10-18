import { Component, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Silueta lateral del auto (x: largo, y: alto). Se extruye a lo ancho.
const BODY = [[-2.2, 0.35], [-2.22, 0.82], [-1.9, 0.95], [-1.2, 1.0], [-0.7, 1.42], [0.55, 1.46], [1.2, 1.0], [2.05, 0.86], [2.26, 0.62], [2.2, 0.35]];
const GLASS = [[-1.08, 1.02], [-0.66, 1.38], [0.52, 1.41], [1.08, 1.02]];

function extrude(points, depth, bevel = 0.06) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function Wheel({ position, spin }) {
  const ref = useRef();
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.z -= dt * 14; });
  return (
    <group position={position} ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.32, 20]} />
        <meshStandardMaterial color="#060606" roughness={0.9} />
      </mesh>
      <mesh rotation={[0, 0, 0]} position={[0, 0, position[2] > 0 ? 0.165 : -0.165]}>
        <torusGeometry args={[0.24, 0.035, 8, 24]} />
        <meshStandardMaterial color="#cfd6de" emissive="#00f0ff" emissiveIntensity={0.6} metalness={1} roughness={0.25} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 5]} position={[0, 0, position[2] > 0 ? 0.165 : -0.165]}>
          <boxGeometry args={[0.04, 0.42, 0.02]} />
          <meshStandardMaterial color="#9aa3ad" metalness={1} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Car({ color, drive }) {
  const body = useMemo(() => extrude(BODY, 1.7), []);
  const glass = useMemo(() => extrude(GLASS, 1.74, 0.02), []);
  const group = useRef();
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    // Vibración de motor + leve "nose dive"
    group.current.position.y = drive ? Math.sin(t * 40) * 0.008 : 0;
    group.current.rotation.z = drive ? Math.sin(t * 1.3) * 0.01 : 0;
  });
  return (
    <group ref={group}>
      <mesh geometry={body} castShadow>
        <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.28} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh geometry={glass}>
        <meshPhysicalMaterial color="#05070a" metalness={0.9} roughness={0.05} />
      </mesh>
      {/* Spoiler */}
      <mesh position={[-2.0, 1.22, 0]}>
        <boxGeometry args={[0.38, 0.05, 1.8]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.5} roughness={0.4} />
      </mesh>
      {[-0.6, 0.6].map((z) => (
        <mesh key={z} position={[-1.95, 1.08, z]}>
          <boxGeometry args={[0.06, 0.25, 0.06]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* Faros y luces traseras */}
      {[-0.58, 0.58].map((z) => (
        <group key={z}>
          <mesh position={[2.27, 0.68, z]}>
            <boxGeometry args={[0.05, 0.1, 0.42]} />
            <meshStandardMaterial color="#fff" emissive="#bff9ff" emissiveIntensity={3} />
          </mesh>
          <mesh position={[-2.26, 0.74, z]}>
            <boxGeometry args={[0.05, 0.1, 0.48]} />
            <meshStandardMaterial color="#ff1a1a" emissive="#ff1a1a" emissiveIntensity={3} />
          </mesh>
        </group>
      ))}
      {[[1.35, 0.4, 0.86], [1.35, 0.4, -0.86], [-1.4, 0.4, 0.86], [-1.4, 0.4, -0.86]].map((p) => (
        <Wheel key={p.join()} position={p} spin={drive} />
      ))}
      {/* Underglow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[4.6, 2.4]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
      <pointLight position={[0, 0.2, 0]} color={color} intensity={6} distance={4} />
      <pointLight position={[3.2, 0.7, 0]} color="#bff9ff" intensity={8} distance={6} />
    </group>
  );
}

function Floor({ drive }) {
  const grid = useRef();
  useFrame((_, dt) => {
    if (drive && grid.current) grid.current.position.x = (grid.current.position.x - dt * 18) % 2;
  });
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#050608" roughness={0.35} metalness={0.6} />
      </mesh>
      <gridHelper ref={grid} args={[120, 60, '#ff6a00', '#0d3a40']} position={[0, 0.01, 0]} />
    </>
  );
}

function Streaks({ drive }) {
  const ref = useRef();
  const items = useMemo(() => Array.from({ length: 36 }, () => ({
    x: Math.random() * 60 - 30, y: 0.2 + Math.random() * 3.5, z: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 8),
    s: 0.6 + Math.random(), c: Math.random() < 0.5 ? '#ff6a00' : '#00f0ff',
  })), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.children.forEach((m, i) => {
      m.position.x -= dt * (drive ? 40 : 4) * items[i].s;
      if (m.position.x < -30) m.position.x = 30;
    });
  });
  return (
    <group ref={ref}>
      {items.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]}>
          <boxGeometry args={[2.5 * s.s, 0.02, 0.02]} />
          <meshBasicMaterial color={s.c} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function City() {
  const blocks = useMemo(() => Array.from({ length: 40 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const h = 2 + Math.random() * 9;
    const geo = new THREE.BoxGeometry(1.6 + Math.random() * 2, h, 2 + Math.random() * 2);
    return { pos: [-50 + i * 2.6, h / 2, side * (14 + Math.random() * 10)], geo, edges: new THREE.EdgesGeometry(geo) };
  }), []);
  return blocks.map((b, i) => (
    <group key={i} position={b.pos}>
      <mesh geometry={b.geo}><meshStandardMaterial color="#07090c" /></mesh>
      <lineSegments geometry={b.edges}>
        <lineBasicMaterial color={i % 3 ? '#0c4c55' : '#5a2a0c'} />
      </lineSegments>
    </group>
  ));
}

function Rig({ mode, dragRef }) {
  const target = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3());
  useFrame(({ camera, clock, pointer, size }) => {
    const t = clock.getElapsedTime();
    const drag = dragRef?.current || 0;
    const aspect = size.width / size.height;
    // En pantallas verticales alejamos la cámara para que el auto entre completo.
    const fit = (mode === 'garage' ? 3.1 : 3.2) / (Math.tan((camera.fov * Math.PI) / 360) * Math.min(aspect, 1.6));
    const r = Math.min(16, Math.max(mode === 'garage' ? 7.2 : 6.8, fit));
    const ang = mode === 'garage' ? t * 0.25 + drag : 0.78 + pointer.x * 0.35 + Math.sin(t * 0.2) * 0.1;
    // En el login el auto va en la mitad superior (abajo está el formulario).
    target.current.set(0, mode === 'drive' && aspect < 1 ? -r * 0.22 : 0.6, 0);
    pos.current.set(Math.cos(ang) * r, (mode === 'garage' ? 2.2 : 1.9 + pointer.y * 0.6) + r * 0.08, Math.sin(ang) * r);
    camera.position.lerp(pos.current, 0.06);
    camera.lookAt(target.current);
  });
  return null;
}

class GLBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="scene-fallback">// WEBGL OFFLINE</div> : this.props.children;
  }
}

/** mode: 'drive' (fondo animado del login) | 'garage' (turntable del perfil) */
export default function Scene3D({ color = '#ff6a00', mode = 'drive', className = '' }) {
  const drag = useRef(0);
  const last = useRef(null);
  const handlers = mode === 'garage' ? {
    onPointerDown: (e) => { last.current = e.clientX; },
    onPointerMove: (e) => { if (last.current != null) { drag.current += (e.clientX - last.current) * 0.01; last.current = e.clientX; } },
    onPointerUp: () => { last.current = null; },
    onPointerLeave: () => { last.current = null; },
  } : {};
  return (
    <div className={`scene3d ${className}`} {...handlers}>
      <GLBoundary>
        <Canvas dpr={[1, 1.75]} camera={{ fov: 42, position: [8, 3, 8] }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
          <color attach="background" args={['#050608']} />
          <fog attach="fog" args={['#050608', 8, 34]} />
          <ambientLight intensity={0.25} />
          <hemisphereLight args={['#00f0ff', '#ff6a00', 0.5]} />
          <spotLight position={[0, 9, 0]} angle={0.5} penumbra={0.7} intensity={60} color="#ffffff" />
          <directionalLight position={[-6, 4, -4]} intensity={1.2} color="#ff2bd6" />
          <Car color={color} drive={mode === 'drive'} />
          <Floor drive={mode === 'drive'} />
          <Streaks drive={mode === 'drive'} />
          {mode === 'drive' && <City />}
          <Rig mode={mode} dragRef={drag} />
        </Canvas>
      </GLBoundary>
    </div>
  );
}
