import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCase } from '../../hooks/useCase.jsx';
import { formatDateTime, formatWhen } from '../../utils/format.js';
import './Dashboard.css';

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { caseInfo, progress: p, investigation, connections, evidenceById } = useCase();

  const done = [
    p.evidenceTotal > 0 && p.evidenceViewed >= p.evidenceTotal,
    p.suspectsTotal > 0 && p.suspectsViewed >= p.suspectsTotal,
    p.eventsTotal > 0 && p.eventsViewed >= p.eventsTotal,
    connections.length > 0 && p.contradictions > 0,
    Boolean(investigation.conclusion),
  ];
  const objectives = caseInfo.objectives.map((text, i) => ({ text, done: Boolean(done[i]) }));

  const leads = [...investigation.evidenceViewed].reverse().slice(0, 4)
    .map((id) => evidenceById[id]).filter(Boolean);

  return (
    <div className="page cmd-center">
      <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
        
        {/* CASE STATUS */}
        <motion.section className="cmd-section" variants={itemVariants}>
          <div className="cmd-section__header">
            <h3 className="t-label muted">CASE STATUS</h3>
            <span className="t-mono cmd-status">{caseInfo.status.toUpperCase()}</span>
          </div>
          <hr className="rule" />
          <div className="cmd-case-info">
            <h1 className="t-h1">{caseInfo.title}</h1>
            <div className="cmd-meta">
              <span className="t-label muted">OPENED {formatDateTime(caseInfo.openedAt).toUpperCase()}</span>
              <span className="t-label muted">CLASS {caseInfo.classification}</span>
            </div>
            {caseInfo.briefing.map((para, i) => <p key={i} className="t-body secondary cmd-brief">{para}</p>)}
          </div>
        </motion.section>

        {/* OBJECTIVE */}
        <motion.section className="cmd-section" variants={itemVariants}>
          <div className="cmd-section__header">
            <h3 className="t-label muted">OBJECTIVES</h3>
          </div>
          <hr className="rule" />
          <ul className="cmd-objectives">
            {objectives.map((o) => (
              <li key={o.text} className={o.done ? 't-mono muted cmd-obj-done' : 't-mono'}>
                <span className="cmd-checkbox">[{o.done ? 'X' : ' '}]</span> {o.text}
              </li>
            ))}
          </ul>
        </motion.section>

        {/* 2-COLUMN: CASE DATA & BOARD */}
        <div className="cmd-grid">
          <motion.section className="cmd-section cmd-panel" variants={itemVariants}>
            <div className="cmd-section__header">
              <h3 className="t-label muted">CASE DATA</h3>
            </div>
            <hr className="rule" />
            <div className="cmd-data-links">
              <Link to="/evidence" className="cmd-link">
                <span className="t-mono">EVIDENCE</span>
                <span className="t-mono cmd-stat">[{p.evidenceViewed}/{p.evidenceTotal}]</span>
              </Link>
              <Link to="/suspects" className="cmd-link">
                <span className="t-mono">SUSPECTS</span>
                <span className="t-mono cmd-stat">[{p.suspectsViewed}/{p.suspectsTotal}]</span>
              </Link>
              <Link to="/timeline" className="cmd-link">
                <span className="t-mono">TIMELINE</span>
                <span className="t-mono cmd-stat">[{p.eventsViewed}/{p.eventsTotal}]</span>
              </Link>
              <div className="cmd-link" style={{ pointerEvents: 'none' }}>
                <span className="t-mono">CONTRADICTIONS</span>
                <span className="t-mono cmd-stat">[{p.contradictions}]</span>
              </div>
            </div>
          </motion.section>

          <motion.section className="cmd-section cmd-panel cmd-board-link" variants={itemVariants}>
            <Link to="/board" className="cmd-board-content">
              <h2 className="t-h1">INVESTIGATION BOARD</h2>
              <span className="t-label muted">ACCESS NETWORK OF CONNECTIONS</span>
            </Link>
          </motion.section>
        </div>

        {/* RECENT DISCOVERIES */}
        <motion.section className="cmd-section" variants={itemVariants}>
          <div className="cmd-section__header">
            <h3 className="t-label muted">RECENT DISCOVERIES</h3>
          </div>
          <hr className="rule" />
          {leads.length === 0 ? (
            <p className="t-mono muted cmd-empty">NO RECENT DISCOVERIES.</p>
          ) : (
            <ul className="cmd-leads">
              {leads.map((e) => (
                <li key={e.id}>
                  <span className="t-mono cmd-time">{formatWhen(e.timestamp)}</span>
                  <Link to={`/evidence?select=${e.id}`} className="t-mono cmd-lead-link">{e.id} - {e.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

      </motion.div>
    </div>
  );
}
