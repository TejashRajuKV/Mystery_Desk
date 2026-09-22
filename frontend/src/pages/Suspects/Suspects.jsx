import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Stamp, PageTitle, EmptyState } from '../../components/ui/ui.jsx';
import SuspectCard from '../../components/SuspectCard/SuspectCard.jsx';
import { formatDateTime } from '../../utils/format.js';
import { playDenied, playSuccess } from '../../utils/sound.js';
import './Suspects.css';

/** One claim from a statement, with a control to test it against an exhibit. */
function Assertion({ assertion }) {
  const { evidence, contradictionsFound, flagContradiction } = useCase();
  const [evidenceId, setEvidenceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const found = contradictionsFound.filter((c) => c.assertionId === assertion.id);

  async function check() {
    if (!evidenceId) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const r = { evidenceId, ...(await flagContradiction(assertion.id, evidenceId)) };
      setResult(r);
      r.contradiction ? playSuccess() : playDenied();
    } catch (e) {
      setError(e);
      playDenied();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="claim">
      <p className="t-small claim__text">“{assertion.claim}”</p>

      {found.map((c) => (
        <div key={c.evidenceId} className="claim__found">
          <Stamp variant="alert">CONTRADICTED · {c.evidenceId}</Stamp>
          <p className="t-small secondary">{c.explanation}</p>
          {c.mitigatedBy?.length > 0 && (
            <p className="t-small muted">Possible innocent explanation: {c.mitigatedBy.join(', ')}.</p>
          )}
        </div>
      ))}

      <div className="claim__check">
        <select className="select" value={evidenceId} onChange={(e) => { setEvidenceId(e.target.value); setResult(null); }} aria-label="Evidence to test this claim against">
          <option value="">Test against evidence…</option>
          {evidence.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.title}</option>)}
        </select>
        <Button small variant="secondary" disabled={!evidenceId || busy} onClick={check}>{busy ? 'CHECKING…' : 'CHECK'}</Button>
      </div>

      {result && (
        <p className={result.contradiction ? 'claim__result claim__result--yes t-small' : 'claim__result t-small'} role="status">
          {result.contradiction
            ? `Contradiction confirmed against ${result.evidenceId}. ${result.explanation}`
            : result.reason}
        </p>
      )}
      {error && <p className="claim__result t-small" role="alert">{error.message}</p>}
    </li>
  );
}

function Dossier({ suspect }) {
  const { statementBySuspect, suspectById } = useCase();
  const statement = statementBySuspect[suspect.id];

  return (
    <div className="dossier panel">
      <section className="dossier__profile">
        <div className="dossier__name">
          <span className="t-label muted">DOSSIER</span>
          <h2 className="t-h2">{suspect.name} · {suspect.age}</h2>
        </div>
        <p className="t-small secondary">{suspect.background}</p>
        {[['MOTIVE', suspect.motive], ['OPPORTUNITY', suspect.opportunity], ['DEMEANOUR', suspect.personality], ['ACCESS', suspect.accessLevel]].map(([l, t]) => t && (
          <div key={l} className="dossier__field">
            <span className="t-label muted">{l}</span>
            <p className="t-small secondary">{t}</p>
          </div>
        ))}
        {suspect.relationships?.length > 0 && (
          <div className="dossier__field">
            <span className="t-label muted">KNOWN ASSOCIATES</span>
            {suspect.relationships.map((r) => (
              <p key={r.suspectId} className="t-small secondary">
                <Link to={`/suspects?select=${r.suspectId}`}>{suspectById[r.suspectId]?.name ?? r.suspectId}</Link>: {r.note}
              </p>
            ))}
          </div>
        )}
      </section>

      <hr className="dossier__divider" />

      <section className="dossier__statement">
        <span className="t-label muted">STATEMENT{statement ? ` · ${formatDateTime(statement.takenAt).toUpperCase()}` : ''}</span>
        {statement ? (
          <>
            <blockquote className="t-body dossier__quote">{statement.text}</blockquote>
            <span className="t-label muted">CLAIMS TO TEST</span>
            <ul className="claims">
              {statement.assertions.map((a) => <Assertion key={a.id} assertion={a} />)}
            </ul>
          </>
        ) : (
          <EmptyState title="No statement on file" />
        )}
      </section>
    </div>
  );
}

export default function Suspects() {
  const { suspects, viewed, progress, markViewed } = useCase();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('select');
  const selected = suspects.find((s) => s.id === selectedId) ?? null;

  useEffect(() => { if (selected) markViewed('suspect', selected.id); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page">
      <PageTitle title="Suspects" meta={`${suspects.length} PERSONS OF INTEREST · ${progress.suspectsViewed} PROFILED`} />
      <div className="suspect-row">
        {suspects.map((s) => (
          <SuspectCard key={s.id} suspect={s} selected={s.id === selectedId} viewed={viewed.suspects.has(s.id)} onSelect={(id) => setParams({ select: id }, { replace: true })} />
        ))}
      </div>
      {selected
        ? <Dossier key={selected.id} suspect={selected} />
        : <EmptyState title="Select a suspect">Open a dossier to read their profile and test their statement against the evidence.</EmptyState>}
    </div>
  );
}
