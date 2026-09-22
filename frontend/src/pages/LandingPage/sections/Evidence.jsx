import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Evidence.css';

gsap.registerPlugin(ScrollTrigger);

// Scattered, overlapping placement — an evidence table, not a grid. Rotation is tiny and deliberate.
const LAYOUT = [
  { top: '4%', left: '6%', rotate: -4 },
  { top: '2%', left: '40%', rotate: 3 },
  { top: '30%', left: '66%', rotate: -2 },
  { top: '46%', left: '14%', rotate: 5 },
  { top: '52%', left: '46%', rotate: -3 },
];

export default function Evidence({ evidence }) {
  const root = useRef(null);
  const items = (evidence ?? []).slice(0, 5);

  useEffect(() => {
    if (!items.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.evidence__headline', { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 75%' },
      });
      gsap.utils.toArray('.evidence__item').forEach((el, i) => {
        const rot = Number(el.dataset.rotate);
        gsap.fromTo(el, { opacity: 0, y: 60, rotate: 0, scale: 0.9 }, {
          opacity: 1, y: 0, rotate: rot, scale: 1, duration: 0.8, ease: 'power3.out', delay: i * 0.08,
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
        });
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  return (
    <section id="evidence" className="landing__section evidence" ref={root}>
      <span className="evidence__headline l-mono">EXHIBIT TABLE</span>
      <h2 className="evidence__title l-display">The Evidence</h2>

      <div className="evidence__table">
        {items.map((item, i) => {
          const pos = LAYOUT[i % LAYOUT.length];
          return (
            <div
              key={item.id} className="evidence__item" data-rotate={pos.rotate}
              style={{ top: pos.top, left: pos.left, '--rotate': `${pos.rotate}deg` }}
            >
              <span className="evidence__id l-mono">EVIDENCE {item.id}</span>
              <span className="evidence__name l-heading">{item.title}</span>
              <span className="evidence__meta l-mono">{item.time ?? ''}{item.location ? ` · ${item.location.toUpperCase()}` : ''}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
