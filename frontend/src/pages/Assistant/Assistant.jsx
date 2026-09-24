import { useEffect, useMemo, useRef, useState } from 'react';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, PageTitle, Loading, ErrorState, Field } from '../../components/ui/ui.jsx';
import AssistantMessage from '../../components/AssistantPanel/AssistantPanel.jsx';
import { pinAll } from '../../utils/boardStore.js';
import { playDenied, playPin, playSuccess, playTypewriterKey } from '../../utils/sound.js';
import './Assistant.css';

/** One filed note: the analysis, what it rests on, and what the detective can do with it. */
function Note({ note, logged, lookups, onLogContradiction, onPin }) {
  const r = note.response;
  const pinnable = [...(r.relatedEvidence ?? []), ...(r.relatedSuspects ?? []), ...(r.relatedEvents ?? [])];
  return (
    <article className="note">
      <header className="note__head">
        <span className="t-label">NOTE {String(note.n).padStart(2, '0')}</span>
        <h3 className="t-h3">{r.title}</h3>
      </header>
      <AssistantMessage message={{ role: 'assistant', author: 'FROM YOUR NOTES', text: r.answer, response: r }} logged={logged} lookups={lookups} onLogContradiction={onLogContradiction} />
      {r.facts?.map((f) => (
        <div key={f.suspectId} className="note__facts">
          <span className="t-label muted">WHAT YOU’VE ESTABLISHED · {f.name.toUpperCase()}</span>
          <ul>
            {f.lines.map((l, i) => (
              <li key={i} className={l.mark === '?' ? 'note__open' : ''}><span className="t-label">{l.mark}</span> <span className="t-small">{l.text}</span></li>
            ))}
          </ul>
        </div>
      ))}
      {pinnable.length > 0 && (
        <Button small variant="secondary" onClick={() => onPin(pinnable)} disabled={note.pinned}>
          {note.pinned ? 'PINNED TO THE BOARD' : '[ PIN TO BOARD ]'}
        </Button>
      )}
    </article>
  );
}

