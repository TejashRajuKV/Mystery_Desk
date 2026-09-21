import './ProgressIndicator.css';

/** Segmented film-strip meter. `value` is 0–100. */
export default function ProgressIndicator({ label = 'INVESTIGATION', value = 0, ticks = 20, showValue = true }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * ticks);
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className="progress__head t-label">
        <span className="secondary">{label}</span>
        {showValue && <span>{Math.round(value)}%</span>}
      </div>
      <div className="progress__ticks">
        {Array.from({ length: ticks }, (_, i) => (
          <span key={i} className={i < filled ? 'progress__tick progress__tick--on' : 'progress__tick'} />
        ))}
      </div>
    </div>
  );
}
