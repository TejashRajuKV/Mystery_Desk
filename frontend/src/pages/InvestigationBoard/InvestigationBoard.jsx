import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, PageTitle, EmptyState, Stamp } from '../../components/ui/ui.jsx';
import InvestigationNode from '../../components/InvestigationNode/InvestigationNode.jsx';
import { kindOf } from '../../utils/format.js';
import { autoPosition, loadBoard, saveBoard } from '../../utils/boardStore.js';
import { prefersReducedMotion } from '../../utils/motion.js';
import { playDenied, playLinkConnect, playLinkRemove, playPin } from '../../utils/sound.js';
import './InvestigationBoard.css';

const NODE_W = 180;
const NODE_H = 84;

/** A red-string line, drawn stroke-first the moment it's created — never replayed on re-render. */
function BoardLink({ id, x1, y1, x2, y2 }) {
  const animated = useRef(false);
  const ref = useCallback((el) => {
    if (!el || animated.current) return;
    animated.current = true;
    const len = el.getTotalLength();
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: prefersReducedMotion() ? 1 : 340, easing: 'ease-out', fill: 'forwards' },
    );
  }, []);
  return <line ref={ref} className="link" x1={x1} y1={y1} x2={x2} y2={y2} />;
}

export default function InvestigationBoard() {
  const { evidence, suspects, timeline, caseInfo, statements, evidenceById, suspectById, eventById, locationById, claimById, connections, addConnection, removeConnection, investigation } = useCase();
  const closed = Boolean(investigation.conclusion);

  const [layout, setLayout] = useState(() => loadBoard());
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null); // { source, target }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pickId, setPickId] = useState('');
  const [dragId, setDragId] = useState(null);
  const [settleId, setSettleId] = useState(null);
  const drag = useRef(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Every id that appears in a connection is shown, even if it was never pinned.
  useEffect(() => {
    setLayout((prev) => {
      let next = prev;
      for (const c of connections) {
        for (const id of [c.source, c.target]) {
          if (!next[id]) next = { ...next, [id]: autoPosition(Object.keys(next).length) };
        }
      }
      if (next !== prev) saveBoard(next);
      return next;
    });
  }, [connections]);

  const describe = useCallback((id) => {
    const kind = kindOf(id);
    if (kind === 'evidence') return { kind, title: evidenceById[id]?.title ?? id };
    if (kind === 'suspect') return { kind, title: suspectById[id]?.name ?? id };
    if (kind === 'location') return { kind, title: locationById[id]?.name ?? id };
    if (kind === 'statement') return { kind, title: claimById[id] ? `“${claimById[id].claim}”` : id };
    return { kind, title: eventById[id] ? `${eventById[id].time} ${eventById[id].title}` : id };
  }, [evidenceById, suspectById, eventById, locationById, claimById]);

  const ids = Object.keys(layout);
  const connectedIds = useMemo(() => new Set(connections.flatMap((c) => [c.source, c.target])), [connections]);
  const persist = (next) => { setLayout(next); saveBoard(next); };

  function pin() {
    if (!pickId || layout[pickId]) return;
    persist({ ...layout, [pickId]: autoPosition(ids.length) });
    playPin();
    setPickId('');
  }

  function unpin(id) {
    const { [id]: _removed, ...rest } = layout;
    persist(rest);
    setSelected(null);
  }

  function onNodeClick(id) {
    setError(null);
    if (closed) return setSelected(selected === id ? null : id);
    if (!selected) return setSelected(id);
    if (selected === id) return setSelected(null);
    setPending({ source: selected, target: id });
    setSelected(null);
  }

  async function createLink() {
    if (!pending) return;
    setBusy(true); setError(null);
    try {
      await addConnection({ ...pending, relationship: 'linked_to' });
      playLinkConnect();
      setPending(null);
    } catch (e) {
      setError(e);
      playDenied();
    } finally {
      setBusy(false);
    }
  }

  async function deleteLink(id) {
    setError(null);
    try {
      await removeConnection(id);
      playLinkRemove();
    } catch (e) {
      setError(e);
      playDenied();
    }
  }

  // Dragging: a move under 4px counts as a click.
  function onPointerDown(e, id) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id, startX: e.clientX, startY: e.clientY, origin: layout[id], moved: false };
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setDragId(d.id);
    setLayout((prev) => ({ ...prev, [d.id]: { x: Math.max(0, d.origin.x + dx), y: Math.max(0, d.origin.y + dy) } }));
  }
  function onPointerUp(id) {
    const d = drag.current;
    drag.current = null;
    setDragId(null);
    if (!d) return;
    if (d.moved) {
      saveBoard(layoutRef.current);
      setSettleId(id);
      // Belt-and-suspenders: guarantees cleanup even if onAnimationEnd is missed
      // (e.g. a backgrounded tab throttling animation events).
      setTimeout(() => setSettleId((cur) => (cur === id ? null : cur)), 320);
    } else onNodeClick(id);
  }

  function onKeyDown(e, id) {
    const step = e.shiftKey ? 40 : 10;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      const p = layout[id];
      persist({ ...layout, [id]: { x: Math.max(0, p.x + dx), y: Math.max(0, p.y + dy) } });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNodeClick(id);
    }
  }

  const size = ids.reduce((acc, id) => ({
    w: Math.max(acc.w, layout[id].x + NODE_W + 60),
    h: Math.max(acc.h, layout[id].y + NODE_H + 60),
  }), { w: 900, h: 620 });

  const pinnable = useMemo(() => ({
    evidence: evidence.filter((e) => !layout[e.id]),
    suspects: suspects.filter((s) => !layout[s.id]),
    locations: (caseInfo.locations ?? []).filter((l) => !layout[l.id]),
    events: timeline.filter((t) => !layout[t.id]),
    claims: statements.flatMap((s) => s.assertions).filter((a) => !layout[a.id]),
  }), [evidence, suspects, timeline, caseInfo, statements, layout]);

  const shownLinks = connections.filter((c) => layout[c.source] && layout[c.target]);
  const canUnpin = selected && !connectedIds.has(selected);

  return (
    <div className="page board">
      <PageTitle kicker="Does this clue actually connect to that person?" title="Case Board" meta={`${ids.length} PINNED · ${connections.length} LINKS`} />

      <div className="board__layout">
        <div className="board__canvas" aria-label="Investigation board">
          {ids.length === 0 ? (
            <div className="board__empty">
              <EmptyState title="The board is empty">Pin evidence, suspects, places and events from the panel, then click two cards to link them.</EmptyState>
            </div>
          ) : (
            <div className="board__surface" style={{ width: size.w, height: size.h }}>
              <svg className="board__lines" width={size.w} height={size.h} aria-hidden="true">
                {shownLinks.map((c) => {
                  const a = layout[c.source];
                  const b = layout[c.target];
                  return (
                    <BoardLink
                      key={c.id} id={c.id}
                      x1={a.x + NODE_W / 2} y1={a.y + NODE_H / 2}
                      x2={b.x + NODE_W / 2} y2={b.y + NODE_H / 2}
                    />
                  );
                })}
              </svg>

              {ids.map((id) => {
                const info = describe(id);
                return (
                  <InvestigationNode
                    key={id} kind={info.kind} id={id} title={info.title}
                    selected={selected === id || pending?.source === id || pending?.target === id}
                    dragging={dragId === id}
                    role="button" tabIndex={0}
                    aria-label={`${id}, ${info.title}`}
                    aria-pressed={selected === id}
                    className={settleId === id ? 'board__node board__node--settle' : 'board__node'}
                    style={{ left: layout[id].x, top: layout[id].y }}
                    onPointerDown={(e) => onPointerDown(e, id)}
                    onPointerMove={onPointerMove}
                    onPointerUp={() => onPointerUp(id)}
                    onPointerCancel={() => { drag.current = null; setDragId(null); }}
                    onKeyDown={(e) => onKeyDown(e, id)}
                    onAnimationEnd={() => setSettleId((cur) => (cur === id ? null : cur))}
                  />
                );
              })}
            </div>
          )}
        </div>

        <aside className="board__panel">
          {closed && (
            <section className="panel board__section board__closed">
              <Stamp variant="alert">CASE CLOSED</Stamp>
              <p className="t-small muted">The accusation is on file, so the links are part of the record now. You can still pin and arrange cards.</p>
            </section>
          )}
          <section className="panel board__section">
            <span className="t-label muted">PIN TO BOARD</span>
            <select className="select" value={pickId} onChange={(e) => setPickId(e.target.value)} aria-label="Choose something to pin">
              <option value="">Choose…</option>
              <optgroup label="Evidence">{pinnable.evidence.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.title}</option>)}</optgroup>
              <optgroup label="Suspects">{pinnable.suspects.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}</optgroup>
              <optgroup label="Locations">{pinnable.locations.map((l) => <option key={l.id} value={l.id}>{l.id} · {l.name}</option>)}</optgroup>
              <optgroup label="Events">{pinnable.events.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.time} {t.title}</option>)}</optgroup>
              <optgroup label="Statements">{pinnable.claims.map((a) => <option key={a.id} value={a.id}>{a.id} · “{a.claim}”</option>)}</optgroup>
            </select>
            <Button small disabled={!pickId} onClick={pin} block>PIN</Button>
            {selected && (
              <Button small variant="secondary" block disabled={!canUnpin} onClick={() => unpin(selected)} title={canUnpin ? '' : 'Remove its links first'}>
                REMOVE {selected} FROM BOARD
              </Button>
            )}
            <p className="t-small muted">
              {closed
                ? 'Drag cards to arrange them; arrow keys nudge a focused card.'
                : selected
                ? `${selected} selected. Click another card to link them.`
                : 'Click a card, then another, to link them. The board is your theory: it never tells you whether a link is right. Drag cards to arrange; arrow keys nudge a focused card.'}
            </p>
          </section>

          {pending && (
            <section className="panel board__section" aria-live="polite">
              <span className="t-label muted">NEW LINK</span>
              <p className="t-h3">{pending.source} → {pending.target}</p>
              <div className="board__row">
                <Button small onClick={createLink} disabled={busy}>{busy ? 'LINKING…' : 'CREATE LINK'}</Button>
                <Button small variant="secondary" onClick={() => { setPending(null); setError(null); }}>CANCEL</Button>
              </div>
            </section>
          )}
          {error && <p className="t-small board__error" role="alert">{error.message}</p>}

          <section className="panel board__section">
            <span className="t-label muted">LINKS ({connections.length})</span>
            {connections.length === 0 ? (
              <p className="t-small muted">No links yet.</p>
            ) : (
              <ul className="board__links">
                {connections.map((c) => (
                  <li key={c.id}>
                    <p className="t-mono">{c.id} · {c.source} → {c.target}</p>
                    {!closed && <button type="button" className="board__del" onClick={() => deleteLink(c.id)} aria-label={`Delete link ${c.source} to ${c.target}`}>✕</button>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
