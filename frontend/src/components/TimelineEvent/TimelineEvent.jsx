import { hhmm } from '../../utils/format.js';
import { playPaperRustle } from '../../utils/sound.js';
import './TimelineEvent.css';

export default function TimelineEvent({ event, selected, viewed, onSelect }) {
  const cls = ['tl-event', selected && 'tl-event--selected', viewed && 'tl-event--viewed'].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} onClick={() => { playPaperRustle(); onSelect?.(event.id); }} aria-pressed={selected}>
      <span className="t-h3 tl-event__time">{event.time ?? hhmm(event.timestamp)}</span>
      <span className="tl-event__marker" aria-hidden="true" />
      <span className="tl-event__body">
        <span className="t-h2 tl-event__title">{event.title}</span>
        <span className="t-small secondary">{event.description}</span>
      </span>
    </button>
  );
}
