// A plain mutable store, not React state: GSAP's ScrollTrigger writes to it on every
// scroll tick, and the R3F scene reads it inside useFrame. Going through React state
// for a 60fps-driven value would re-render the whole component tree every frame.
export const scrollStore = {
  progress: 0, // 0..1 across the whole page
  section: 0, // index of the section currently most in view
  mouseX: 0, // -1..1
  mouseY: 0, // -1..1
};

export function bindMouseParallax() {
  const onMove = (e) => {
    scrollStore.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    scrollStore.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  return () => window.removeEventListener('pointermove', onMove);
}
