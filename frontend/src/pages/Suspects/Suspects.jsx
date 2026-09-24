import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Stamp, PageTitle, EmptyState } from '../../components/ui/ui.jsx';
import SuspectCard from '../../components/SuspectCard/SuspectCard.jsx';
import Portrait from '../../components/Portrait/Portrait.jsx';
import { useGo, Scene } from '../../components/Scene/Scene.jsx';
import { formatClock, formatDateTime } from '../../utils/format.js';
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

/** What the detective has established about this person: facts on record, and claims still standing. */
function Established({ suspectId }) {
  const { api, investigation } = useCase();
  const [facts, setFacts] = useState(null);
  const [error, setError] = useState(null);
  const key = `${investigation.evidenceViewed.length}:${investigation.contradictionsFound.length}`;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api.getFacts(suspectId).then((f) => !cancelled && setFacts(f)).catch((e) => !cancelled && setError(e));
    return () => { cancelled = true; };
  }, [api, suspectId, key]);

  if (error) return <p className="t-small muted">Your notes on this person couldn’t be loaded. {error.message}</p>;
  if (!facts) return <p className="t-label muted">READING YOUR NOTES…</p>;
  return (
    <ul className="facts">
      {facts.lines.map((l, i) => (
        <li key={i} className={l.mark === '?' ? 'facts__open' : 'facts__known'}>
          <span className="t-label facts__mark" aria-label={l.mark === '?' ? 'Open' : 'Established'}>{l.mark}</span>
          <span className="t-small">{l.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Where to find someone, and the choice to go and question them in person. */
function FindThem({ suspect, place }) {
  const { base, investigation, travel } = useCase();
  const go = useGo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const closed = Boolean(investigation.conclusion);
  const cost = investigation.clock?.costs?.travel;
  if (!place) return null;

  async function find() {
    if (place.here) { go(`${base}/place/${place.id}?talk=${suspect.id}`); return; }
    setBusy(true); setError(null);
    try {
      const r = await travel(place.id);
      go(`${base}/place/${place.id}?talk=${suspect.id}`, { kicker: 'ARRIVING AT', title: place.name, sub: formatClock(r.investigation.clock.now) });
    } catch (e) {
      setError(e); playDenied(); setBusy(false);
    }
  }

  return (
    <div className="dossier__find">
      <span className="t-label muted">WHERE TO FIND THEM</span>
      <span className="t-h3">{place.name}</span>
      {!closed && (
        <Button onClick={find} disabled={busy || (!place.here && investigation.clock?.timeUp)}>
          {busy ? 'ON YOUR WAY…' : place.here ? 'QUESTION THEM' : `GO AND FIND THEM${cost ? ` · ${cost} MIN` : ''}`}
        </Button>
      )}
      {error && <p className="t-small" role="alert">{error.message}</p>}
    </div>
  );
}

function Dossier({ suspect, place }) {
  const { base, statementBySuspect, suspectById } = useCase();
  const statement = statementBySuspect[suspect.id];

  return (
    <div className="dossier panel">
      <section className="dossier__profile">
        <div className="dossier__lead">
          <Portrait suspect={suspect} className="dossier__portrait" />
          <div className="dossier__name">
            <span className="t-label muted">DOSSIER · {suspect.id}</span>
            <h2 className="t-h2">{suspect.name} · {suspect.age}</h2>
            <span className="t-mono secondary">{suspect.role}</span>
            <FindThem suspect={suspect} place={place} />
          </div>
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
                <Link to={`${base}/people?select=${r.suspectId}`}>{suspectById[r.suspectId]?.name ?? r.suspectId}</Link>: {r.note}
              </p>
            ))}
          </div>
        )}
      </section>

      <hr className="dossier__divider" />

      <section className="dossier__statement">
        <span className="t-label muted">WHAT YOU’VE ESTABLISHED</span>
        <Established suspectId={suspect.id} />
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

function badgeFor(id, investigation, viewed) {
  if (investigation.interviewedSuspects.includes(id)) return investigation.interviewLeads[id] > 0 ? 'QUESTIONS LEFT' : 'INTERVIEWED';
  return viewed.suspects.has(id) ? 'PROFILED' : null;
}

export default function Suspects() {
  const { api, suspects, viewed, investigation, markViewed } = useCase();
  const [params, setParams] = useSearchParams();
  const [places, setPlaces] = useState([]);
  const selectedId = params.get('select');
  const selected = suspects.find((s) => s.id === selectedId) ?? null;
  const placeOf = (id) => places.find((p) => p.people.some((x) => x.id === id));

  useEffect(() => { api.listPlaces().then(setPlaces).catch(() => setPlaces([])); }, [api, investigation.locationId]);
  useEffect(() => { if (selected) markViewed('suspect', selected.id); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Scene className="page">
      <div data-reveal><PageTitle kicker="Who should I talk to?" title="People" meta={`${suspects.length} PERSONS OF INTEREST · ${investigation.interviewedSuspects.length} INTERVIEWED`} /></div>
      <div className="suspect-row" data-reveal>
        {suspects.map((s) => (
          <SuspectCard key={s.id} suspect={s} selected={s.id === selectedId} badge={badgeFor(s.id, investigation, viewed)} onSelect={(id) => setParams({ select: id }, { replace: true })} />
        ))}
      </div>
      {selected
        ? <Dossier key={selected.id} suspect={selected} place={placeOf(selected.id)} />
        : <EmptyState title="Choose someone to look into">Open a dossier to read what you know about them. To question them, you'll have to go and find them.</EmptyState>}
    </Scene>
  );
}
