import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { scrollStore, bindMouseParallax } from './scrollStore.js';
import ParticleField from './ParticleField.jsx';
import EvidenceObjects from './EvidenceObjects.jsx';

// Real perf, not just a dimmer: below this width the WebGL scene doesn't mount at all —
// no GPU/CPU cost, just the CSS vignette/grain the rest of the app already uses.
const MOBILE_BREAKPOINT = 720;

/** Moves the camera slowly through the environment on scroll, with a subtle mouse-parallax offset.
 *  Both are lerped — never a direct 1:1 follow — so the motion reads as heavy and deliberate. */
function CameraRig() {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0, z: 6 });

  useFrame(() => {
    const depthTravel = scrollStore.progress * 3.2; // camera eases forward across the whole page
    target.current.x = scrollStore.mouseX * 0.35;
    target.current.y = -scrollStore.mouseY * 0.22;
    target.current.z = 6 - depthTravel;

    camera.position.x += (target.current.x - camera.position.x) * 0.04;
    camera.position.y += (target.current.y - camera.position.y) * 0.04;
    camera.position.z += (target.current.z - camera.position.z) * 0.06;
    camera.lookAt(0, 0, -3);
  });

  return null;
}

function Lighting() {
  const lamp = useRef(null);
  useFrame((state) => {
    if (!lamp.current) return;
    // A desk lamp that breathes almost imperceptibly, rather than sitting dead-static.
    lamp.current.intensity = 2.2 + Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
  });
  return (
    <>
      <ambientLight intensity={0.18} color="#0a0e14" />
      <pointLight ref={lamp} position={[2.2, 2.6, 1.5]} color="#d9a441" intensity={2.2} distance={14} decay={2} />
      <directionalLight position={[-4, -2, -3]} color="#3a4a5e" intensity={0.4} />
    </>
  );
}

export default function Scene3D() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT);

  useEffect(() => {
    if (mobile) return undefined;
    return bindMouseParallax();
  }, [mobile]);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (mobile) {
    return <div className="landing__canvas landing__canvas--mobile" aria-hidden="true" />;
  }

  return (
    <div className="landing__canvas" aria-hidden="true">
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 45, position: [0, 0, 6] }}
        dpr={[1, 1.75]}
      >
        <fog attach="fog" args={['#050403', 4, 13]} />
        <Lighting />
        <CameraRig />
        <Suspense fallback={null}>
          <ParticleField />
          <EvidenceObjects />
        </Suspense>
      </Canvas>
    </div>
  );
}