/** Detective's Notes: predefined lines of enquiry, answered from what has been examined. No typing. */
export default function Assistant() {
  const { api, evidence, suspects, timeline, caseInfo, statements, evidenceById, suspectById, eventById, investigation, flagContradiction, saveTheory, notify } = useCase();
  const [prompts, setPrompts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pick, setPick] = useState(['', '']);
  const [logged, setLogged] = useState(() => new Set());
  const [theory, setTheory] = useState(investigation.theory);
  const [theoryState, setTheoryState] = useState('saved');
  const topRef = useRef(null);
  const seq = useRef(0);

  const loadPrompts = () => {
    setLoadError(null);
    api.getNotePrompts().then(setPrompts).catch(setLoadError);
  };
  useEffect(loadPrompts, []);

  const clues = useMemo(() => [
    { label: 'Evidence', items: evidence.map((e) => [e.id, `${e.id} · ${e.title}`]) },
    { label: 'People', items: suspects.map((s) => [s.id, `${s.id} · ${s.name}`]) },
    { label: 'Places', items: (caseInfo.locations ?? []).map((l) => [l.id, `${l.id} · ${l.name}`]) },
    { label: 'Moments', items: timeline.map((t) => [t.id, `${t.time} · ${t.title}`]) },
    { label: 'Claims', items: statements.flatMap((s) => s.assertions.map((a) => [a.id, `${a.id} · “${a.claim}”`])) },
  ], [evidence, suspects, caseInfo, timeline, statements]);

  async function consult(prompt) {
    if (busy) return;
    setBusy(true); setError(null);
    const tick = setInterval(playTypewriterKey, 380);
    try {
      const response = await api.consultNote(prompt.id, prompt.picks ? pick : undefined);
      seq.current += 1;
      setNotes((prev) => [{ n: seq.current, response, pinned: false }, ...prev]);
      if (response.contradiction) playSuccess();
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      setError(e); playDenied();
    } finally {
      clearInterval(tick); setBusy(false);
    }
  }

  async function logContradiction({ assertionId, evidenceId }) {
    try {
      const result = await flagContradiction(assertionId, evidenceId);
      if (result.contradiction) { setLogged((prev) => new Set(prev).add(`${assertionId}:${evidenceId}`)); playSuccess(); } else playDenied();
    } catch (e) {
      setError(e); playDenied();
    }
  }

  function pin(n, ids) {
    const added = pinAll(ids);
    setNotes((prev) => prev.map((x) => (x.n === n ? { ...x, pinned: true } : x)));
    playPin();
    notify('CASE BOARD UPDATED', added ? `${added} card${added === 1 ? '' : 's'} pinned from your notes` : 'Already on the board');
  }

  async function keepTheory() {
    setTheoryState('saving');
    try { await saveTheory(theory); setTheoryState('saved'); } catch (e) { setError(e); setTheoryState('dirty'); playDenied(); }
  }

  const lookups = { evidenceById, suspectById, eventById };
  const connect = prompts?.find((p) => p.picks);

  return (
    <div className="page notes">
      <PageTitle kicker="What am I missing?" title="Detective’s Notes" meta="WORKS FROM WHAT YOU HAVE EXAMINED" />

      <div className="notes__layout">
        <aside className="notes__prompts">
          <section className="panel notes__panel">
            <span className="t-label muted">LINES OF ENQUIRY</span>
            {loadError && <ErrorState error={loadError} onRetry={loadPrompts} />}
            {!prompts && !loadError && <Loading label="OPENING THE NOTEBOOK" />}
            {prompts && (
              <ol className="notes__list">
                {prompts.filter((p) => !p.picks).map((p) => (
                  <li key={p.id}><button type="button" className="notes__prompt t-small" onClick={() => consult(p)} disabled={busy}>{p.label}</button></li>
                ))}
              </ol>
            )}
          </section>

          {connect && (
            <section className="panel notes__panel">
              <span className="t-label muted">{connect.label.toUpperCase()}</span>
              {[0, 1].map((i) => (
                <select key={i} className="select" value={pick[i]} aria-label={`Clue ${i + 1}`}
                  onChange={(e) => setPick((prev) => (i ? [prev[0], e.target.value] : [e.target.value, prev[1]]))}>
                  <option value="">Choose a clue…</option>
                  {clues.map((g) => <optgroup key={g.label} label={g.label}>{g.items.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</optgroup>)}
                </select>
              ))}
              <Button small block onClick={() => consult(connect)} disabled={busy || !pick[0] || !pick[1] || pick[0] === pick[1]}>COMPARE THEM</Button>
            </section>
          )}

          <section className="panel notes__panel">
            <Field label="YOUR WORKING THEORY">
              <textarea className="textarea" value={theory} placeholder="Optional. Jot down how you think it happened."
                onChange={(e) => { setTheory(e.target.value); setTheoryState('dirty'); }} />
            </Field>
            <Button small variant="secondary" onClick={keepTheory} disabled={theoryState !== 'dirty'}>
              {theoryState === 'saving' ? 'FILING…' : theoryState === 'saved' ? 'THEORY FILED' : 'FILE THEORY'}
            </Button>
          </section>
        </aside>

        <section className="notes__book" aria-label="Notebook" aria-live="polite">
          <div ref={topRef} />
          {busy && <p className="t-label muted notes__thinking">THINKING IT THROUGH<span className="dots" aria-hidden="true" /></p>}
          {error && <p className="t-small notes__error" role="alert">{error.message}</p>}
          {notes.length === 0 && !busy ? (
            <div className="note note--empty">
              <span className="t-label">THE NOTEBOOK IS OPEN</span>
              <p className="t-body">Pick a line of enquiry. Your notes only go as far as what you have actually examined, interviewed and connected. They will never tell you who did it.</p>
            </div>
          ) : notes.map((note) => (
            <Note key={note.n} note={note} logged={logged} lookups={lookups} onLogContradiction={logContradiction} onPin={(ids) => pin(note.n, ids)} />
          ))}
        </section>
      </div>
    </div>
  );
}
