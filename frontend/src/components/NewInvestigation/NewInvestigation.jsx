import { useState } from 'react';
import { useCase } from '../../hooks/useCase.jsx';
import { Button } from '../ui/ui.jsx';
import { playDenied } from '../../utils/sound.js';
import './NewInvestigation.css';

/** Wipes the investigation after a second, explicit yes. `onDone` runs once the fresh case has loaded. */
export default function NewInvestigation({ label = 'NEW INVESTIGATION', small = true, onDone }) {
  const { resetInvestigation } = useCase();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function reset() {
    setBusy(true); setError(null);
    try {
      await resetInvestigation();
      onDone?.();
    } catch (e) {
      setError(e); playDenied(); setBusy(false);
    }
  }

  if (!asking) return <Button variant="secondary" small={small} onClick={() => setAsking(true)}>{label}</Button>;
  return (
    <div className="restart" role="alertdialog" aria-label="Start a new investigation">
      <p className="t-small">Start over? Every interview, clue, link and note is wiped. The case file goes back to the morning it was opened.</p>
      <div className="restart__row">
        <Button small onClick={reset} disabled={busy}>{busy ? 'CLEARING THE DESK…' : 'YES, START OVER'}</Button>
        <Button small variant="secondary" onClick={() => setAsking(false)} disabled={busy}>KEEP THIS CASE</Button>
      </div>
      {error && <p className="t-small" role="alert">{error.message}</p>}
    </div>
  );
}
