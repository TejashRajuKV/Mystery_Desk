import './SuspectCard.css';

/** Dossier card with a silhouette portrait. */
export default function SuspectCard({ suspect, selected, viewed, onSelect }) {
  return (
    <button
      type="button"
      className={selected ? 'sus-card sus-card--selected' : 'sus-card'}
      onClick={() => onSelect?.(suspect.id)}
      aria-pressed={selected}
    >
      <span className="sus-card__portrait" aria-hidden="true">
        <i className="sus-card__shoulders" />
        <i className="sus-card__head" />
        <span className="stamp stamp--alert sus-card__id">{suspect.id}</span>
        {viewed && <span className="stamp stamp--viewed sus-card__seen">PROFILED</span>}
      </span>
      <span className="sus-card__info">
        <span className="t-h2 sus-card__name">{suspect.name}</span>
        <span className="t-mono secondary">{suspect.role}</span>
        <span className="t-small muted">“{suspect.alias?.replace(/^The /, 'The ')}”</span>
      </span>
    </button>
  );
}
