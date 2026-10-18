import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CarModel, Environment, GLBoundary } from './Scene3D.jsx';

function blobTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// heading: grados desde el norte, sentido horario. El modelo mira hacia +X.
function Car({ body, color, headingRef, heading, pitch, distance, driving }) {
  const shadow = useMemo(() => blobTexture([[0, 'rgba(0,0,0,.75)'], [1, 'rgba(0,0,0,0)']]), []);
  const beam = useMemo(() => blobTexture([[0, 'rgba(255,236,190,.55)'], [1, 'rgba(255,236,190,0)']]), []);
  const group = useRef();
  const current = useRef(null);
  useFrame(({ camera }) => {
    const target = headingRef ? headingRef.current : heading;
    if (current.current == null) current.current = target;
    const diff = ((target - current.current + 540) % 360) - 180;
    current.current += diff * 0.15;
    if (group.current) group.current.rotation.y = ((90 - current.current) * Math.PI) / 180;
    const p = (pitch * Math.PI) / 180;
    camera.position.set(0, Math.sin(p) * distance, Math.cos(p) * distance);
    camera.lookAt(0, 0.3, 0);
  });
  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[5.4, 2.6, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      {driving && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4.2, 0.02, 0]} scale={[5, 3, 1]}>
          <planeGeometry />
          <meshBasicMaterial map={beam} transparent depthWrite={false} />
        </mesh>
      )}
      <CarModel body={body} color={color} spin={driving} />
    </group>
  );
}

/** Auto del jugador sobre el mapa. pitch: 90 = cenital; ~40 = vista de navegación. */
export default function MapCar3D({ body, color, heading = 0, headingRef, pitch = 62, size = 110, driving = false }) {
  return (
    <div className="map-car3d" style={{ width: size, height: size }}>
      <GLBoundary fallback={<div className="map-car-fallback" style={{ background: color }} />}>
        <Canvas
          dpr={[1, 2]}
          camera={{ fov: 30, near: 0.1, far: 100 }}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          onCreated={({ gl }) => { gl.localClippingEnabled = true; gl.setClearColor(0x000000, 0); }}
        >
          <Environment intensity={0.7} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 8, 4]} intensity={2} />
          <Car body={body} color={color} heading={heading} headingRef={headingRef} pitch={pitch} distance={driving ? 13 : 14} driving={driving} />
        </Canvas>
      </GLBoundary>
    </div>
  );
}

