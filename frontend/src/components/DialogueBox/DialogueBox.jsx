import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../utils/motion.js';
import { isMuted } from '../../utils/sound.js';
import './DialogueBox.css';

const CHARS_PER_TICK = 2;
const TICK_MS = 16;
const canSynthesize = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * One line of dialogue: who is speaking, how they seem, the stage direction, and the line itself
 * typed out (instantly with reduced motion; a click finishes it). `onTyped` fires when it's all shown.
 * Voice plays the node's recorded file when the data has one, else the browser's own speech.
 */
export default function DialogueBox({ speaker, role, mood, narration, text, voice, onTyped }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text.length : 0));
  const [speaking, setSpeaking] = useState(false);
  const audio = useRef(null);
  const done = shown >= text.length;

  useEffect(() => {
    if (prefersReducedMotion()) { setShown(text.length); return undefined; }
    setShown(0);
    const id = setInterval(() => setShown((n) => {
      if (n >= text.length) { clearInterval(id); return n; }
      return n + CHARS_PER_TICK;
    }), TICK_MS);
    return () => clearInterval(id);
  }, [text]);

  useEffect(() => { if (done) onTyped?.(); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    if (canSynthesize()) window.speechSynthesis.cancel();
    setSpeaking(false);
  };
  useEffect(() => stop, [text]);

  function synthesize() {
    if (!canSynthesize()) return setSpeaking(false);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = mood === 'nervous' ? 1.1 : 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  function play() {
    if (speaking) return stop();
    stop();
    setShown(text.length);
    setSpeaking(true);
    if (voice) {
      const a = new Audio(voice);
      a.muted = isMuted();
      a.onended = () => setSpeaking(false);
      audio.current = a;
      a.play().catch(() => { audio.current = null; synthesize(); });
    } else synthesize();
  }

  return (
    <div className="dialogue">
      <div className="dialogue__who">
        <span className="t-h2 dialogue__name">{speaker}</span>
        {role && <span className="t-mono muted">{role}</span>}
        {mood && mood !== 'neutral' && <span className="t-label dialogue__mood">({mood})</span>}
      </div>
      {narration && <p className="t-small dialogue__narration">{narration}</p>}
      <blockquote className="t-body dialogue__line" onClick={() => setShown(text.length)}>
        <span aria-hidden="true">“{text.slice(0, shown)}{done ? '”' : <span className="dialogue__caret">▌</span>}</span>
        <span className="sr-only">“{text}”</span>
      </blockquote>
      {(voice || canSynthesize()) && (
        <button type="button" className="stamp dialogue__voice" onClick={play} aria-pressed={speaking}>
          {speaking ? '■ STOP VOICE' : '▶ PLAY VOICE'}
        </button>
      )}
    </div>
  );
}
