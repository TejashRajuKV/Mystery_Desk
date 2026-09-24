import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Stamp, PageTitle, Loading, ErrorState } from '../../components/ui/ui.jsx';
import ReportSection from '../../components/ReportSection/ReportSection.jsx';
import EndingScreen, { CaseClosedIntro, WhatHappened } from '../../components/EndingScreen/EndingScreen.jsx';
import NewInvestigation from '../../components/NewInvestigation/NewInvestigation.jsx';
import { formatWhen, typeLabel } from '../../utils/format.js';
import { playAccusation, playDenied, playPaperRustle, playStampThud } from '../../utils/sound.js';
import './FinalReport.css';

// Indexed by row, not DOM order — the two report columns cascade down together,
// like a dossier's pages dropping into place, rather than the right column waiting on the left.
const SECTION_DELAY = (row) => `${120 + row * 100}ms`;

/** The final question, then the evidence, then the filing. Nothing here can be taken back. */
function Accusation({ onFiling }) {
  const { caseInfo, suspects, suspectById, evidence, submitConclusion, caseId } = useCase();
  const [step, setStep] = useState('who');
  const [accused, setAccused] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (id) => setPicked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const choose = (id) => { setAccused(id); setStep(id ? 'evidence' : 'none'); setError(null); playPaperRustle(); };
  const back = () => { setStep('who'); setError(null); };

  async function file() {
    setBusy(true); setError(null);
    onFiling(true);
    playAccusation();
    try {
      await submitConclusion(accused ? { suspectId: accused, evidenceIds: [...picked] } : { suspectId: null, evidenceIds: [] });
    } catch (err) {
      onFiling(false); setError(err); playDenied(); setBusy(false);
    }
  }

  if (step === 'who') {
    return (
      <section className="accuse" aria-labelledby="final-q">
        <span className="t-label muted">THE FINAL QUESTION · CASE {caseId}</span>
        <h2 id="final-q" className="t-display accuse__question">{caseInfo.accusationQuestion}</h2>
        <p className="t-body secondary">Name one person, or admit you can’t. Whatever you file, the case closes with it.</p>
        <ol className="accuse__names">
          {suspects.map((s) => (
            <li key={s.id}>
              <button type="button" className="accuse__name" onClick={() => choose(s.id)}>
                <span className="t-h1">[ {s.name} ]</span>
                <span className="t-mono muted">{s.role}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="accuse__name accuse__name--none" onClick={() => choose(null)}>
              <span className="t-h2">[ I cannot determine ]</span>
            </button>
          </li>
        </ol>
      </section>
    );
  }

  if (step === 'none') {
    return (
      <section className="accuse" role="alertdialog" aria-label="Close the file without naming anyone">
        <span className="t-label muted">THE FINAL QUESTION · CASE {caseId}</span>
        <h2 className="t-h1">Close the file without naming anyone?</h2>
        <p className="t-body secondary">The case is filed as undetermined. There is no taking it back.</p>
        {error && <p className="t-small accuse__error" role="alert">{error.message}</p>}
        <div className="accuse__row">
          <Button onClick={file} disabled={busy}>{busy ? 'FILING…' : '[ FILE AS UNDETERMINED ]'}</Button>
          <Button variant="secondary" onClick={back} disabled={busy}>BACK</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="accuse" aria-labelledby="present-q">
      <span className="t-label muted">THE ACCUSED</span>
      <p className="t-h1 accuse__who">{suspectById[accused].name}</p>
      <h2 id="present-q" className="t-h2">Present the evidence that proves your accusation</h2>
      <div className="accuse__evidence" role="group" aria-label="Evidence to present">
        {evidence.map((e) => (
          <button key={e.id} type="button" className={picked.has(e.id) ? 'accuse__card accuse__card--on' : 'accuse__card'} aria-pressed={picked.has(e.id)} onClick={() => toggle(e.id)}>
            <span className="t-label">{e.id} · {typeLabel(e.type)}</span>
            <span className="t-h3">{e.title}</span>
          </button>
        ))}
      </div>
      <p className="t-small muted">{picked.size} exhibit{picked.size === 1 ? '' : 's'} presented. Once filed, the case is closed.</p>
      {error && <p className="t-small accuse__error" role="alert">{error.message}</p>}
      <div className="accuse__row">
        <Button onClick={file} disabled={busy || picked.size === 0}>{busy ? 'FILING…' : '[ FILE ACCUSATION ]'}</Button>
        <Button variant="secondary" onClick={back} disabled={busy}>CHOOSE SOMEONE ELSE</Button>
      </div>
    </section>
  );
}

function Report({ fresh, onIntroDone }) {
  const { api, base, investigation } = useCase();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setReport(null); setError(null);
    api.getReport().then((r) => !cancelled && setReport(r)).catch((e) => !cancelled && setError(e));
    return () => { cancelled = true; };
  }, [investigation?.conclusion, attempt]);

  useEffect(() => {
    if (!report || fresh) return undefined;
    // Timed to land as the stamp's own CSS animation (0.4s delay, overshoot easing) hits impact.
    const t = setTimeout(playStampThud, 480);
    return () => clearTimeout(t);
  }, [report, fresh]);

  if (error) return <ErrorState error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!report) return <Loading label="COMPILING REPORT" />;
  if (fresh) return <CaseClosedIntro ending={report.ending} onDone={onIntroDone} />;

  const viewWhatHappened = () => document.getElementById(report.ending.whatHappened ? 'what-happened' : 'case-record')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="report">
      <EndingScreen caseId={report.case} title={report.title} ending={report.ending} accused={report.primarySuspect?.name}>
        <Button onClick={viewWhatHappened}>[ VIEW WHAT HAPPENED ]</Button>
        <NewInvestigation label="[ PLAY AGAIN ]" small={false} onDone={() => navigate(base)} />
        <Button to={`${base}/map`} variant="secondary">[ RETURN TO CASE ]</Button>
        <Button to="/cases" variant="secondary">[ CASE FILES ]</Button>
      </EndingScreen>

      {report.ending.whatHappened && <WhatHappened events={report.ending.whatHappened} />}

      <div className="report__grid" id="case-record">
        <div className="report__col">
          <ReportSection label="SECTION 01" heading="Theory" style={{ animationDelay: SECTION_DELAY(0) }}>
            <p>{report.theory || 'No theory was recorded.'}</p>
          </ReportSection>

          <ReportSection label="SECTION 02" heading="Evidence Presented" style={{ animationDelay: SECTION_DELAY(1) }} /* row 1 */>
            {report.supportingEvidence?.length ? (
              <ul className="report__list">
                {report.supportingEvidence.map((e) => (
                  <li key={e.id}>
                    <Link to={`${base}/evidence?select=${e.id}`}><strong>{e.id}</strong> · {e.title}</Link>
                    <span className="t-small"> {e.time}{e.location ? `, ${e.location}` : ''}. {e.summary}</span>
                  </li>
                ))}
              </ul>
            ) : <p>No evidence was presented.</p>}
          </ReportSection>

          <ReportSection label="SECTION 03" heading="Contradictions" style={{ animationDelay: SECTION_DELAY(2) }}>
            {report.contradictions?.length ? (
              <ul className="report__list">
                {report.contradictions.map((c) => (
                  <li key={`${c.assertionId}:${c.evidenceId}`}>
                    <strong>{c.suspectName}</strong>: “{c.claim}”
                    <span className="t-small"> Contradicted by {c.evidenceId}. {c.explanation}</span>
                  </li>
                ))}
              </ul>
            ) : <p>No contradictions were logged.</p>}
          </ReportSection>
        </div>

        <div className="report__col">
          <ReportSection label="SECTION 04" heading="Your Timeline" style={{ animationDelay: SECTION_DELAY(0) }} /* row 0, right column */>
            {report.timeline?.length ? (
              <ol className="report__timeline">
                {report.timeline.map((t) => (
                  <li key={t.id}><span className="t-h3">{t.time ?? formatWhen(t.timestamp)}</span><span className="t-small"><strong>{t.title}.</strong> {t.description}</span></li>
                ))}
              </ol>
            ) : <p>No timeline events were reviewed.</p>}
          </ReportSection>

          <ReportSection label="SECTION 05" heading="Connections" style={{ animationDelay: SECTION_DELAY(1) }} /* row 1, right column */>
            {report.connections?.length ? (
              <ul className="report__list">
                {report.connections.map((c, i) => (
                  <li key={i}><strong>{c.source}</strong> → <strong>{c.target}</strong> <span className="t-small">({c.relationship.replace(/_/g, ' ')})</span></li>
                ))}
              </ul>
            ) : <p>No links were drawn on the board.</p>}
          </ReportSection>
        </div>
      </div>

      <div className="report__actions">
        <Button to={`${base}/board`} variant="secondary">BACK TO THE BOARD</Button>
        <Stamp variant="viewed">FILED FOR THE RECORD</Stamp>
      </div>
    </div>
  );
}

export default function FinalReport() {
  const { investigation } = useCase();
  const [fresh, setFresh] = useState(false);
  const concluded = Boolean(investigation?.conclusion);

  return (
    <div className="page">
      <PageTitle kicker="I have to decide who did it." title="Accusation" meta={concluded ? 'CASE CLOSED' : 'NO ACCUSATION YET'} />
      {concluded ? <Report fresh={fresh} onIntroDone={() => setFresh(false)} /> : <Accusation onFiling={setFresh} />}
    </div>
  );
}
