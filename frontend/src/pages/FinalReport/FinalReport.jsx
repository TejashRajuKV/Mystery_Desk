import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Stamp, PageTitle, Loading, ErrorState, Field } from '../../components/ui/ui.jsx';
import ReportSection from '../../components/ReportSection/ReportSection.jsx';
import { formatWhen } from '../../utils/format.js';
import { playDenied, playStampThud } from '../../utils/sound.js';
import './FinalReport.css';

// Indexed by row, not DOM order — the two report columns cascade down together,
// like a dossier's pages dropping into place, rather than the right column waiting on the left.
const SECTION_DELAY = (row) => `${120 + row * 100}ms`;

function ConclusionForm({ onDone, onCancel }) {
  const { suspects, evidence, investigation, saveTheory, submitConclusion, caseId } = useCase();
  const previous = investigation?.conclusion;
  const [suspectId, setSuspectId] = useState(previous?.suspectId ?? '');
  const [picked, setPicked] = useState(() => new Set(previous?.evidenceIds ?? []));
  const [theory, setTheory] = useState(investigation?.theory ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (id) => setPicked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await saveTheory(theory);
      await submitConclusion({ suspectId, evidenceIds: [...picked] });
      onDone();
    } catch (err) {
      setError(err);
      playDenied();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="conclude" onSubmit={submit}>
      <div className="conclude__intro panel--paper">
        <span className="t-label">FORM {caseId}-C · CONCLUSION OF INVESTIGATION</span>
        <h2 className="t-h1">Name the culprit</h2>
        <hr className="rule" />
        <p className="t-small">Choose one suspect, cite the exhibits that prove it, and set out your theory. Your conclusion is checked against the case files.</p>
      </div>

      <fieldset className="conclude__block panel">
        <legend className="t-label muted">PRIMARY SUSPECT</legend>
        <div className="conclude__suspects">
          {suspects.map((s) => (
            <label key={s.id} className={suspectId === s.id ? 'pick pick--on' : 'pick'}>
              <input type="radio" name="suspect" value={s.id} checked={suspectId === s.id} onChange={() => setSuspectId(s.id)} />
              <span className="t-h3">{s.name}</span>
              <span className="t-mono muted">{s.role}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="conclude__block panel">
        <legend className="t-label muted">SUPPORTING EVIDENCE · {picked.size} CITED</legend>
        <div className="conclude__evidence">
          {evidence.map((e) => (
            <label key={e.id} className={picked.has(e.id) ? 'pick pick--on pick--row' : 'pick pick--row'}>
              <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} />
              <span className="t-label">{e.id}</span>
              <span className="t-small">{e.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="conclude__block panel">
        <Field label="YOUR THEORY">
          <textarea className="textarea" value={theory} onChange={(e) => setTheory(e.target.value)} placeholder="How did it happen? Who, when, how, and why?" />
        </Field>
      </div>

      {error && <p className="t-small conclude__error" role="alert">{error.message}</p>}
      <div className="conclude__actions">
        <Button type="submit" disabled={busy || !suspectId || picked.size === 0}>{busy ? 'FILING…' : 'SUBMIT CONCLUSION'}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel}>CANCEL</Button>}
        <span className="t-small muted">Case #{caseId}</span>
      </div>
    </form>
  );
}

function Report({ onRevise }) {
  const { investigation } = useCase();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setReport(null); setError(null);
    api.getReport().then((r) => !cancelled && setReport(r)).catch((e) => !cancelled && setError(e));
    return () => { cancelled = true; };
  }, [investigation?.conclusion]);

  useEffect(() => {
    if (!report) return;
    // Timed to land as the stamp's own CSS animation (0.4s delay, overshoot easing) hits impact.
    const t = setTimeout(playStampThud, 480);
    return () => clearTimeout(t);
  }, [report]);

  if (error) return <ErrorState error={error} onRetry={onRevise} />;
  if (!report) return <Loading label="COMPILING REPORT" />;

  return (
    <div className="report">
      <header className="report__hero">
        <div>
          <span className="t-label muted">FINAL REPORT · CASE #{report.case}</span>
          <h2 className="t-display report__title">{report.title}</h2>
          <p className="t-label secondary">PRIMARY SUSPECT</p>
          <p className="t-h1 report__suspect">{report.primarySuspect?.name}</p>
        </div>
        <div className="report__stamp" role="img" aria-label="Case solved">CASE SOLVED</div>
      </header>

      <div className="report__grid">
        <div className="report__col">
          <ReportSection label="SECTION 01" heading="Theory" style={{ animationDelay: SECTION_DELAY(0) }}>
            <p>{report.theory || 'No theory was recorded.'}</p>
          </ReportSection>

          <ReportSection label="SECTION 02" heading="Supporting Evidence" style={{ animationDelay: SECTION_DELAY(1) }} /* row 1 */>
            {report.supportingEvidence?.length ? (
              <ul className="report__list">
                {report.supportingEvidence.map((e) => (
                  <li key={e.id}>
                    <Link to={`/evidence?select=${e.id}`}><strong>{e.id}</strong> · {e.title}</Link>
                    <span className="t-small"> {e.time}{e.location ? `, ${e.location}` : ''}. {e.summary}</span>
                  </li>
                ))}
              </ul>
            ) : <p>No evidence cited.</p>}
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
          <ReportSection label="SECTION 04" heading="Reconstructed Timeline" style={{ animationDelay: SECTION_DELAY(0) }} /* row 0, right column */>
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
        <Button variant="secondary" onClick={onRevise}>REVISE CONCLUSION</Button>
        <Button to="/board" variant="secondary">BACK TO THE BOARD</Button>
        <Stamp variant="viewed">FILED FOR THE RECORD</Stamp>
      </div>
    </div>
  );
}

export default function FinalReport() {
  const { investigation } = useCase();
  const [revising, setRevising] = useState(false);
  const concluded = Boolean(investigation?.conclusion);

  return (
    <div className="page">
      <PageTitle title="Final Report" meta={concluded ? 'CONCLUSION FILED' : 'NO CONCLUSION YET'} />
      {concluded && !revising
        ? <Report onRevise={() => setRevising(true)} />
        : <ConclusionForm onDone={() => setRevising(false)} onCancel={concluded ? () => setRevising(false) : undefined} />}
    </div>
  );
}
