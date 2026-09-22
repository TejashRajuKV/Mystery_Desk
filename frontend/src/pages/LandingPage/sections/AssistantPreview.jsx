import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { api } from '../../../services/api.js';
import './AssistantPreview.css';

gsap.registerPlugin(ScrollTrigger);

const QUESTION = 'What happened between 21:00 and 21:30?';
const STEPS = ['ANALYSING EVIDENCE...', 'CROSS-REFERENCING TIMELINE...', 'CHECKING STATEMENTS...'];

export default function AssistantPreview() {
  const root = useRef(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [answer, setAnswer] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.assistantx__inner', { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: {
          trigger: root.current, start: 'top 70%',
          onEnter: () => runSequence(),
        },
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSequence() {
    if (started.current) return;
    started.current = true;
    let i = 0;
    const tick = () => {
      setStepIndex(i);
      i += 1;
      if (i < STEPS.length) setTimeout(tick, 550);
    };
    tick();
    api.askAssistant(QUESTION).then((res) => {
      setTimeout(() => setAnswer(res), STEPS.length * 550 + 300);
    }).catch(() => setTimeout(() => setAnswer({ answer: 'The case files are offline right now.', relatedEvidence: [] }), STEPS.length * 550 + 300));
  }

  return (
    <section id="assistant" className="landing__section assistantx" ref={root}>
      <div className="assistantx__inner">
        <span className="l-mono">THE INVESTIGATION ASSISTANT</span>
        <h2 className="assistantx__title l-display">Ask The Case.</h2>

        <div className="assistantx__terminal">
          <div className="assistantx__prompt l-mono">&gt; {QUESTION}</div>
          {STEPS.map((s, i) => (
            <div key={s} className={`assistantx__step l-mono ${i <= stepIndex ? 'is-visible' : ''}`}>{s}</div>
          ))}
          {answer && (
            <div className="assistantx__answer">
              <p className="l-body">{answer.answer}</p>
              {answer.relatedEvidence?.length > 0 && (
                <div className="assistantx__refs">
                  <span className="l-mono">{answer.relatedEvidence.length} REFERENCE{answer.relatedEvidence.length === 1 ? '' : 'S'} FOUND</span>
                  <div className="assistantx__chips">
                    {answer.relatedEvidence.map((id) => <span key={id} className="assistantx__chip l-mono">{id}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
