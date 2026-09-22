import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api.js';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Stamp, PageTitle, EmptyState } from '../../components/ui/ui.jsx';
import EvidenceCard from '../../components/EvidenceCard/EvidenceCard.jsx';
import { EVIDENCE_GROUPS, formatDateTime, typeLabel } from '../../utils/format.js';
import { isPinned, pinToBoard } from '../../utils/boardStore.js';
import './EvidenceRoom.css';

function Inspector({ id, onSelect, onClose }) {
  const { evidenceById, markViewed } = useCase();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const item = detail ?? summary;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <motion.aside 
        className="drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
        aria-live="polite"
      >
        <div className="drawer__close">
          <button className="drawer__close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        
        <div className="drawer__content">
          <div className="drawer__head t-label">
            <span>{item.id}</span>
            <Stamp variant="default">{typeLabel(item.type)}</Stamp>
          </div>
          
          <h2 className="t-h1 drawer__title">{item.title.toUpperCase()}</h2>
          <hr className="rule" />
          
          <dl className="drawer__meta t-mono">
            <dt>TIMESTAMP</dt><dd>{formatDateTime(item.timestamp)}</dd>
            <dt>LOCATION</dt><dd>{item.location ?? 'Off-site'}</dd>
            {item.people?.length > 0 && (<><dt>SUSPECTS</dt><dd>{item.people.join(' · ')}</dd></>)}
            {detail?.source && (<><dt>SOURCE</dt><dd>{detail.source}</dd></>)}
            {detail?.reliability && (<><dt>RELIABILITY</dt><dd>{detail.reliability}</dd></>)}
          </dl>
          
          {error && <p className="t-mono" style={{color: 'var(--warning)'}}>Could not load full exhibit. {error.message}</p>}
          
          <p className="t-mono drawer__details">{detail ? detail.details : item.summary}</p>

          {detail?.relatedEvidenceIds?.length > 0 && (
            <div className="drawer__related">
              <span className="t-label muted">RELATED EVIDENCE</span>
              <div>
                {detail.relatedEvidenceIds.map((rid) => (
                  <button key={rid} type="button" className="stamp stamp--default" onClick={() => onSelect(rid)}>{rid}</button>
                ))}
              </div>
            </div>
          )}

          <div className="drawer__actions">
            <Button
              variant="secondary" block disabled={pinned}
              onClick={() => { pinToBoard(id); setPinned(true); }}
            >
              {pinned ? 'PINNED TO BOARD' : 'ADD TO BOARD'}
            </Button>
            {pinned && <Button to="/board" variant="secondary" block>OPEN THE BOARD</Button>}
          </div>
        </div>
      </motion.aside>
    </div>
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
  const deselect = () => {
    const newParams = new URLSearchParams(params);
    newParams.delete('select');
    setParams(newParams, { replace: true });
  };
  
  const validSelected = selectedId && evidence.some((e) => e.id === selectedId) ? selectedId : null;

  return (
    <div className="page">
      <PageTitle title="EVIDENCE DATABASE" meta={`${evidence.length} EXHIBITS · ${progress.evidenceViewed} EXAMINED`} />

      <div className="filters" role="group" aria-label="Filter evidence">
        {EVIDENCE_GROUPS.map((g) => (
          <Stamp key={g.id} variant={g.id === groupId ? 'default' : 'viewed'} style={{borderColor: g.id === groupId ? 'var(--accent)' : '', color: g.id === groupId ? 'var(--accent)' : ''}} onClick={() => setGroupId(g.id)} aria-pressed={g.id === groupId}>
            {g.label}
          </Stamp>
        ))}
      </div>

      <div className="evroom">
        {list.length === 0 ? (
          <EmptyState title="Nothing filed here">No exhibits match this filter.</EmptyState>
        ) : (
          <motion.div className="evgrid" layout>
            <AnimatePresence>
              {list.map((e) => (
                <motion.div 
                  key={e.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <EvidenceCard item={e} selected={e.id === validSelected} viewed={viewed.evidence.has(e.id)} onSelect={select} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {validSelected && <Inspector id={validSelected} onSelect={select} onClose={deselect} />}
      </AnimatePresence>
    </div>
  );
}
