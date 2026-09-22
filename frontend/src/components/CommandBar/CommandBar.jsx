import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCase } from '../../hooks/useCase.jsx';
import { CASE_ID } from '../../services/api.js';
import { SoundToggle } from '../ui/ui.jsx';
import ProgressIndicator from '../ProgressIndicator/ProgressIndicator.jsx';
import './CommandBar.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'DASHBOARD' },
  { to: '/evidence', label: 'EVIDENCE' },
  { to: '/suspects', label: 'SUSPECTS' },
  { to: '/timeline', label: 'TIMELINE' },
  { to: '/board', label: 'BOARD' },
  { to: '/assistant', label: 'ASSISTANT' },
  { to: '/report', label: 'REPORT' },
];

export default function CommandBar() {
  const { caseInfo, progress } = useCase();
  
  return (
    <header className="command-bar panel">
      <div className="command-bar__top">
        <div className="command-bar__brand">
          <Link to="/" className="t-mono command-bar__logo">MYSTERYDESK</Link>
          <span className="t-label muted">CASE #{caseInfo?.id ?? CASE_ID}</span>
          <span className="command-bar__status t-label">
            <motion.span 
              className="status-dot"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            INVESTIGATION ACTIVE
          </span>
        </div>
        <div className="command-bar__actions">
          <ProgressIndicator value={progress.percent} />
          <SoundToggle />
        </div>
      </div>
      
      <nav className="command-bar__nav" aria-label="Investigation">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link t-label ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {item.label}
                {isActive && (
                  <motion.div
                    className="nav-link__indicator"
                    layoutId="navIndicator"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
