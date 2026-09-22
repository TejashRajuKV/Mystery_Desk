// Procedural sound design: every effect below is synthesized with the Web Audio
// API at call time. No audio files, no new dependency — see CLAUDE.md "Sound & feel".
// Mirrors boardStore.js: a plain module-level singleton, not a hook or context.
const PREF_KEY = 'mysterydesk:sound:047';
const AMBIENCE_LEVEL = 0.028;

function loadPref() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}');
    return { muted: raw.muted === true };
  } catch {
    return { muted: false };
  }
}
function savePref(pref) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch { /* storage unavailable */ }
}

let pref = loadPref();
let ctx = null;
let master = null;
let ambienceSource = null;
let ambienceGain = null;

/** Creates (once) and returns the shared AudioContext, resuming it and starting
 *  ambience if this is the first call. Safe to call from any user-gesture handler. */
function ensureContext() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = pref.muted ? 0 : 1;
  master.connect(ctx.destination);
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  startAmbience();
  return ctx;
}

/** Call on the app's first pointer/key gesture. Idempotent — safe to call repeatedly. */
export const unlockAudio = () => { ensureContext(); };

export const isMuted = () => pref.muted;

export function setMuted(muted) {
  pref = { ...pref, muted };
  savePref(pref);
  if (ctx && master) {
    master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    if (ambienceGain) ambienceGain.gain.setTargetAtTime(muted ? 0 : AMBIENCE_LEVEL, ctx.currentTime, 0.3);
  }
}

export function toggleMuted() {
  setMuted(!pref.muted);
  return pref.muted;
}

// ---------------------------------------------------------------- synthesis

function noiseBuffer(c, seconds) {
  const buf = c.createBuffer(1, Math.max(1, Math.round(c.sampleRate * seconds)), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playTone({ freq = 440, type = 'sine', duration = 0.15, gain = 0.15, freqEnd, filterFreq } = {}) {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  let node = osc;
  if (filterFreq) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function playNoiseBurst({ duration = 0.18, gain = 0.12, filterFreq = 1800, filterType = 'bandpass', q = 0.7 } = {}) {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, duration);
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

function startAmbience() {
  if (!ctx || ambienceSource) return;
  // Soft low-pass-filtered noise loop — reads as a distant room hum, not literal rain.
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 4);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  ambienceGain = ctx.createGain();
  ambienceGain.gain.value = 0;
  src.connect(filter).connect(ambienceGain).connect(master);
  src.start();
  ambienceGain.gain.linearRampToValueAtTime(pref.muted ? 0 : AMBIENCE_LEVEL, ctx.currentTime + 2.5);
  ambienceSource = src;
}

// ---------------------------------------------------------------- public SFX

/** Soft mechanical click — buttons, stamps, nav. */
export const playClick = () => playTone({ freq: 900, type: 'square', duration: 0.03, gain: 0.05, filterFreq: 2500 });

/** Paper/folder handling — opening an evidence card, suspect file or timeline entry. */
export const playPaperRustle = () => playNoiseBurst({ duration: 0.22, gain: 0.09, filterFreq: 2200, filterType: 'bandpass', q: 0.5 });

/** A thumbtack going into corkboard — pinning something to the board. */
export function playPin() {
  playTone({ freq: 220, type: 'sine', duration: 0.09, gain: 0.14, freqEnd: 90 });
  playNoiseBurst({ duration: 0.05, gain: 0.05, filterFreq: 4000, filterType: 'highpass' });
}

/** Red string pulling taut — a new board connection. */
export const playLinkConnect = () => playTone({ freq: 260, type: 'triangle', duration: 0.22, gain: 0.08, freqEnd: 520 });

/** A snip — deleting a board connection. */
export const playLinkRemove = () => playNoiseBurst({ duration: 0.08, gain: 0.07, filterFreq: 3200, filterType: 'highpass' });

/** Two-note rise — a contradiction confirmed, a link accepted. */
export function playSuccess() {
  playTone({ freq: 392, type: 'sine', duration: 0.14, gain: 0.1 });
  setTimeout(() => playTone({ freq: 523, type: 'sine', duration: 0.18, gain: 0.11 }), 90);
}

/** A low buzz — a rejected claim, a failed link, a 422. */
export const playDenied = () => playTone({ freq: 140, type: 'sawtooth', duration: 0.16, gain: 0.08, freqEnd: 90, filterFreq: 500 });

/** The rubber stamp landing — CASE SOLVED. The single biggest sound in the app. */
export function playStampThud() {
  playTone({ freq: 80, type: 'sine', duration: 0.28, gain: 0.22, freqEnd: 45 });
  playNoiseBurst({ duration: 0.1, gain: 0.1, filterFreq: 900, filterType: 'lowpass' });
}

/** A single soft key-clack — used sparingly (one-shot reveals, an "analysing" loop). */
export const playTypewriterKey = () => playNoiseBurst({ duration: 0.03, gain: 0.045, filterFreq: 3500, filterType: 'bandpass', q: 3 });
