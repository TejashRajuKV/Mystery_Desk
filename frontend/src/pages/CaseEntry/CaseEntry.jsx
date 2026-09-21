import { useState } from 'react';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Stamp } from '../../components/ui/ui.jsx';
import { CASE_ID } from '../../services/api.js';
import { monthYear } from '../../utils/format.js';
import './CaseEntry.css';

const LOOP = [
  'Explore the evidence',
  'Investigate the suspects',
  'Reconstruct the timeline',
  'Connect clues on the board',
  'Expose contradictions',
  'Form a theory and ask the assistant',
  'Submit your conclusion',
];

export default function CaseEntry() {
  const { status, caseInfo, error, reload } = useCase();
  const [help, setHelp] = useState(false);
  const ready = status === 'ready' && caseInfo;

  return (
    <div className="entry">
      <div className="entry__blinds" aria-hidden="true" />
      <span className="t-display entry__numeral" aria-hidden="true">{caseInfo?.id ?? CASE_ID}</span>

      <div className="entry__content">
        <div className="entry__tags">
          <Stamp>CASE #{caseInfo?.id ?? CASE_ID}</Stamp>
          {ready && <Stamp>{caseInfo.classification}</Stamp>}
          {ready && <Stamp>{caseInfo.status.toUpperCase()}</Stamp>}
        </div>
        <p className="t-label muted entry__place">
          {ready ? `${caseInfo.company.toUpperCase()}  ·  ${caseInfo.site.toUpperCase()}  ·  ${monthYear(caseInfo.openedAt)}` : ''}
        </p>
        <h1 className="t-display entry__title">{ready ? caseInfo.title : ''}</h1>
        <hr className="entry__rule" />
        <p className="t-body secondary entry__brief">
          {ready ? caseInfo.summary : status === 'error' ? 'The case file could not be loaded.' : 'Retrieving the case file…'}
        </p>

        {status === 'error' && (
          <p className="t-small entry__error" role="alert">{error?.message}. Is the API running?</p>
        )}

        <div className="entry__actions">
          {status === 'error'
            ? <Button onClick={reload}>TRY AGAIN</Button>
            : <Button to="/dashboard" aria-disabled={!ready}>OPEN CASE FILE</Button>}
          <Button variant="secondary" onClick={() => setHelp((v) => !v)} aria-expanded={help}>HOW IT WORKS</Button>
        </div>

        {help && (
          <ol className="entry__loop t-mono">
            {LOOP.map((step) => <li key={step}>{step}</li>)}
          </ol>
        )}
      </div>

      <footer className="entry__foot t-label muted">
        <span>LEAD INVESTIGATOR: YOU</span>
        <span>{ready ? caseInfo.suspectCount : '—'} SUSPECTS</span>
        <span>{ready ? caseInfo.evidenceCount : '—'} EXHIBITS</span>
        <span>{ready ? caseInfo.locationCount : '—'} LOCATIONS</span>
      </footer>
    </div>
  );
}
