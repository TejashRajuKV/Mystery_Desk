import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../../../utils/motion.js';
import './TimelineExperience.css';

gsap.registerPlugin(ScrollTrigger);

export default function TimelineExperience({ timeline }) {
  const root = useRef(null);
  const track = useRef(null);
  const events = (timeline ?? []).slice(0, 7);

  useEffect(() => {
    if (!events.length || !track.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.tlx__title', { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 75%' },
      });

      // Skip the pinned horizontal scroll-jack on reduced-motion or narrow/touch viewports — the CSS
      // already stacks the track vertically there (see TimelineExperience.css), which reads fine on its own
      // and avoids the scroll-hijacking-vs-touch-gesture conflicts that make this pattern painful on mobile.
      if (prefersReducedMotion() || window.innerWidth <= 720) return;

      const getDistance = () => track.current.scrollWidth - window.innerWidth + 160;
      gsap.to(track.current, {
        x: () => -getDistance(), ease: 'none',
        scrollTrigger: {
          trigger: '.tlx__pin', start: 'top top', end: () => `+=${getDistance() + 400}`,
          // Explicit: GSAP skips reserving scroll space by default when the pinned
          // element's parent computes to display:flex (see .tlx in the CSS) — without
          // this the next section overlaps the still-pinned track instead of waiting for it.
          pin: true, pinSpacing: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
        },
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  return (
    <section id="timeline" className="landing__section tlx" ref={root}>
      {/* The intro now lives inside the pin wrapper so it stays
          fixed on screen while the timeline track scrolls through. */}
      <div className="tlx__pin">
        <div className="tlx__intro">
          <span className="l-mono">FRIDAY NIGHT, MINUTE BY MINUTE</span>
          <h2 className="tlx__title l-display">Reconstructing the Night</h2>
        </div>
        <div className="tlx__track" ref={track}>
          {events.map((e, i) => (
            <div key={e.id} className="tlx__event">
              <span className="tlx__index l-mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="tlx__time l-heading">{e.time}</span>
              <span className="tlx__desc l-body">{e.title}</span>
              <span className="tlx__line" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
