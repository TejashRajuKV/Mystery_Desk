import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import MapIcon from '../CityPlan/MapIcon.jsx';
import { playPaperRustle, playTypewriterKey } from '../../utils/sound.js';
import './Tutorial.css';

// Small drawings for each page of the tutorial, in the same line style as the map's buildings.
const FIGURES = {
  desk: (
    <svg viewBox="0 0 120 80">
      <path d="M14 22h30l6 6h56v44H14z" className="fig-paper" transform="rotate(-6 60 50)" />
      <path d="M20 18h30l6 6h50v44H20z" className="fig-paper" />
      <text x="63" y="52" textAnchor="middle" className="fig-stamp">CASE</text>
    </svg>
  ),
  file: (
    <svg viewBox="0 0 120 80">
      <rect x="30" y="8" width="60" height="68" className="fig-paper" />
      <path d="M40 22h40M40 30h40M40 38h32M40 46h40M40 54h24" className="fig-ink" />
      <circle cx="96" cy="60" r="13" className="fig-clock" /><path d="M96 52v8l5 4" className="fig-ink" />
    </svg>
  ),
  street: (
    <svg viewBox="0 0 120 80">
      <path d="M8 58 Q40 10 60 40 T112 26" className="fig-route" />
      <g transform="translate(-4 46)"><circle cx="12" cy="12" r="12" className="fig-badge" /><g transform="translate(3 3) scale(0.75)"><MapIcon kind="house" width="24" height="24" /></g></g>
      <g transform="translate(46 28)"><circle cx="12" cy="12" r="12" className="fig-badge" /><g transform="translate(3 3) scale(0.75)"><MapIcon kind="garage" width="24" height="24" /></g></g>
      <g transform="translate(98 14)"><circle cx="12" cy="12" r="12" className="fig-badge fig-badge--on" /><g transform="translate(3 3) scale(0.75)"><MapIcon kind="bank" width="24" height="24" /></g></g>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 120 80">
      <rect x="18" y="30" width="56" height="40" className="fig-paper" transform="rotate(-8 46 50)" />
      <circle cx="72" cy="34" r="18" className="fig-lens" /><path d="M85 47l20 20" className="fig-thick" />
    </svg>
  ),
  talk: (
    <svg viewBox="0 0 120 80">
      <circle cx="36" cy="32" r="14" className="fig-paper" /><path d="M14 76q22-30 44 0" className="fig-paper" />
      <path d="M62 14h48v26H78l-8 8v-8h-8z" className="fig-paper" /><path d="M70 23h32M70 31h22" className="fig-ink" />
    </svg>
  ),
  present: (
    <svg viewBox="0 0 120 80">
      <rect x="14" y="16" width="42" height="54" className="fig-paper" transform="rotate(-6 35 43)" />
      <text x="35" y="48" textAnchor="middle" className="fig-mono" transform="rotate(-6 35 43)">EXHIBIT</text>
      <path d="M64 44h30" className="fig-route" /><path d="M88 36l10 8-10 8" className="fig-thick" />
      <text x="100" y="30" className="fig-bang">!</text>
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 120 80">
      <path d="M10 44h100" className="fig-thick" />
      {[22, 48, 74, 100].map((x, i) => <g key={x}><circle cx={x} cy="44" r="5" className={i === 2 ? 'fig-badge fig-badge--on' : 'fig-badge'} /><path d={`M${x} ${i % 2 ? 52 : 36}v${i % 2 ? 10 : -10}`} className="fig-ink" /></g>)}
    </svg>
  ),
  board: (
    <svg viewBox="0 0 120 80">
      <rect x="4" y="4" width="112" height="72" className="fig-cork" />
      <rect x="14" y="14" width="34" height="24" className="fig-paper" transform="rotate(-4 31 26)" />
      <rect x="72" y="40" width="34" height="26" className="fig-paper" transform="rotate(5 89 53)" />
      <rect x="70" y="10" width="30" height="20" className="fig-paper" transform="rotate(3 85 20)" />
      <path d="M32 20 L88 50 M32 20 L84 18" className="fig-string" />
      <circle cx="32" cy="20" r="3" className="fig-tack" /><circle cx="88" cy="50" r="3" className="fig-tack" /><circle cx="84" cy="18" r="3" className="fig-tack" />
    </svg>
  ),
  notes: (
    <svg viewBox="0 0 120 80">
      <rect x="30" y="6" width="60" height="70" className="fig-paper" />
      {[18, 28, 38, 48, 58, 68].map((y) => <path key={y} d={`M36 ${y}h48`} className="fig-rule" />)}
      <path d="M40 26h30M40 36h38M40 46h24" className="fig-ink" /><text x="84" y="64" className="fig-bang">?</text>
    </svg>
  ),
  accuse: (
    <svg viewBox="0 0 120 80">
      <rect x="22" y="14" width="76" height="52" className="fig-paper" transform="rotate(-2 60 40)" />
      <text x="60" y="47" textAnchor="middle" className="fig-stamp fig-stamp--red" transform="rotate(-10 60 40)">CHARGED</text>
    </svg>
  ),
};

