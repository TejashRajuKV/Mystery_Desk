import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { prefersReducedMotion } from '../../utils/motion.js';
import { playTransition } from '../../utils/sound.js';
import './Scene.css';

const SceneContext = createContext(null);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A tween that can't hold the game hostage: if animation frames stall (a throttled or background tab),
// the curtain snaps to its end state after a short grace period and the scene change carries on.
function tween(el, vars) {
  const t = gsap.to(el, vars);
  return Promise.race([t.then(), wait((vars.duration + (vars.delay ?? 0)) * 1000 + 250)]).then(() => { t.progress(1); });
}

/**
 * Scene changes go through a curtain: it drops, the route changes behind it, and it lifts.
 * `go(path, card)` can show a title card while the curtain is down (arriving somewhere, opening a file).
 */
export function SceneProvider({ children }) {
  const navigate = useNavigate();
  const curtain = useRef(null);
  const [card, setCard] = useState(null);
  const busy = useRef(false);

  const go = useCallback(async (to, nextCard = null) => {
    if (busy.current) return;
    if (prefersReducedMotion()) { navigate(to); return; }
    busy.current = true;
    setCard(nextCard);
    playTransition();
    await tween(curtain.current, { autoAlpha: 1, duration: 0.35, ease: 'power2.in' });
    navigate(to);
    if (nextCard) await wait(850);
    await tween(curtain.current, { autoAlpha: 0, duration: 0.5, ease: 'power2.out', delay: 0.05 });
    setCard(null);
    busy.current = false;
  }, [navigate]);

  return (
    <SceneContext.Provider value={go}>
      {children}
      <div className="curtain" ref={curtain} aria-hidden={!card}>
        {card && (
          <div className="curtain__card" role="status">
            {card.kicker && <span className="t-label curtain__kicker">{card.kicker}</span>}
            <span className="t-display curtain__title">{card.title}</span>
            {card.sub && <span className="t-label curtain__sub">{card.sub}</span>}
          </div>
        )}
      </div>
    </SceneContext.Provider>
  );
}

export function useGo() {
  const go = useContext(SceneContext);
  if (!go) throw new Error('useGo must be used inside <SceneProvider>');
  return go;
}

/** A scene's entrance: its [data-reveal] parts rise into place one after another. */
export function Scene({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.from('[data-reveal]', { autoAlpha: 0, y: 18, duration: 0.6, ease: 'power3.out', stagger: 0.07, clearProps: 'all' });
    }, ref);
    return () => ctx.revert();
  }, []);
  return <Tag ref={ref} className={`scene-root ${className}`} {...rest}>{children}</Tag>;
}
