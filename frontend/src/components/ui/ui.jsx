import { Link } from 'react-router-dom';
import './ui.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export function Button({ variant = 'primary', block, small, to, className, children, ...rest }) {
  const cls = cx('btn', `btn--${variant}`, block && 'btn--block', small && 'btn--small', className);
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

/** Small label tag. Pass `onClick` to make it a button. */
export function Stamp({ variant = 'default', onClick, className, children, ...rest }) {
  const cls = cx('stamp', variant !== 'default' && `stamp--${variant}`, className);
  if (onClick) return <button type="button" className={cls} onClick={onClick} {...rest}>{children}</button>;
  return <span className={cls} {...rest}>{children}</span>;
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
        {error?.message ?? 'Something went wrong.'} Make sure the MysteryDesk API is running.
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

export function PageTitle({ title, meta, children }) {
  return (
    <div className="page__title-row">
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