// The job, page by page. Mechanics only: no case's people, places or answers.
const PAGES = [
  {
    figure: 'desk', kicker: 'THE DESK', title: 'Take a case',
    body: ['Every folder on your desk is a different crime, with its own people, places and a deadline.', 'Open one to read the brief, then take it. The case clock starts the moment you do.'],
    tip: 'You can put a case down and come back. Your progress is kept.',
  },
  {
    figure: 'file', kicker: 'THE CASE FILE', title: 'Read, or go in blind',
    body: ['The file is what the police already know: the incident, the people involved, the procedures. Each page takes time to read.', 'Paperwork with no address of its own, like a medical report or a criminal record, goes into your evidence when you read the page it came with.'],
    tip: 'Skip the file and people notice. Some won’t take your questions seriously, and some lines of questioning never open.',
  },
  {
    figure: 'street', kicker: 'THE CITY', title: 'Go there in person',
    body: ['The map shows the town and every place in the case: the house, the garage, the bank. Pick one and go. Every trip costs time.', 'The red string shows the route from where you are standing.'],
    tip: 'Nothing is handed to you. Evidence is out there, at the places. If you don’t go, you don’t find it.',
  },
  {
    figure: 'search', kicker: 'A PLACE', title: 'Search it',
    body: ['Each place has spots worth a look: a desk, a logbook, a floor someone mopped. Searching one takes time and may turn up an exhibit.', 'Whatever you find is added to your Evidence straight away. Some spots only turn up something after you know what to look for.'],
    tip: 'A place you have visited is marked on the map. Spots you have already searched are marked too.',
  },
  {
    figure: 'talk', kicker: 'PEOPLE', title: 'Question them where they are',
    body: ['You can only talk to someone at the place they are. The People tab says where to find each of them.', 'Pick your questions. Watch their face: they get nervous, defensive or angry, and that changes what they’ll say next.'],
    tip: 'Bad choices have consequences. Threaten someone and they might call a lawyer and stop talking.',
  },
  {
    figure: 'present', kicker: 'EVIDENCE', title: 'What evidence is for',
    body: ['Open an exhibit to read it properly. Then use it. In an interview, choose “Present evidence” and put it in front of them: the right exhibit breaks a story, the wrong one wastes time.', 'On the People tab, a suspect’s statement lists every claim they made. Test a claim against an exhibit. If they can’t both be true, you have caught a lie.'],
    tip: 'Lies you catch are logged as contradictions. They carry weight when you accuse.',
  },
  {
    figure: 'timeline', kicker: 'THE TIMELINE', title: 'When things happened',
    body: ['Events appear on the timeline as you collect the evidence behind them. Line them up against what people told you.', 'Someone who “left at nine” shouldn’t show up on a record at quarter past.'],
    tip: 'An empty timeline means you haven’t found anything yet, not that nothing happened.',
  },
  {
    figure: 'board', kicker: 'THE CASE BOARD', title: 'Build your case',
    body: ['The board is your theory in red string. Pin exhibits, people, places and events, then click two cards to link them: this record puts this person in this place.', 'Links are the argument you’ll take to court. When you accuse someone, the links you made to them count.'],
    tip: 'A name with no string attached to it is a thin case, even if it’s the right name.',
  },
  {
    figure: 'notes', kicker: 'DETECTIVE’S NOTES', title: 'When you’re stuck',
    body: ['Pick a question: what doesn’t add up, what happened in a half hour, how two clues connect. Your notes answer from the evidence you’ve collected, nothing more.', 'If they point to a lie, you can log it from there.'],
    tip: 'Your notes don’t know who did it. They only know what you know.',
  },
  {
    figure: 'accuse', kicker: 'THE ACCUSATION', title: 'Name them. It’s final.',
    body: ['Choose who did it, then present the exhibits that prove it. Or admit you can’t tell.', 'The best ending needs everything: the right person, the exhibits that prove it, links to them on your board, and their lies caught. Get the name right on thin evidence and they may walk. Get it wrong and an innocent person pays.'],
    tip: 'When the case clock runs out you have to accuse with what you’ve got. Spend your time well.',
  },
];

/** The job explained as a short illustrated casebook. Arrow keys turn the pages; Esc closes it. */
export default function Tutorial({ onClose }) {
  const [n, setN] = useState(0);
  const page = PAGES[n];
  const last = n === PAGES.length - 1;
  const turn = (to) => { if (to >= 0 && to < PAGES.length) { setN(to); playPaperRustle(); } };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); if (last) onClose(); else turn(n + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); turn(n - 1); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return createPortal(
    <div className="tut" role="dialog" aria-modal="true" aria-label="How to play" onClick={onClose}>
      <div className="tut__book tex-paper" onClick={(e) => e.stopPropagation()}>
        <div className="tut__figure" key={`f${n}`} aria-hidden="true">{FIGURES[page.figure]}</div>
        <div className="tut__page" key={`p${n}`}>
          <span className="t-label tut__kicker">HOW TO PLAY · {n + 1} OF {PAGES.length} · {page.kicker}</span>
          <h2 className="t-display tut__title">{page.title}</h2>
          {page.body.map((p) => <p key={p} className="t-small tut__text">{p}</p>)}
          <p className="t-small tut__tip"><span className="t-label">WHY IT MATTERS</span> {page.tip}</p>
        </div>
        <div className="tut__nav">
          <button type="button" className="tut__btn tut__btn--ghost" onClick={() => turn(n - 1)} disabled={n === 0}>← BACK</button>
          <div className="tut__dots" role="tablist" aria-label="Pages">
            {PAGES.map((p, i) => (
              <button key={p.kicker} type="button" role="tab" aria-selected={i === n} aria-label={p.title}
                className={i === n ? 'tut__dot tut__dot--on' : 'tut__dot'} onClick={() => { turn(i); playTypewriterKey(); }} />
            ))}
          </div>
          <button type="button" className="tut__btn" onClick={() => (last ? onClose() : turn(n + 1))}>{last ? 'GOT IT' : 'NEXT →'}</button>
        </div>
        <button type="button" className="tut__close t-label" onClick={onClose} aria-label="Close">✕ CLOSE</button>
      </div>
    </div>,
    document.body,
  );
}
