import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { api } from '../../services/api.js';
import Nav from './Nav.jsx';
import Scene3D from './three/Scene3D.jsx';
import { scrollStore } from './three/scrollStore.js';
import Hero from './sections/Hero.jsx';
import Incident from './sections/Incident.jsx';
import Evidence from './sections/Evidence.jsx';
import Suspects from './sections/Suspects.jsx';
import TimelineExperience from './sections/TimelineExperience.jsx';
import BoardPreview from './sections/BoardPreview.jsx';
import AssistantPreview from './sections/AssistantPreview.jsx';
import FinalCTA from './sections/FinalCTA.jsx';
import './landing-tokens.css';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const [data, setData] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getCase(), api.getEvidenceList(), api.getSuspects(), api.getTimeline()])
      .then(([caseInfo, evidence, suspects, timeline]) => !cancelled && setData({ caseInfo, evidence, suspects, timeline }))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      trigger: contentRef.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => { scrollStore.progress = self.progress; },
    });
    // New sections change the page's total scroll height; make sure ScrollTrigger knows.
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => { trigger.kill(); cancelAnimationFrame(id); };
  }, [data]);

  return (
    <div className="landing">
      <Scene3D />
      <Nav />
      <div className="landing__content" ref={contentRef}>
        <Hero caseInfo={data?.caseInfo} />
        <Incident timeline={data?.timeline} />
        <Evidence evidence={data?.evidence} />
        <Suspects suspects={data?.suspects} />
        <TimelineExperience timeline={data?.timeline} />
        <BoardPreview evidence={data?.evidence} suspects={data?.suspects} caseInfo={data?.caseInfo} />
        <AssistantPreview />
        <FinalCTA />
      </div>
    </div>
  );
}
