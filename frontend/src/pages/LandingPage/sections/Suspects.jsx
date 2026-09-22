import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Suspects.css';

gsap.registerPlugin(ScrollTrigger);

export default function Suspects({ suspects }) {
  const root = useRef(null);
  const list = suspects ?? [];

  useEffect(() => {
    if (!list.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.suspects__title', { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 75%' },
      });
      gsap.fromTo('.suspect-card', { opacity: 0, y: 50 }, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12,
        scrollTrigger: { trigger: '.suspects__wall', start: 'top 78%' },
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  return (
    <section id="suspects" className="landing__section suspects" ref={root}>
      <span className="l-mono suspects__tag">FIVE HAD THE MEANS</span>
      <h2 className="suspects__title l-display">The Suspects</h2>

      <div className="suspects__wall">
        {list.map((s) => (
          <div key={s.id} className="suspect-card">
            <div className="suspect-card__portrait" aria-hidden="true">
              <div className="suspect-card__silhouette" />
              <span className="suspect-card__redacted l-mono">CLASSIFIED</span>
            </div>
            <div className="suspect-card__meta">
              <span className="suspect-card__id l-mono">{s.id}</span>
              <span className="suspect-card__name l-heading">{s.name}</span>
              <span className="suspect-card__role l-mono">{s.role?.toUpperCase()}</span>
              <p className="suspect-card__reveal l-body">{s.motive}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
