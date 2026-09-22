import { formatWhen, typeLabel } from '../../utils/format.js';
import { playPaperRustle } from '../../utils/sound.js';
import './EvidenceCard.css';

/** Forensic exhibit card. */
export default function EvidenceCard({ item, selected, viewed, onSelect }) {
  return (
    <button
      type="button"
      className={selected ? 'ev-card ev-card--selected' : 'ev-card'}
      onClick={() => { playPaperRustle(); onSelect?.(item.id); }}
      aria-pressed={selected}
      aria-label={`${item.id}, ${item.title}`}
    >
      <div className="ev-card__head t-label">
        <span>{item.id}</span>
      </div>
      <hr className="rule" style={{ width: '100%', borderColor: 'var(--line-strong)' }} />
      <span className="t-h3 ev-card__title">{item.title.toUpperCase()}</span>
      
      <span className="ev-card__type t-mono">{typeLabel(item.type)}</span>
      
      <div className="t-mono ev-card__meta" style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <span>{formatWhen(item.timestamp)}</span>
        <span>{item.location ?? 'Off-site'}</span>
      </div>
      
      {viewed && <span className="ev-card__viewed-tag t-mono">[EXAMINED]</span>}
    </button>
  );
}
