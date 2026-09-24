import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { useCase } from '../../hooks/useCase.jsx';
import { useGo } from '../../components/Scene/Scene.jsx';
import ChoiceList from '../../components/ChoiceList/ChoiceList.jsx';
import { formatClock } from '../../utils/format.js';
import { prefersReducedMotion } from '../../utils/motion.js';
import { playPaperRustle } from '../../utils/sound.js';
import './CaseStart.css';

/** The file lands on the desk. The first choice of the case: read it, or go straight out. */
export default function CaseStart() {
  const { caseInfo, investigation, base } = useCase();
  const go = useGo();
  const ref = useRef(null);
  const started = investigation.pagesRead.length + investigation.placesVisited.length + investigation.interviewedSuspects.length > 0;
  const closed = Boolean(investigation.conclusion);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;
    playPaperRustle();
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.arrive__file', { y: -120, rotate: -14, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.2)' })
        .from('.arrive [data-line]', { autoAlpha: 0, y: 12, duration: 0.5, stagger: 0.12 }, '-=0.3')
        .from('.arrive .choices li', { autoAlpha: 0, x: -16, duration: 0.4, stagger: 0.08 }, '-=0.2');
    }, ref);
    return () => ctx.revert();
  }, []);

  const toFile = { id: 'file', label: started ? 'Read the case file again' : 'Open the file and read it (each page takes time)' };
  const toCity = { id: 'city', label: started ? 'Get back out there' : 'Leave the file on the desk. Go straight to the scene', tone: started ? undefined : 'leave' };
  const toCases = { id: 'cases', label: 'Put the file back and pick another case', tone: 'leave' };
  const toEnding = { id: 'ending', label: 'Read how it ended' };
  const choices = closed ? [toEnding, toCases] : started ? [toCity, toFile, toCases] : [toFile, toCity, toCases];

  function choose(c) {
    if (c.id === 'file') go(`${base}/file`);
    if (c.id === 'city') go(`${base}/map`, { kicker: caseInfo.site.toUpperCase(), title: 'Out into the city', sub: formatClock(investigation.clock.now) });
    if (c.id === 'cases') go('/cases');
    if (c.id === 'ending') go(`${base}/accuse`);
  }

  return (
    <div className="arrive" ref={ref}>
      <div className="arrive__file tex-paper" aria-hidden="true">
        <span className="t-label">CASE #{caseInfo.id}</span>
        <span className="t-h2">{caseInfo.classification}</span>
        <span className="arrive__stamp">{caseInfo.crime}</span>
      </div>

      <section className="arrive__text">
        <p className="t-label arrive__time" data-line>{formatClock(investigation.clock?.now ?? caseInfo.clock.start)} · {caseInfo.site.toUpperCase()}</p>
        <h1 className="t-display arrive__title" data-line>{caseInfo.title}</h1>
        <p className="t-body arrive__summary" data-line>
          {started ? 'The file is where you left it, and the clock is still running.' : caseInfo.summary}
        </p>
        <p className="t-label arrive__deadline" data-line>{caseInfo.clock.deadlineNote}</p>
        <h2 className="t-h2 arrive__ask" data-line>What do you do?</h2>
        <ChoiceList choices={choices} onChoose={choose} />
      </section>
    </div>
  );
}
