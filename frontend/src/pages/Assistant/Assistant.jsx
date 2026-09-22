import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api.js';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Stamp, PageTitle } from '../../components/ui/ui.jsx';
import AssistantMessage from '../../components/AssistantPanel/AssistantPanel.jsx';
import { playDenied, playSuccess, playTypewriterKey } from '../../utils/sound.js';
import './Assistant.css';

const GREETING = {
  id: 'greeting', role: 'assistant',
  text: 'I work from the case files only: statements, exhibits, the timeline and the locations. Ask me about a suspect, a time window, a place or a piece of evidence.',
};

function suggestedQuestions({ suspects, timeline, locationById }) {
  const list = ['Which evidence contradicts a suspect’s statement?'];
  if (timeline.length >= 4) {
    const from = timeline[Math.floor(timeline.length * 0.3)];
    const to = timeline[Math.floor(timeline.length * 0.7)];
    list.push(`What happened between ${from.time} and ${to.time}?`);
  }
  const suspect = suspects.find((s) => locationById[s.locationIds?.[0]]);
  if (suspect) list.push(`What evidence connects ${suspect.name} to ${locationById[suspect.locationIds[0]].name}?`);
  return list;
}

export default function Assistant() {
  const { suspects, timeline, locationById, evidenceById, suspectById, eventById, progress, flagContradiction } = useCase();
  const prompts = useMemo(() => suggestedQuestions({ suspects, timeline, locationById }), [suspects, timeline, locationById]);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(() => new Set());
  const endRef = useRef(null);
  const nextId = useRef(1);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  const push = (m) => setMessages((prev) => [...prev, { id: nextId.current++, ...m }]);

  async function ask(question) {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    push({ role: 'user', text: q });
    setBusy(true);
    const tick = setInterval(playTypewriterKey, 420);
    try {
      const response = await api.askAssistant(q);
      push({ role: 'assistant', text: response.answer, response });
      if (response.contradiction) playSuccess();
    } catch (e) {
      push({ role: 'assistant', text: `I couldn’t reach the case files. ${e.message}`, error: true });
      playDenied();
    } finally {
      clearInterval(tick);
      setBusy(false);
    }
  }

  async function logContradiction({ assertionId, evidenceId }) {
    try {
      const result = await flagContradiction(assertionId, evidenceId);
      if (result.contradiction) { setLogged((prev) => new Set(prev).add(`${assertionId}:${evidenceId}`)); playSuccess(); }
      else { push({ role: 'assistant', text: `The records don’t confirm that conflict for ${evidenceId}.` }); playDenied(); }
    } catch (e) {
      push({ role: 'assistant', text: `Couldn’t log that contradiction. ${e.message}`, error: true });
      playDenied();
    }
  }

  return (
    <div className="page assistant">
      <PageTitle title="INVESTIGATION ASSISTANT" meta="TERMINAL INTERFACE ACTIVE" />

      <div className="assistant__layout">
        <section className="assistant__chat" aria-label="Conversation">
          <div className="assistant__log" role="log" aria-live="polite">
            {messages.map((m) => (
              <AssistantMessage
                key={m.id} message={m} logged={logged}
                lookups={{ evidenceById, suspectById, eventById }}
                onLogContradiction={logContradiction}
              />
            ))}
            {busy && (
              <div className="msg msg--assistant" role="status">
                <span className="t-mono muted" style={{color: 'var(--accent)'}}>ANALYSING<span className="dots" aria-hidden="true" /></span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="assistant__suggest">
            {prompts.map((p) => <Stamp key={p} onClick={() => ask(p)} disabled={busy} variant="default" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-secondary)' }}>{p}</Stamp>)}
          </div>

          <form className="assistant__form" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <label className="sr-only" htmlFor="q">Ask the assistant</label>
            <input id="q" className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="QUERY DATABASE..." autoComplete="off" />
            <Button type="submit" disabled={busy || !input.trim()} variant="secondary" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>SUBMIT</Button>
          </form>
        </section>

        <aside className="assistant__side">
          <section className="assistant__ctx">
            <span className="t-label muted">CASE CONTEXT: ACTIVE</span>
            <hr className="rule" style={{ margin: '8px 0', borderColor: 'var(--line-strong)' }} />
            <p className="t-mono secondary" style={{ fontSize: '13px' }}>Assistant has read access to all logged exhibits, statements, and timeline events.</p>
            <dl className="t-mono assistant__stats">
              <dt>EXHIBITS EXAMINED</dt><dd>{progress.evidenceViewed}/{progress.evidenceTotal}</dd>
              <dt>SUSPECTS PROFILED</dt><dd>{progress.suspectsViewed}/{progress.suspectsTotal}</dd>
              <dt>CONTRADICTIONS LOGGED</dt><dd>{progress.contradictions}</dd>
            </dl>
          </section>
          <section className="assistant__ctx">
            <span className="t-label muted">QUICK ACTIONS</span>
            <hr className="rule" style={{ margin: '8px 0', borderColor: 'var(--line-strong)' }} />
            <div className="assistant__people">
              {suspects.map((s) => (
                <button key={s.id} type="button" className="assistant__person" onClick={() => ask(`What contradicts ${s.name}’s statement?`)} disabled={busy}>
                  <span className="t-label">{s.id}</span> CROSS-REFERENCE
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
