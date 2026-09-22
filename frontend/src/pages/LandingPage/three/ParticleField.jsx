import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollStore } from './scrollStore.js';

const COUNT = 700;

/** Dust drifting in a desk-lamp shaft of light — the only "environment" the brief needs. */
export default function ParticleField() {
  const points = useRef(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 22;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 22 - 4;
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (!points.current) return;
    points.current.rotation.y += delta * 0.015;
    // Very slow global drift, plus a gentle nudge from scroll depth — never aggressive.
    points.current.position.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.4 - scrollStore.progress * 1.5;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.022} color="#d9a441" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}
