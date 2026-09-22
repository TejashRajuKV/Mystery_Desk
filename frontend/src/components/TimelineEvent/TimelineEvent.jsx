import { motion } from 'framer-motion';
import { hhmm } from '../../utils/format.js';
import { playPaperRustle } from '../../utils/sound.js';
import './TimelineEvent.css';

export default function TimelineEvent({ event, selected, viewed, onSelect, index = 0 }) {
  const cls = ['tl-event', selected && 'tl-event--selected', viewed && 'tl-event--viewed'].filter(Boolean).join(' ');
  return (
    <motion.button 
      type="button" 
      className={cls} 
      onClick={() => { playPaperRustle(); onSelect?.(event.id); }} 
      aria-pressed={selected}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
    >
      <span className="t-mono tl-event__time">{event.time ?? hhmm(event.timestamp)}</span>
      <span className="tl-event__branch">
        <span className="tl-event__spine" />
        <span className="tl-event__stem" />
      </span>
      <span className="tl-event__body">
        <span className="t-h3 tl-event__title">{event.title}</span>
        <span className="t-mono secondary tl-event__desc">{event.description}</span>
        {event.evidenceIds?.length > 0 && (
          <span className="t-mono tl-event__connected">EVIDENCE CONNECTED: {event.evidenceIds.join(', ')}</span>
        )}
      </span>
    </motion.button>
  );
}
