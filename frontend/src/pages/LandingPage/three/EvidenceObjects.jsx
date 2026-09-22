import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollStore } from './scrollStore.js';
import { redactedDocumentTexture } from './textures.js';

/** Smooth falloff: 1 at the object's home scroll-band, fading to 0 outside a half-width margin. */
function bandVisibility(progress, [from, to], margin = 0.06) {
  if (progress >= from && progress <= to) return 1;
  const dist = progress < from ? from - progress : progress - to;
  return Math.max(0, 1 - dist / margin);
}

function FloatingDocument({ position, rotation = [0, 0, 0], band, seed = 0 }) {
  const ref = useRef(null);
  const texture = redactedDocumentTexture(seed);
  useFrame((state) => {
    if (!ref.current) return;
    const v = bandVisibility(scrollStore.progress, band);
    ref.current.material.opacity = v * 0.9;
    ref.current.visible = v > 0.01;
    ref.current.rotation.y = rotation[1] + Math.sin(state.clock.elapsedTime * 0.3 + seed) * 0.08;
    ref.current.rotation.z = rotation[2] + Math.cos(state.clock.elapsedTime * 0.2 + seed) * 0.03;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.4 + seed) * 0.15;
  });
  return (
    <mesh ref={ref} position={position} rotation={rotation}>
      <planeGeometry args={[1.6, 1.6]} />
      <meshStandardMaterial map={texture} transparent roughness={0.85} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  );
}

function FloatingPrototype({ position, band }) {
  const ref = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    const v = bandVisibility(scrollStore.progress, band);
    ref.current.material.opacity = v * 0.95;
    ref.current.visible = v > 0.01;
    ref.current.rotation.x = state.clock.elapsedTime * 0.15;
    ref.current.rotation.y = state.clock.elapsedTime * 0.22;
  });
  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[0.85, 0]} />
      <meshStandardMaterial color="#b08d57" transparent roughness={0.3} metalness={0.7} wireframe />
    </mesh>
  );
}

function FloatingKeycard({ position, band }) {
  const ref = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    const v = bandVisibility(scrollStore.progress, band);
    ref.current.material.opacity = v * 0.9;
    ref.current.visible = v > 0.01;
    ref.current.rotation.y = state.clock.elapsedTime * 0.4;
  });
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[0.55, 0.06, 16, 48]} />
      <meshStandardMaterial color="#d9a441" transparent roughness={0.4} metalness={0.6} />
    </mesh>
  );
}

/** Section bands, evenly spread across the page's scroll range (approx. 9 sections). */
const BANDS = {
  hero: [0, 0.1],
  incident: [0.12, 0.22],
  evidence: [0.24, 0.36],
  suspects: [0.38, 0.5],
  timeline: [0.52, 0.64],
  board: [0.66, 0.78],
  assistant: [0.8, 0.9],
  cta: [0.92, 1],
};

export default function EvidenceObjects() {
  return (
    <group>
      <FloatingDocument position={[3.2, 0.4, -3]} rotation={[0, -0.3, 0.05]} band={BANDS.hero} seed={1} />
      <FloatingDocument position={[-3.4, -0.6, -2.5]} rotation={[0, 0.4, -0.05]} band={BANDS.incident} seed={2} />
      <FloatingDocument position={[3, 0.2, -2]} rotation={[0, -0.5, 0.03]} band={BANDS.evidence} seed={3} />
      <FloatingDocument position={[-2.8, 0.5, -2.8]} rotation={[0, 0.35, 0]} band={BANDS.evidence} seed={4} />
      <FloatingKeycard position={[3.3, -0.3, -2.2]} band={BANDS.suspects} />
      <FloatingDocument position={[-3, -0.2, -2.4]} rotation={[0, 0.3, 0.04]} band={BANDS.timeline} seed={5} />
      <FloatingKeycard position={[3, 0.4, -2.6]} band={BANDS.board} />
      <FloatingDocument position={[-3.2, 0.1, -2]} rotation={[0, 0.45, 0]} band={BANDS.assistant} seed={6} />
      <FloatingPrototype position={[0, 0, -3.5]} band={BANDS.cta} />
    </group>
  );
}

export { BANDS };
