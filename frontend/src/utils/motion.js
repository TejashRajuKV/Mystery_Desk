/** For JS-driven animation (the CSS blanket rule in index.css doesn't cover imperative style/WAAPI changes). */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * GSAP ticks on animation frames. When a browser stops delivering them to a visible page (a throttled
 * pane or embedded view), entrances that start hidden would stay hidden. While frames are stalled this
 * ticks GSAP on a timer instead, in real time; the moment frames return, it stops.
 */
export function keepAnimationsMoving(gsap) {
  let last = performance.now();
  let stalled = false;
  let stopped = false;
  const beat = () => {
    if (stopped) return;
    last = performance.now();
    if (stalled) { stalled = false; gsap.ticker.lagSmoothing(500, 33); }
    requestAnimationFrame(beat);
  };
  requestAnimationFrame(beat);
  // Timers in a stalled page may fire seconds apart; lag smoothing would count each gap as one frame.
  const watch = setInterval(() => {
    if (performance.now() - last < 200) return;
    if (!stalled) { stalled = true; gsap.ticker.lagSmoothing(0); }
    gsap.ticker.tick();
  }, 33);
  return () => { stopped = true; clearInterval(watch); };
}
