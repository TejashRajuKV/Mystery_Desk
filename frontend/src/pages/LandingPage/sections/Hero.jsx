import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import './Hero.css';

export default function Hero({ caseInfo }) {
  const root = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('.hero__tag', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 })
        .fromTo('.hero__title-line', { opacity: 0, y: 60, skewY: 2 }, { opacity: 1, y: 0, skewY: 0, duration: 1, stagger: 0.12 }, '-=0.35')
        .fromTo('.hero__stats span', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, '-=0.4')
        .fromTo('.hero__cta', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
        .fromTo('.hero__scroll-hint', { opacity: 0 }, { opacity: 1, duration: 0.8 }, '-=0.2');
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="hero" className="landing__section hero" ref={root}>
      <span className="hero__tag l-mono">CASE FILE {caseInfo ? `#${caseInfo.id}` : '#047'}</span>

      <h1 className="hero__title">
        <span className="hero__title-line l-display">THE MISSING</span>
        <span className="hero__title-line l-display hero__title-line--amber">PROTOTYPE</span>
      </h1>

      <p className="hero__stats l-mono">
        <span>{caseInfo ? `${caseInfo.suspectCount} SUSPECTS` : 'FIVE SUSPECTS'}</span>
        <span className="hero__dot">·</span>
        <span>ONE TRUTH</span>
        <span className="hero__dot">·</span>
        <span>{caseInfo ? `${caseInfo.site.toUpperCase()}` : 'MARCH 1984'}</span>
      </p>

      <Link to="/dashboard" className="l-btn hero__cta">
        ENTER INVESTIGATION <span className="l-btn__arrow">→</span>
      </Link>

      <div className="hero__scroll-hint l-mono">SCROLL TO BEGIN</div>
    </section>
  );
}
