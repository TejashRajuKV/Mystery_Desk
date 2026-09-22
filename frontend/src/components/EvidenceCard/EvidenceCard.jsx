import { formatWhen, typeLabel } from '../../utils/format.js';
import { playPaperRustle } from '../../utils/sound.js';
import './EvidenceCard.css';

/** Photocopy-style exhibit card. */
export default function EvidenceCard({ item, selected, viewed, onSelect }) {
  return (
    <button
      type="button"
      className={selected ? 'ev-card ev-card--selected' : 'ev-card'}
      onClick={() => { playPaperRustle(); onSelect?.(item.id); }}
      aria-pressed={selected}
      aria-label={`${item.id}, ${item.title}`}
    >
      <span className="ev-card__head t-label">
        <span>{item.id}</span>
        <span className="ev-card__type">{typeLabel(item.type)}</span>
      </span>
      <span className="ev-card__photo" aria-hidden="true">
        <i /><i /><i />
        <span className="t-mono ev-card__caption">{viewed ? '[ EXAMINED ]' : '[ EXHIBIT ]'}</span>
      </span>
      <span className="t-h2 ev-card__title">{item.title}</span>
      <span className="t-mono ev-card__meta">
        <span>{formatWhen(item.timestamp)}</span>
        <span>{item.location ?? 'Off-site'}</span>
      </span>
    </button>
  );
}
