import { useEffect, useRef, useState } from 'react';
import './ProgressIndicator.css';

/** Segmented film-strip meter. `value` is 0–100. */
export default function ProgressIndicator({ label = 'INVESTIGATION', value = 0, ticks = 20, showValue = true }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * ticks);
  const prevFilled = useRef(filled);
  const [justFilled, setJustFilled] = useState(-1);

  // The newest tick pops when progress increases; earlier ticks just hold their fill.
  useEffect(() => {
    if (filled > prevFilled.current) setJustFilled(filled - 1);
    prevFilled.current = filled;
  }, [filled]);

  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className="progress__head t-label">
        <span className="secondary">{label}</span>
        {showValue && <span>{Math.round(value)}%</span>}
      </div>
      <div className="progress__ticks">
        {Array.from({ length: ticks }, (_, i) => {
          const cls = ['progress__tick', i < filled && 'progress__tick--on', i === justFilled && 'progress__tick--new'].filter(Boolean).join(' ');
          return <span key={i} className={cls} onAnimationEnd={() => setJustFilled((cur) => (cur === i ? -1 : cur))} />;
        })}
      </div>
    </div>
  );
}
