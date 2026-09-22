import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCase } from '../../hooks/useCase.jsx';
import { PageTitle, Button, Stamp } from '../../components/ui/ui.jsx';
import TimelineEvent from '../../components/TimelineEvent/TimelineEvent.jsx';
import { dateRange, formatDateTime } from '../../utils/format.js';
import './Timeline.css';

function EventDetail({ event, onClose }) {
  const { evidenceById, suspectById, locationById } = useCase();
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <motion.aside 
        className="drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Event ${event.id}`}
      >
        <div className="drawer__close">
          <button type="button" className="drawer__close-btn" onClick={onClose} aria-label="Close event">✕</button>
        </div>
        
        <div className="drawer__content">
          <div className="t-label muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{event.id}</span>
            <span>{formatDateTime(event.timestamp).toUpperCase()}</span>
          </div>
          
          <h2 className="t-h1" style={{ color: 'var(--accent)', marginTop: '8px' }}>{event.title.toUpperCase()}</h2>
          <hr className="rule" />
          
          <p className="t-mono secondary" style={{ margin: '16px 0', lineHeight: 1.6 }}>{event.description}</p>
          
          <dl className="drawer__meta t-mono" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px 16px', margin: 0 }}>
            <dt style={{ color: 'var(--text-secondary)' }}>LOCATION</dt>
            <dd style={{ margin: 0 }}>{locationById[event.locationId]?.name ?? event.location ?? '—'}</dd>
            
            {event.personIds.length > 0 && (
              <>
                <dt style={{ color: 'var(--text-secondary)' }}>PEOPLE</dt>
                <dd style={{ margin: 0 }}>{event.personIds.map((id) => suspectById[id]?.name ?? id).join(', ')}</dd>
              </>
            )}
          </dl>
          
          {event.evidenceIds.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '32px' }}>
              <span className="t-label muted">SUPPORTING EVIDENCE</span>
              {event.evidenceIds.map((id) => (
                <Link key={id} to={`/evidence?select=${id}`} style={{ display: 'flex', gap: '16px', alignItems: 'center', textDecoration: 'none' }}>
                  <Stamp variant="default">{id}</Stamp>
                  <span className="t-mono secondary" style={{ transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color='var(--accent)'} onMouseOut={(e) => e.target.style.color='var(--text-secondary)'}>
                    {evidenceById[id]?.title ?? id}
                  </span>
                </Link>
              ))}
            </div>
          )}
          
          <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
            <Button to="/board" variant="secondary" block>OPEN THE BOARD</Button>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}

export default function Timeline() {
  const { timeline, viewed, progress, markViewed } = useCase();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('select');
  const selected = timeline.find((t) => t.id === selectedId) ?? null;

  useEffect(() => { if (selected) markViewed('event', selected.id); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id) => setParams({ select: id }, { replace: true });

  return (
    <div className="page">
      <PageTitle title="EVENT TIMELINE" meta={`${dateRange(timeline[0]?.timestamp, timeline[timeline.length - 1]?.timestamp)} · ${progress.eventsViewed} OF ${progress.eventsTotal} EVENTS REVIEWED`} />

      <div className="tl-container">
        {timeline.map((ev, index) => (
          <TimelineEvent 
            key={ev.id} 
            event={ev} 
            selected={ev.id === selectedId} 
            viewed={viewed.timeline.has(ev.id)} 
            onSelect={select} 
            index={index}
          />
        ))}
        {/* End of spine */}
        <div style={{ display: 'flex' }}>
          <div style={{ width: '80px' }} />
          <div style={{ width: '40px', position: 'relative', height: '40px' }}>
            <div style={{ position: 'absolute', left: '19px', top: '0', bottom: '0', width: '1px', background: 'var(--line-strong)' }} />
            <div style={{ position: 'absolute', left: '16px', bottom: '0', width: '7px', height: '1px', background: 'var(--line-strong)' }} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selected && <EventDetail key={selected.id} event={selected} onClose={() => setParams({}, { replace: true })} />}
      </AnimatePresence>
    </div>
  );
}
