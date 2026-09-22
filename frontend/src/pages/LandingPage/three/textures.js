import * as THREE from 'three';

// Small canvas-generated textures, so the scene needs zero external image assets.
const cache = new Map();

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A redacted-document look: off-white sheet, faint ruled lines, a few blacked-out bars. */
export function redactedDocumentTexture(seed = 0) {
  const key = `doc-${seed}`;
  if (cache.has(key)) return cache.get(key);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(seed + 1);

  ctx.fillStyle = '#e9e2d2';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let y = 40; y < size - 40; y += 14) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(20,16,10,0.55)';
  for (let y = 60; y < size - 60; y += 26) {
    if (rand() > 0.4) continue;
    ctx.fillRect(40, y, size * (0.25 + rand() * 0.5), 12);
  }
  ctx.fillStyle = 'rgba(20,16,10,0.9)';
  for (let i = 0; i < 3; i++) {
    const y = 90 + i * 130 + rand() * 30;
    ctx.fillRect(40, y, size * (0.4 + rand() * 0.35), 16);
  }
  ctx.strokeStyle = 'rgba(122,46,46,0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}
