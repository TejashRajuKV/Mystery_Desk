import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Stamp, PageTitle, EmptyState } from '../../components/ui/ui.jsx';
import EvidenceCard from '../../components/EvidenceCard/EvidenceCard.jsx';
import { EVIDENCE_GROUPS, formatDateTime, typeLabel } from '../../utils/format.js';
import { isPinned, pinToBoard } from '../../utils/boardStore.js';
import './EvidenceRoom.css';

function Inspector({ id, onSelect }) {
  const { api, base, evidenceById, markViewed } = useCase();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [pinned, setPinned] = useState(() => isPinned(id));
  const summary = evidenceById[id];

  useEffect(() => {
    let cancelled = false;
    setDetail(null); setError(null); setPinned(isPinned(id));
    api.getEvidence(id)
      .then((d) => { if (!cancelled) { setDetail(d); markViewed('evidence', id); } })
      .catch((e) => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
    // markViewed changes identity with investigation state; only re-run when the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const item = detail ?? summary;
  return (
    <aside className="inspector" aria-live="polite">
      <div className="inspector__head t-label">
        <span>{item.id}</span>
        <Stamp variant="ink">{typeLabel(item.type)}</Stamp>
      </div>
      <h2 className="t-h1 inspector__title">{item.title}</h2>
      <hr className="rule" />
      <dl className="inspector__meta t-mono">
        <dt>TIME</dt><dd>{formatDateTime(item.timestamp)}</dd>
        <dt>PLACE</dt><dd>{item.location ?? 'Off-site'}</dd>
        {item.people?.length > 0 && (<><dt>PEOPLE</dt><dd>{item.people.join(' · ')}</dd></>)}
        {detail?.source && (<><dt>SOURCE</dt><dd>{detail.source}</dd></>)}
      </dl>
      {error && <p className="t-small">Could not load the full exhibit. {error.message}</p>}
      <p className="t-small inspector__details">{detail ? detail.details : item.summary}</p>

      {detail?.relatedEvidenceIds?.length > 0 && (
        <div className="inspector__related">
          <span className="t-label">RELATED</span>
          <div>
            {detail.relatedEvidenceIds.map((rid) => (
              <button key={rid} type="button" className="stamp stamp--ink-solid" onClick={() => onSelect(rid)}>{rid}</button>
            ))}
          </div>
        </div>
      )}

      <div className="inspector__actions">
        <Button
          variant="ink" block disabled={pinned}
          onClick={() => { pinToBoard(id); setPinned(true); }}
        >
          {pinned ? 'PINNED TO BOARD' : 'ADD TO BOARD'}
        </Button>
        {pinned && <Button to={`${base}/board`} variant="ink" block>OPEN THE BOARD</Button>}
      </div>
    </aside>
  );
}

export default function EvidenceRoom() {
  const { evidence, viewed, progress } = useCase();
  const [params, setParams] = useSearchParams();
  const [groupId, setGroupId] = useState('all');

  const selectedId = params.get('select');
  const group = EVIDENCE_GROUPS.find((g) => g.id === groupId) ?? EVIDENCE_GROUPS[0];
  const list = useMemo(
    () => (group.types ? evidence.filter((e) => group.types.includes(e.type)) : evidence),
    [evidence, group],
  );
  const select = (id) => setParams({ select: id }, { replace: true });
  const validSelected = selectedId && evidence.some((e) => e.id === selectedId) ? selectedId : null;

  return (
    <div className="page">
      <PageTitle kicker="What can I learn from this?" title="Evidence" meta={`${evidence.length} EXHIBIT${evidence.length === 1 ? "" : "S"} · ${progress.evidenceViewed} EXAMINED`} />

      <div className="filters" role="group" aria-label="Filter evidence">
        {EVIDENCE_GROUPS.map((g) => (
          <Stamp key={g.id} variant={g.id === groupId ? 'alert' : 'default'} onClick={() => setGroupId(g.id)} aria-pressed={g.id === groupId}>
            {g.label}
          </Stamp>
        ))}
      </div>

      <div className="evroom">
        {list.length === 0 ? (
          evidence.length === 0
            ? <EmptyState title="Nothing collected yet">Evidence isn’t handed to you. Go out to the places on the map and search them, question the people you find there, and read the case file for its paperwork.</EmptyState>
            : <EmptyState title="Nothing filed here">No exhibits match this filter.</EmptyState>
        ) : (
          <div className="evgrid">
            {list.map((e) => (
              <EvidenceCard key={e.id} item={e} selected={e.id === validSelected} viewed={viewed.evidence.has(e.id)} onSelect={select} />
            ))}
          </div>
        )}
        {validSelected
          ? <Inspector id={validSelected} onSelect={select} />
          : <aside className="inspector inspector--empty"><p className="t-h3 muted">SELECT AN EXHIBIT</p><p className="t-small muted">Open any card to read the full record and pin it to the board.</p></aside>}
      </div>
    </div>
  );
}
