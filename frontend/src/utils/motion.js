/** For JS-driven animation (the CSS blanket rule in index.css doesn't cover imperative style/WAAPI changes). */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
