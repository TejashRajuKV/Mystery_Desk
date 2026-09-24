import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { api } from '../../services/api.js';
import { useGo } from '../../components/Scene/Scene.jsx';
import { SoundToggle } from '../../components/ui/ui.jsx';
import Tutorial from '../../components/Tutorial/Tutorial.jsx';
import NoirScene from '../../components/NoirScene/NoirScene.jsx';
import { prefersReducedMotion } from '../../utils/motion.js';
import { playClick, playTypewriterKey } from '../../utils/sound.js';
import './MainMenu.css';

/** The title screen: the lamp comes on, the name types itself, and the detective picks what to do. */
export default function MainMenu() {
  const go = useGo();
  const root = useRef(null);
  const [cases, setCases] = useState(null);
  const [focus, setFocus] = useState(0);
  const [howto, setHowto] = useState(false);

  useEffect(() => { api.listCases().then(setCases).catch(() => setCases([])); }, []);
  const open = cases?.find((c) => c.status === 'in_progress');

  const items = [
    open && { id: 'continue', label: 'Continue', sub: `Case #${open.id} · ${open.title}`, act: () => go(`/case/${open.id}/map`, { kicker: `CASE #${open.id}`, title: open.title, sub: 'BACK ON THE CASE' }) },
    { id: 'select', label: 'Select a case', sub: cases ? `${cases.length} files on your desk` : 'Opening the drawer…', act: () => go('/cases') },
    { id: 'howto', label: 'How to play', sub: 'Evidence, the board, and how a case is won', act: () => setHowto(true) },
  ].filter(Boolean);

  useEffect(() => {
    const onKey = (e) => {
      if (howto) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocus((f) => (f + 1) % items.length); playTypewriterKey(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocus((f) => (f - 1 + items.length) % items.length); playTypewriterKey(); }
      if (e.key === 'Enter') { e.preventDefault(); playClick(); items[focus]?.act(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.menu__lamp', { autoAlpha: 0, duration: 1.2, ease: 'power1.inOut' })
        .from('.menu__scene', { autoAlpha: 0, x: 40, duration: 1.4, ease: 'power2.out' }, 0.3)
        .from('.menu__kicker', { autoAlpha: 0, y: 10, duration: 0.6 }, '-=0.9')
        .from('.menu__title span', { autoAlpha: 0, y: 40, rotateX: -60, duration: 0.8, stagger: 0.05 }, '-=0.3')
        .from('.menu__tag', { autoAlpha: 0, duration: 0.8 }, '-=0.3')
        .from('.menu__stamp', { autoAlpha: 0, scale: 2.4, rotate: -30, duration: 0.35, ease: 'power4.in' }, '-=0.4')
        .from('.menu__item', { autoAlpha: 0, x: -24, duration: 0.5, stagger: 0.08 }, '-=0.4')
        .from('.menu__foot', { autoAlpha: 0, duration: 0.6 }, '-=0.2');
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div className="menu" ref={root}>
      <div className="menu__lamp" aria-hidden="true" />
      <NoirScene className="menu__scene" />
      <div className="menu__blinds" aria-hidden="true" />
      <div className="menu__grain" aria-hidden="true" />

      <div className="menu__content">
        <div className="menu__kicker">
          <svg className="menu__badge" viewBox="0 0 40 46" aria-hidden="true">
            <path d="M20 2 36 8v14c0 11-7 18-16 22C11 40 4 33 4 22V8Z" />
            <path d="m20 12 2.6 5.6 6 .6-4.5 4 1.3 6L20 25.3 14.6 28.2l1.3-6-4.5-4 6-.6Z" className="menu__badge-star" />
          </svg>
          <span className="t-label">RIDGEWAY P.D. · 1984 · HOMICIDE &amp; SERIOUS CRIME</span>
        </div>
        <h1 className="t-display menu__title" aria-label="MysteryDesk">
          {'MysteryDesk'.split('').map((ch, i) => <span key={i} aria-hidden="true">{ch}</span>)}
        </h1>
        <div className="menu__tagline">
          <p className="t-body menu__tag">The files are on your desk. In every one of them, somebody is lying to you.</p>
          <span className="menu__stamp" aria-hidden="true">CONFIDENTIAL</span>
        </div>

        <nav className="menu__list" aria-label="Main menu">
          {items.map((it, i) => (
            <button key={it.id} type="button" className={focus === i ? 'menu__item menu__item--on' : 'menu__item'}
              onMouseEnter={() => { if (focus !== i) { setFocus(i); playTypewriterKey(); } }}
              onFocus={() => setFocus(i)}
              onClick={() => { playClick(); it.act(); }}>
              <span className="menu__arrow" aria-hidden="true">▸</span>
              <span className="menu__label">{it.label}</span>
              <span className="t-label menu__sub">{it.sub}</span>
            </button>
          ))}
        </nav>

        <div className="menu__foot">
          <SoundToggle />
          <span className="t-label">↑ ↓ TO CHOOSE · ENTER TO SELECT</span>
        </div>
      </div>

      {howto && <Tutorial onClose={() => setHowto(false)} />}
    </div>
  );
}
