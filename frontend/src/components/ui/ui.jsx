import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isMuted, playClick, toggleMuted } from '../../utils/sound.js';
import './ui.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export function Button({ variant = 'primary', block, small, to, className, children, onClick, ...rest }) {
  const cls = cx('btn', `btn--${variant}`, block && 'btn--block', small && 'btn--small', className);
  const handleClick = (e) => { playClick(); onClick?.(e); };
  if (to) return <Link to={to} className={cls} onClick={handleClick} {...rest}>{children}</Link>;
  return <button type="button" className={cls} onClick={handleClick} {...rest}>{children}</button>;
}

/** Small label tag. Pass `onClick` to make it a button. */
export function Stamp({ variant = 'default', onClick, className, children, ...rest }) {
  const cls = cx('stamp', variant !== 'default' && `stamp--${variant}`, className);
  if (onClick) {
    const handleClick = (e) => { playClick(); onClick(e); };
    return <button type="button" className={cls} onClick={handleClick} {...rest}>{children}</button>;
  }
  return <span className={cls} {...rest}>{children}</span>;
}

/** A small speaker toggle, styled as a stamp. Placed on the main menu and the HUD. */
export function SoundToggle({ className }) {
  const [muted, setMutedState] = useState(isMuted);
  return (
    <button
      type="button"
      className={cx('stamp', 'sound-toggle', className)}
      onClick={() => setMutedState(toggleMuted())}
      aria-pressed={!muted}
      aria-label={muted ? 'Sound is off. Turn sound on.' : 'Sound is on. Turn sound off.'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      {muted ? '♪ OFF' : '♪ ON'}
    </button>
  );
}

export function Loading({ label = 'LOADING CASE FILE' }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="t-label muted">{label}<span className="state__cursor">_</span></span>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state" role="alert">
      <Stamp variant="alert">FILE UNAVAILABLE</Stamp>
      <p className="t-body secondary state__msg">
        {error?.message ?? 'Something went wrong.'}
        {(!error?.status || error.status >= 500) && ' Make sure the MysteryDesk API is running.'}
      </p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>TRY AGAIN</Button>}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <p className="t-h3 secondary">{title}</p>
      {children && <p className="t-small muted">{children}</p>}
    </div>
  );
}

/** `kicker` is the question the detective is asking on this screen, set above the title. */
export function PageTitle({ title, meta, kicker, children }) {
  return (
    <div className="page__title-row">
      {kicker && <p className="t-display page__kicker">{kicker}</p>}
      <h1 className="t-h1">{title}</h1>
      {meta && <span className="t-label muted">{meta}</span>}
      {children}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="t-label muted">{label}</span>
      {children}
    </label>
  );
}

export { cx };
