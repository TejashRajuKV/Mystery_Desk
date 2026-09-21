import { NavLink, Link } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import { CASE_ID } from '../../services/api.js';
import { monthYear } from '../../utils/format.js';
import './Sidebar.css';

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/evidence', label: 'Evidence Room' },
  { to: '/suspects', label: 'Suspects' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/board', label: 'Board' },
  { to: '/assistant', label: 'Assistant' },
  { to: '/report', label: 'Report' },
];

export default function Sidebar() {
  const { caseInfo } = useCase();
  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar__brand" aria-label="MysteryDesk, back to case entry">
        <span className="t-display sidebar__wordmark">MysteryDesk</span>
        <span className="t-label muted">CASE #{caseInfo?.id ?? CASE_ID}{caseInfo ? ` · ${monthYear(caseInfo.openedAt)}` : ''}</span>
      </Link>
      <hr className="sidebar__rule" />
      <nav className="sidebar__nav" aria-label="Investigation">
        {NAV_ITEMS.map((item, i) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-item nav-item--active' : 'nav-item')}>
            <span className="t-mono nav-item__index">{String(i + 1).padStart(2, '0')}</span>
            <span className="t-h3 nav-item__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__foot">
        <span className="t-label muted">LEAD INVESTIGATOR</span>
        <span className="t-h3">You</span>
      </div>
    </aside>
  );
}
