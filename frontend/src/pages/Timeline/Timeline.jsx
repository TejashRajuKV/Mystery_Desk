import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import { PageTitle, Button, Stamp } from '../../components/ui/ui.jsx';
import TimelineEvent from '../../components/TimelineEvent/TimelineEvent.jsx';
import { dateRange, formatDateTime } from '../../utils/format.js';
import './Timeline.css';

function Scrubber({ timeline, selectedId, viewed, onSelect }) {
  return (
    <div className="scrubber panel" role="group" aria-label="Timeline scrubber">
      <span className="scrubber__line" aria-hidden="true" />
      {timeline.map((ev) => {
        const cls = ['scrubber__mark', viewed.has(ev.id) && 'seen', ev.id === selectedId && 'active'].filter(Boolean).join(' ');
        return (
          <button key={ev.id} type="button" className={cls} onClick={() => onSelect(ev.id)} aria-label={`${ev.time}, ${ev.title}`}>
            <i />
            <span className="t-label">{ev.time}</span>
          </button>
        );
      })}
    </div>
  );
}

function EventDetail({ event, onClose }) {
  const { evidenceById, suspectById, locationById } = useCase();
  return (
    <aside className="tl-detail" aria-label={`Event ${event.id}`}>
      <div className="tl-detail__head t-label">
        <span>{event.id} · {formatDateTime(event.timestamp).toUpperCase()}</span>
        <button type="button" className="tl-detail__close" onClick={onClose} aria-label="Close event">✕</button>
      </div>
      <h2 className="t-h1 tl-detail__title">{event.title}</h2>
      <p className="t-small secondary">{event.description}</p>
      <dl className="tl-detail__meta t-mono">
        <dt>PLACE</dt><dd>{locationById[event.locationId]?.name ?? event.location ?? '—'}</dd>
        {event.personIds.length > 0 && (<><dt>PEOPLE</dt><dd>{event.personIds.map((id) => suspectById[id]?.name ?? id).join(', ')}</dd></>)}
      </dl>
      {event.evidenceIds.length > 0 && (
        <div className="tl-detail__ev">
          <span className="t-label muted">SUPPORTING EVIDENCE</span>
          {event.evidenceIds.map((id) => (
            <Link key={id} to={`/evidence?select=${id}`} className="tl-detail__link">
              <Stamp variant="alert">{id}</Stamp>
              <span className="t-small">{evidenceById[id]?.title ?? id}</span>
            </Link>
          ))}
        </div>
      )}
      <Button to="/board" variant="secondary" block>OPEN THE BOARD</Button>
    </aside>
  );
}

export default function Timeline() {
  const { timeline, viewed, progress, markViewed } = useCase();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('select');
  const selected = timeline.find((t) => t.id === selectedId) ?? null;

  useEffect(() => { if (selected) markViewed('event', selected.id); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id) => setParams({ select: id }, { replace: true });
  const half = Math.ceil(timeline.length / 2);
  const columns = [timeline.slice(0, half), timeline.slice(half)];

  return (
    <div className={selected ? 'page tl tl--open' : 'page tl'}>
      <PageTitle title="Timeline" meta={`${dateRange(timeline[0]?.timestamp, timeline[timeline.length - 1]?.timestamp)} · ${progress.eventsViewed} OF ${progress.eventsTotal} EVENTS REVIEWED`} />
      <Scrubber timeline={timeline} selectedId={selectedId} viewed={viewed.timeline} onSelect={select} />

      <div className="tl__cols">
        {columns.map((col, i) => (
          <div key={i} className="tl__col">
            {col.map((ev) => (
              <TimelineEvent key={ev.id} event={ev} selected={ev.id === selectedId} viewed={viewed.timeline.has(ev.id)} onSelect={select} />
            ))}
          </div>
        ))}
      </div>

      {selected && <EventDetail key={selected.id} event={selected} onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}
