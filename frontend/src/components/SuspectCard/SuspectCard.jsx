import { playPaperRustle } from '../../utils/sound.js';
import './SuspectCard.css';

/** Investigation file card. */
export default function SuspectCard({ suspect, selected, viewed, onSelect }) {
  return (
    <button
      type="button"
      className={selected ? 'sus-card sus-card--selected' : 'sus-card'}
      onClick={() => { playPaperRustle(); onSelect?.(suspect.id); }}
      aria-pressed={selected}
    >
      <span className="t-mono muted">SUSPECT FILE</span>
      <hr className="rule" style={{ width: '100%', margin: '8px 0', borderColor: 'var(--line-strong)' }} />
      <span className="sus-card__info">
        <span className="t-label sus-card__id">{suspect.id}</span>
        <span className="t-h2 sus-card__name">{suspect.name.toUpperCase()}</span>
        <span className="t-mono secondary">{suspect.role.toUpperCase()}</span>
      </span>
      <hr className="rule" style={{ width: '100%', margin: '8px 0', borderColor: 'var(--line-strong)' }} />
      {viewed && <span className="t-mono sus-card__seen">[PROFILED]</span>}
    </button>
  );
}
