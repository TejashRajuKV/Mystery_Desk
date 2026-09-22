import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Incident.css';

gsap.registerPlugin(ScrollTrigger);

/** Picks a handful of the most dramatic real timeline beats — no invented copy. */
function pickBeats(timeline) {
  if (!timeline?.length) return [];
  const wanted = ['badges out', 'camera', 'dark', 'opened', 'door', 'discovered', 'empty'];
  const scored = timeline.map((t) => ({
    t,
    score: wanted.reduce((n, w) => n + (t.title.toLowerCase().includes(w) ? 1 : 0), 0),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, 4)
    .sort((a, b) => a.t.timestamp.localeCompare(b.t.timestamp)).map((s) => s.t);
}

export default function Incident({ timeline }) {
  const root = useRef(null);
  const beats = pickBeats(timeline);

  useEffect(() => {
    if (!beats.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.incident__headline', { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 70%' },
      });
      gsap.utils.toArray('.incident__beat').forEach((el, i) => {
        gsap.fromTo(el, { opacity: 0, x: -30 }, {
          opacity: 1, x: 0, duration: 0.7, ease: 'power2.out', delay: i * 0.05,
          scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' },
        });
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beats.length]);

  return (
    <section id="incident" className="landing__section incident" ref={root}>
      <h2 className="incident__headline l-display">
        SOMETHING<br /><span className="incident__amber">DISAPPEARED.</span>
      </h2>

      {beats.length > 0 && (
        <div className="incident__beats">
          {beats.map((t) => (
            <div key={t.id} className="incident__beat">
              <span className="incident__time l-mono">{t.time}</span>
              <span className="incident__desc l-body">{t.title}.</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
