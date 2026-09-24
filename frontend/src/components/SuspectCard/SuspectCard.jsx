import { playPaperRustle } from '../../utils/sound.js';
import Portrait from '../Portrait/Portrait.jsx';
import './SuspectCard.css';

/** Dossier card with a silhouette portrait. */
export default function SuspectCard({ suspect, selected, badge, onSelect }) {
  return (
    <button
      type="button"
      className={selected ? 'sus-card sus-card--selected' : 'sus-card'}
      onClick={() => { playPaperRustle(); onSelect?.(suspect.id); }}
      aria-pressed={selected}
    >
      <span className="sus-card__portrait" aria-hidden="true">
        <Portrait suspect={suspect} className="sus-card__face" />
        <span className="stamp stamp--alert sus-card__id">{suspect.id}</span>
        {badge && <span className="stamp stamp--viewed sus-card__seen">{badge}</span>}
      </span>
      <span className="sus-card__info">
        <span className="t-h2 sus-card__name">{suspect.name}</span>
        <span className="t-mono secondary">{suspect.role}</span>
        <span className="t-small muted">“{suspect.alias?.replace(/^The /, 'The ')}”</span>
      </span>
    </button>
  );
}
