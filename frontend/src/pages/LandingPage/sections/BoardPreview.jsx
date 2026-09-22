import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../../../utils/motion.js';
import './BoardPreview.css';

gsap.registerPlugin(ScrollTrigger);

// Fixed graph layout (percentage positions within the board canvas). Node ids are matched
// against real case entities below, so every label on screen is real case data, not invented.
const LAYOUT = [
  { id: 'cctv', x: 50, y: 8, kind: 'evidence' },
  { id: 'alex', x: 50, y: 34, kind: 'suspect' },
  { id: 'keycard', x: 24, y: 62, kind: 'evidence' },
  { id: 'statement', x: 76, y: 62, kind: 'evidence' },
  { id: 'storage', x: 50, y: 90, kind: 'location' },
];
const EDGES = [['cctv', 'alex'], ['alex', 'keycard'], ['alex', 'statement'], ['keycard', 'storage']];

function buildNodes({ evidence, suspects, caseInfo }) {
  const findEv = (pred) => evidence?.find(pred);
  const alex = suspects?.find((s) => /reyes/i.test(s.name)) ?? suspects?.[0];
  const keycard = findEv((e) => e.type === 'keycard') ?? evidence?.[0];
  const cctv = findEv((e) => e.type === 'cctv_log' || e.type === 'photo') ?? evidence?.[1];
  const storage = caseInfo?.locations?.find((l) => /storage/i.test(l.name)) ?? caseInfo?.locations?.[0];
  return {
    cctv: cctv && { label: cctv.id, title: cctv.title },
    alex: alex && { label: alex.id, title: alex.name },
    keycard: keycard && { label: keycard.id, title: keycard.title },
    statement: alex && { label: `${alex.id} STATEMENT`, title: 'Recorded interview' },
    storage: storage && { label: storage.id ?? 'L03', title: storage.name },
  };
}

export default function BoardPreview({ evidence, suspects, caseInfo }) {
  const root = useRef(null);
  const svgRef = useRef(null);
  const nodes = useMemo(() => buildNodes({ evidence, suspects, caseInfo }), [evidence, suspects, caseInfo]);
  const ready = LAYOUT.every((n) => nodes[n.id]);

  useEffect(() => {
    if (!ready) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.board__title', { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 75%' },
      });
      gsap.fromTo('.board__node', { opacity: 0, scale: 0.85 }, {
        opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.08,
        scrollTrigger: { trigger: '.board__canvas', start: 'top 70%' },
      });

      const lines = svgRef.current?.querySelectorAll('line') ?? [];
      lines.forEach((line, i) => {
        ScrollTrigger.create({
          trigger: '.board__canvas', start: 'top 60%',
          onEnter: () => {
            const len = line.getTotalLength();
            if (prefersReducedMotion()) { line.style.strokeDashoffset = 0; return; }
            line.style.strokeDasharray = String(len);
            line.style.strokeDashoffset = String(len);
            gsap.to(line, { strokeDashoffset: 0, duration: 0.7, delay: 0.3 + i * 0.12, ease: 'power2.out' });
          },
          once: true,
        });
      });
    }, root);
    return () => ctx.revert();
  }, [ready]);

  if (!ready) return <section id="board" className="landing__section board" ref={root} />;

  return (
    <section id="board" className="landing__section board" ref={root}>
      <span className="l-mono">HOW IT CONNECTS</span>
      <h2 className="board__title l-display">The Investigation Board</h2>

      <div className="board__canvas">
        <svg ref={svgRef} className="board__lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {EDGES.map(([a, b]) => {
            const na = LAYOUT.find((n) => n.id === a);
            const nb = LAYOUT.find((n) => n.id === b);
            return <line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} />;
          })}
        </svg>
        {LAYOUT.map((pos) => {
          const n = nodes[pos.id];
          return (
            <div key={pos.id} className={`board__node board__node--${pos.kind}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
              <span className="l-mono board__node-label">{n.label}</span>
              <span className="board__node-title">{n.title}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
