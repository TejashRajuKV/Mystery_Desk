import { useEffect } from 'react';
import { useCase } from '../../hooks/useCase.jsx';
import './GameNotice.css';

const SHOWN_MS = 4200;

function Notice({ notice, onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(notice.id), SHOWN_MS);
    return () => clearTimeout(t);
  }, [notice.id, onDone]);
  return (
    <li className="notice" role="status">
      <button type="button" className="notice__body" onClick={() => onDone(notice.id)} aria-label={`${notice.kind}. ${notice.detail}. Dismiss`}>
        <span className="t-label notice__kind">{notice.kind}</span>
        <span className="t-small notice__detail">{notice.detail}</span>
      </button>
    </li>
  );
}

/** Short case-file notices that slide in and out; the player never has to stop to read them. */
export default function GameNotice() {
  const { notices, dismissNotice } = useCase();
  return (
    <ol className="notices" aria-live="polite">
      {notices.map((n) => <Notice key={n.id} notice={n} onDone={dismissNotice} />)}
    </ol>
  );
}
