import { typeLabel } from '../../utils/format.js';
import './EvidencePresentation.css';

/** The exhibits in the case file, laid out to pick one to put on the table. */
export function EvidenceTray({ evidence, onPick, onCancel, disabled }) {
  return (
    <section className="tray" aria-label="Present evidence">
      <div className="tray__head">
        <span className="t-label">WHAT DO YOU PUT ON THE TABLE?</span>
        <button type="button" className="stamp" onClick={onCancel} disabled={disabled}>✕ PUT IT AWAY</button>
      </div>
      <div className="tray__grid">
        {evidence.map((e) => (
          <button key={e.id} type="button" className="tray__card" onClick={() => onPick(e)} disabled={disabled}>
            <span className="t-label">{e.id} · {typeLabel(e.type)}</span>
            <span className="t-h3">{e.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The moment an exhibit lands on the table: the room darkens and the card slams down. */
export function PresentationMoment({ item }) {
  return (
    <div className="present" role="status" aria-live="assertive">
      <div className="present__card">
        <span className="t-label">EXHIBIT {item.id} · {typeLabel(item.type)}</span>
        <span className="t-h1 present__title">{item.title}</span>
        {item.summary && <span className="t-small">{item.summary}</span>}
      </div>
    </div>
  );
}

/** What a presented exhibit just broke: the claim, and the record it runs into. */
export function ContradictionBanner({ contradictions, suspectName }) {
  return contradictions.map((c) => (
    <div key={`${c.assertionId}:${c.evidenceId}`} className="clash" role="alert">
      <span className="t-label clash__head">⚠ STATEMENT CONTRADICTION · {c.assertionId} vs {c.evidenceId}</span>
      <p className="t-body clash__claim">{suspectName} claimed: “{c.claim}”</p>
      <p className="t-small clash__why">{c.explanation}</p>
    </div>
  ));
}
