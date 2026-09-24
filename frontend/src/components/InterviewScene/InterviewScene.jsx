import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Loading, ErrorState, EmptyState } from '../ui/ui.jsx';
import Portrait from '../Portrait/Portrait.jsx';
import DialogueBox from '../DialogueBox/DialogueBox.jsx';
import ChoiceList from '../ChoiceList/ChoiceList.jsx';
import { EvidenceTray, PresentationMoment, ContradictionBanner } from '../EvidencePresentation/EvidencePresentation.jsx';
import { formatDateTime } from '../../utils/format.js';
import { playContradiction, playDenied, playPaperRustle, playPresent, playTransition } from '../../utils/sound.js';
import './InterviewScene.css';

// Long enough for the card to land and be read before the suspect answers.
const PRESENT_BEAT_MS = 1400;
const PRESENT = { id: '__present', label: 'Present evidence', tone: 'present' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The interrogation: the suspect fills the screen, and everything the detective does is a choice. */
export default function InterviewScene({ suspect, onExit }) {
  const { api, base, caseId, evidence, locationById, investigation, askDialogueChoice, presentEvidence } = useCase();
  const [node, setNode] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [intro, setIntro] = useState(true);
  const [typed, setTyped] = useState(false);
  const [tray, setTray] = useState(false);
  const [presenting, setPresenting] = useState(null);
  const [turn, setTurn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const sceneRef = useRef(null);
  const closed = Boolean(investigation.conclusion);
  const where = locationById?.[investigation.locationId]?.name?.toUpperCase() ?? 'IN PERSON';
  const when = investigation.clock?.now;

  const load = useCallback(async () => {
    setStatus('loading'); setLoadError(null);
    try {
      setNode(await api.getDialogue(suspect.id));
      setStatus('ready');
    } catch (e) {
      setLoadError(e);
      setStatus(e.status === 404 ? 'none' : 'error');
    }
  }, [api, suspect.id]);

  useEffect(() => { load(); playTransition(); }, [load]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sceneRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || presenting) return;
      if (tray) setTray(false); else onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tray, presenting, onExit]);

  const showNode = (next, t) => { setTyped(false); setNode(next); setTurn(t); };

  async function say(choice) {
    if (choice.id === PRESENT.id) { setTray(true); playPaperRustle(); return; }
    setBusy(true); setError(null);
    try {
      const r = await askDialogueChoice(suspect.id, choice.id);
      showNode(r.dialogue, { n: (turn?.n ?? 0) + 1, asked: choice.label, ended: r.ended, effects: r.effects });
      if (r.effects.contradictions.length) playContradiction();
    } catch (e) {
      setError(e); playDenied();
      if (e.status === 422) load();
    } finally {
      setBusy(false);
    }
  }

  async function present(item) {
    setTray(false); setBusy(true); setError(null);
    setPresenting(item);
    playPresent();
    try {
      const [r] = await Promise.all([presentEvidence(suspect.id, item.id), wait(PRESENT_BEAT_MS)]);
      showNode(r.dialogue, { n: (turn?.n ?? 0) + 1, presented: item, effects: r.effects, unmoved: r.presented?.reaction === 'unmoved' });
      if (r.effects.contradictions.length) setTimeout(playContradiction, 250);
    } catch (e) {
      setError(e); playDenied();
    } finally {
      setPresenting(null); setBusy(false);
    }
  }

  const choices = node && !closed
    ? [...node.choices.filter((c) => !c.leaves), ...(node.canPresent && evidence.length ? [PRESENT] : []), ...node.choices.filter((c) => c.leaves).map((c) => ({ ...c, tone: 'leave' }))]
    : [];

  let talk;
  if (status === 'loading') talk = <Loading label="BRINGING THEM IN" />;
  else if (status === 'error') talk = <ErrorState error={loadError} onRetry={load} />;
  else if (status === 'none') talk = <EmptyState title="No interview on file">This person hasn’t been brought in for questioning.</EmptyState>;
  else if (turn?.ended) {
    talk = (
      <div className="scene__out">
        <p className="t-h2">The interview is over.</p>
        <p className="t-small secondary">{suspect.name} is shown out. What they said stays on the record.</p>
        <div className="scene__row">
          <Button onClick={onExit}>RETURN TO THE CASE FILE</Button>
          {!closed && <Button variant="secondary" onClick={() => { setTurn(null); setTyped(false); }}>CALL THEM BACK IN</Button>}
        </div>
      </div>
    );
  } else {
    talk = (
      <>
        {turn?.asked && <p className="t-label scene__you">YOU · {turn.asked}</p>}
        {turn?.presented && <p className="t-label scene__you">YOU PUT {turn.presented.id} · {turn.presented.title.toUpperCase()} ON THE TABLE</p>}
        <DialogueBox
          key={`${node.nodeId}:${turn?.n ?? 0}`}
          speaker={node.speakerName} role={suspect.role} mood={node.mood}
          narration={node.narration} text={node.text} voice={node.voice}
          onTyped={() => setTyped(true)}
        />
        {typed && turn?.effects && (
          <>
            <ContradictionBanner contradictions={turn.effects.contradictions} suspectName={suspect.name} />
            {turn.effects.unlockedEvidence.length > 0 && (
              <div className="scene__clue" role="status">
                <span className="t-label">NEW CLUE DISCOVERED</span>
                <div className="scene__chips">
                  {turn.effects.unlockedEvidence.map((e) => (
                    <Link key={e.id} to={`${base}/evidence?select=${e.id}`} className="stamp stamp--alert">{e.id} · {e.title}</Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {closed && <p className="t-small muted">The case is closed. The accusation on file is final.</p>}
        {typed && !closed && (
          tray
            ? <EvidenceTray evidence={evidence} onPick={present} onCancel={() => setTray(false)} disabled={busy} />
            : <ChoiceList choices={choices} onChoose={say} disabled={busy} />
        )}
        {error && <p className="t-small scene__error" role="alert">{error.message}</p>}
      </>
    );
  }

  // Portalled to <body>: the page's entrance animation leaves a transform that would trap a fixed overlay.
  return createPortal(
    <div className="scene" role="dialog" aria-modal="true" aria-label={`Interview with ${suspect.name}`} ref={sceneRef} tabIndex={-1}>
      <header className="scene__bar">
        <span className="t-label">CASE {caseId} · {where}{when ? ` · ${formatDateTime(when).toUpperCase()}` : ''}</span>
        <button type="button" className="stamp" onClick={onExit}>✕ WALK AWAY</button>
      </header>

      <div className="scene__body">
        <div className="scene__subject">
          <Portrait suspect={suspect} mood={node?.mood ?? 'neutral'} className="scene__portrait" />
          <div className="scene__plate">
            <span className="stamp stamp--alert">{suspect.id}</span>
            <span className="t-label muted">{suspect.alias}</span>
          </div>
        </div>
        <div className="scene__talk" aria-live="polite">{talk}</div>
      </div>

      {presenting && <PresentationMoment item={presenting} />}
      {intro && (
        <div className="scene__intro" onAnimationEnd={(e) => { if (e.target === e.currentTarget) setIntro(false); }} aria-hidden="true">
          <span className="t-label">CASE {caseId}</span>
          <span className="t-h1">{suspect.name.toUpperCase()}</span>
          <span className="t-label muted">{where}</span>
        </div>
      )}
    </div>,
    document.body,
  );
}
