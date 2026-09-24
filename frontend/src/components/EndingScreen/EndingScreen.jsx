import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import './EndingScreen.css';

// The stamp lands first (0.4s), then the narrative lines follow it down the page.
const LINE_DELAY = (i) => `${1100 + i * 700}ms`;

/** The cinematic close of the case: which ending the accusation earned, told in the ending's own words. */
export default function EndingScreen({ caseId, title, ending, accused, children }) {
  return (
    <header className={`ending ending--${ending.id}`}>
      <div className="ending__top">
        <div className="ending__heading">
          <span className="t-label muted">FINAL REPORT · CASE #{caseId}</span>
          <h2 className="t-display ending__title">{title}</h2>
          <p className="t-label secondary">{accused ? 'ACCUSED' : 'ACCUSED · NO ONE'}</p>
          {accused && <p className="t-h1 ending__accused">{accused}</p>}
        </div>
        <div className="ending__stamp" role="img" aria-label={ending.stamp}>{ending.stamp}</div>
      </div>

      <div className="ending__story">
        <p className="t-label">ENDING · {ending.title}</p>
        <p className="t-h2 ending__verdict">{ending.verdict}</p>
        {ending.narrative.map((line, i) => (
          <p key={i} className="t-body ending__line" style={{ animationDelay: LINE_DELAY(i) }}>{line}</p>
        ))}
      </div>
      {children && <div className="ending__actions">{children}</div>}
    </header>
  );
}

/** Straight after filing: the screen goes black, the case closes, the ending is named. */
export function CaseClosedIntro({ ending, onDone }) {
  return createPortal(
    <div className="closing" aria-hidden="true" onAnimationEnd={(e) => { if (e.target === e.currentTarget) onDone(); }}>
      <span className="t-display closing__stamp">Case closed</span>
      <span className="t-h1 closing__title">{ending.title}</span>
    </div>,
    document.body,
  );
}

/** How it was actually done — only ever handed over for an ending that named the right person. */
export function WhatHappened({ events }) {
  const { base } = useCase();
  return (
    <section id="what-happened" className="happened" aria-label="What happened">
      <span className="t-label muted">WHAT HAPPENED</span>
      <ol className="happened__list">
        {events.map((t) => (
          <li key={t.id}>
            <span className="t-h2 happened__time">{t.time}</span>
            <div>
              <p className="t-h3">{t.title}</p>
              <p className="t-small secondary">{t.description}</p>
              {t.evidence.length > 0 && (
                <p className="happened__proof">
                  {t.evidence.map((e) => <Link key={e.id} to={`${base}/evidence?select=${e.id}`} className="stamp">{e.id} · {e.title}</Link>)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
