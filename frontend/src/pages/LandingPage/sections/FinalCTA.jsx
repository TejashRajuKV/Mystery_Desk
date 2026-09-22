import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './FinalCTA.css';

gsap.registerPlugin(ScrollTrigger);

export default function FinalCTA() {
  const root = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.final-cta__line', { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.15,
        scrollTrigger: { trigger: root.current, start: 'top 65%' },
      });
      gsap.fromTo('.final-cta__btn', { opacity: 0, y: 20 }, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.3,
        scrollTrigger: { trigger: root.current, start: 'top 65%' },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="cta" className="landing__section final-cta" ref={root}>
      <h2 className="final-cta__title l-display">
        <span className="final-cta__line">YOU HAVE</span>
        <span className="final-cta__line">THE EVIDENCE.</span>
        <span className="final-cta__line final-cta__line--amber">BUT DO YOU</span>
        <span className="final-cta__line final-cta__line--amber">HAVE THE TRUTH?</span>
      </h2>
      <Link to="/dashboard" className="l-btn final-cta__btn">
        ENTER INVESTIGATION <span className="l-btn__arrow">→</span>
      </Link>
      <footer className="final-cta__foot l-mono">MYSTERYDESK · CASE #047 · THE MISSING PROTOTYPE</footer>
    </section>
  );
}
