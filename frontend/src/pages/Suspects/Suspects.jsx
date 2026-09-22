import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
      <p className="t-mono claim__text">“{assertion.claim}”</p>

      <AnimatePresence>
        {found.map((c) => (
          <motion.div 
            key={c.evidenceId} 
            className="contradiction-alert"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="contradiction-title t-label">
              <span className="blink-dot" /> ⚠ CONTRADICTION DETECTED
            </div>
            <hr className="rule" style={{borderColor: 'var(--warning)', opacity: 0.5}} />
            <p className="t-mono">CONFLICTING EVIDENCE: {c.evidenceId}</p>
            <p className="t-small secondary">{c.explanation}</p>
            <p className="t-mono" style={{color: 'var(--warning)', marginTop: '8px'}}>STATUS: UNRESOLVED</p>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="claim__check">
        <select className="select t-mono" value={evidenceId} onChange={(e) => { setEvidenceId(e.target.value); setResult(null); }} aria-label="Evidence to test this claim against">
          <option value="">Test against evidence…</option>
          {evidence.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.title}</option>)}
        </select>
        <Button variant="secondary" disabled={!evidenceId || busy} onClick={check}>{busy ? 'CHECKING…' : 'CHECK'}</Button>
      </div>

      {result && (
        <p className="claim__result t-mono" style={{ color: result.contradiction ? 'var(--warning)' : 'var(--text-secondary)' }} role="status">
          {result.contradiction
            ? `Contradiction confirmed against ${result.evidenceId}. ${result.explanation}`
            : result.reason}
        </p>
      )}
      {error && <p className="claim__result t-mono" style={{ color: 'var(--warning)' }} role="alert">{error.message}</p>}
    </li>
  );
}

function Dossier({ suspect, onClose }) {
  const { statementBySuspect, suspectById } = useCase();
  const statement = statementBySuspect[suspect.id];

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <motion.div 
        className="drawer dossier"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer__close">
          <button className="drawer__close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        
        <div className="drawer__content">
          <section className="dossier__profile">
            <div className="dossier__name">
              <span className="t-label muted">DOSSIER</span>
              <h2 className="t-h1">{suspect.name.toUpperCase()}</h2>
              <span className="t-mono muted">{suspect.age} YEARS OLD</span>
            </div>
            <hr className="rule" />
            <p className="t-small secondary">{suspect.background}</p>
            {[['MOTIVE', suspect.motive], ['OPPORTUNITY', suspect.opportunity], ['DEMEANOUR', suspect.personality], ['ACCESS', suspect.accessLevel]].map(([l, t]) => t && (
              <div key={l} className="dossier__field">
                <span className="t-label muted">{l}</span>
                <p className="t-mono secondary">{t}</p>
              </div>
            ))}
            {suspect.relationships?.length > 0 && (
              <div className="dossier__field">
                <span className="t-label muted">KNOWN ASSOCIATES</span>
                {suspect.relationships.map((r) => (
                  <p key={r.suspectId} className="t-mono secondary">
                    <Link to={`/suspects?select=${r.suspectId}`}>{suspectById[r.suspectId]?.name.toUpperCase() ?? r.suspectId}</Link> - {r.note}
                  </p>
                ))}
              </div>
            )}
          </section>

          <section className="dossier__statement">
            <div className="t-label muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>STATEMENT</span>
              {statement && <span>{formatDateTime(statement.takenAt).toUpperCase()}</span>}
            </div>
            <hr className="rule" style={{ marginTop: '8px', marginBottom: '16px' }} />
            {statement ? (
              <>
                <blockquote className="dossier__quote">{statement.text}</blockquote>
                <div style={{ marginTop: '32px' }}>
                  <span className="t-label muted">CLAIMS TO TEST</span>
                  <hr className="rule" style={{ marginTop: '8px', marginBottom: '16px', borderColor: 'var(--line-strong)' }} />
                  <ul className="claims">
                    {statement.assertions.map((a) => <Assertion key={a.id} assertion={a} />)}
                  </ul>
                </div>
              </>
            ) : (
              <p className="t-mono muted">NO STATEMENT ON FILE.</p>
            )}
          </section>
        </div>
      </motion.div>
    </div>
  );
}

export default function Suspects() {
  const { suspects, viewed, progress, markViewed } = useCase();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('select');
  const selected = suspects.find((s) => s.id === selectedId) ?? null;

  useEffect(() => { if (selected) markViewed('suspect', selected.id); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id) => setParams({ select: id }, { replace: true });
  const deselect = () => {
    const newParams = new URLSearchParams(params);
    newParams.delete('select');
    setParams(newParams, { replace: true });
  };

  return (
    <div className="page">
      <PageTitle title="SUSPECT DATABASE" meta={`${suspects.length} PERSONS OF INTEREST · ${progress.suspectsViewed} PROFILED`} />
      
      <motion.div className="suspect-row" layout>
        <AnimatePresence>
          {suspects.map((s) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              layout
            >
              <SuspectCard suspect={s} selected={s.id === selectedId} viewed={viewed.suspects.has(s.id)} onSelect={select} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {selected && <Dossier key={selected.id} suspect={selected} onClose={deselect} />}
      </AnimatePresence>
    </div>
  );
}
