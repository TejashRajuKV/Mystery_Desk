import { useEffect } from 'react';
import { playClick } from '../../utils/sound.js';
import './ChoiceList.css';

/**
 * What the detective can say or do next, numbered like an old adventure game. Keys 1–9 pick a
 * choice while `hotkeys` is on. A choice is `{ id, label, asked?, tone? }`; asked ones are dimmed.
 */
export default function ChoiceList({ choices, onChoose, disabled, hotkeys = true, label = 'What do you do?' }) {
  useEffect(() => {
    if (!hotkeys || disabled) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) { e.preventDefault(); playClick(); onChoose(choices[n - 1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, onChoose, disabled, hotkeys]);

  return (
    <ol className="choices" aria-label={label}>
      {choices.map((c, i) => (
        <li key={c.id}>
          <button
            type="button"
            className={['choice', c.asked && 'choice--asked', c.tone && `choice--${c.tone}`].filter(Boolean).join(' ')}
            onClick={() => { playClick(); onChoose(c); }}
            disabled={disabled}
            aria-description={c.asked ? 'Already asked' : undefined}
          >
            <span className="t-label choice__n">{i + 1}</span>
            <span className="choice__label">{c.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
