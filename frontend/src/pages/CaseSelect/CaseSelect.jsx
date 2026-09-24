import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { api } from '../../services/api.js';
import { useGo } from '../../components/Scene/Scene.jsx';
import { Loading, ErrorState, SoundToggle } from '../../components/ui/ui.jsx';
import { formatDateTime } from '../../utils/format.js';
import { prefersReducedMotion } from '../../utils/motion.js';
import { playClick, playPaperRustle } from '../../utils/sound.js';
import './CaseSelect.css';

const STATUS = { new: 'NEW', in_progress: 'IN PROGRESS', closed: 'CLOSED' };
const TILT = [-2.5, 1.5, -1, 2.2, -1.8, 1];

function Brief({ file, onClose }) {
  const go = useGo();
  const [more, setMore] = useState(false);
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.from('.brief__folder', { x: 60, autoAlpha: 0, rotate: 4, duration: 0.55, ease: 'power3.out' });
      gsap.from('.brief [data-line]', { autoAlpha: 0, y: 10, duration: 0.4, stagger: 0.05, delay: 0.2 });
    }, ref);
    return () => ctx.revert();
  }, []);

  const start = () => go(`/case/${file.id}`, { kicker: `CASE #${file.id} · ${file.crime.toUpperCase()}`, title: file.title, sub: formatDateTime(file.openedAt).toUpperCase() });
  const resume = () => go(`/case/${file.id}/map`, { kicker: `CASE #${file.id}`, title: file.title, sub: 'BACK ON THE CASE' });
  const ending = () => go(`/case/${file.id}/accuse`);

  return (
    <div className="brief" ref={ref} role="dialog" aria-modal="true" aria-label={`Case ${file.id}: ${file.title}`} onClick={onClose}>
      <article className="brief__folder tex-paper" onClick={(e) => e.stopPropagation()}>
        <div className="brief__head" data-line>
          <span className="t-label">CASE #{file.id} · {file.crime.toUpperCase()}</span>
          <span className={`stamp ${file.status === 'closed' ? 'stamp--red' : 'stamp--ink'}`}>{STATUS[file.status]}</span>
        </div>
        <h2 className="t-display brief__title" data-line>{file.title}</h2>
        <p className="t-label brief__where" data-line>{file.site} · OPENED {formatDateTime(file.openedAt).toUpperCase()}</p>
        <hr className="rule" data-line />
        <p className="t-body" data-line>{file.teaser}</p>
        {more && <p className="t-body brief__more">{file.summary}</p>}
        {!more && <button type="button" className="brief__more-btn t-label" onClick={() => { setMore(true); playPaperRustle(); }} data-line>READ MORE ▾</button>}

        <dl className="brief__facts t-mono" data-line>
          <div><dt>PERSONS OF INTEREST</dt><dd>{file.suspectCount}</dd></div>
          <div><dt>PLACES</dt><dd>{file.locationCount}</dd></div>
          <div><dt>EXHIBITS</dt><dd>{file.evidenceCount}</dd></div>
          <div><dt>ON THE CLOCK</dt><dd>{file.clockHours} HRS</dd></div>
          <div><dt>DIFFICULTY</dt><dd>{file.difficulty.toUpperCase()}</dd></div>
        </dl>
        <p className="t-small brief__deadline" data-line>{file.deadlineNote}</p>
        {file.ending && <p className="t-label brief__ending" data-line>LAST ENDING: <span className="red">{file.ending.title.toUpperCase()}</span></p>}

        <div className="brief__actions" data-line>
          {file.status === 'new' && <button type="button" className="brief__go" onClick={() => { playClick(); start(); }}>[ TAKE THE CASE ]</button>}
          {file.status === 'in_progress' && <button type="button" className="brief__go" onClick={() => { playClick(); resume(); }}>[ CONTINUE THE CASE ]</button>}
          {file.status === 'closed' && <button type="button" className="brief__go" onClick={() => { playClick(); ending(); }}>[ READ HOW IT ENDED ]</button>}
          <button type="button" className="brief__back" onClick={() => { playClick(); onClose(); }}>PUT IT BACK</button>
        </div>
      </article>
    </div>
  );
}

/** The desk of case folders. The detective chooses which one to pick up. */
export default function CaseSelect() {
  const go = useGo();
  const root = useRef(null);
  const [files, setFiles] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.listCases().then(setFiles).catch(setError);
  }, []);
  useEffect(load, [load]);

  useLayoutEffect(() => {
    if (!files || prefersReducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.from('.folder', { y: -60, autoAlpha: 0, rotate: (i) => (i % 2 ? 12 : -12), duration: 0.7, ease: 'back.out(1.4)', stagger: 0.09 });
    }, root);
    return () => ctx.revert();
  }, [files]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { if (open) setOpen(null); else go('/'); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);

  return (
    <div className="desk tex-wood" ref={root}>
      <header className="desk__head">
        <button type="button" className="desk__back t-label" onClick={() => { playClick(); go('/'); }}>← MAIN MENU</button>
        <div>
          <p className="t-display desk__kicker">Which one do you take?</p>
          <h1 className="t-h1 desk__title">The Case Files</h1>
        </div>
        <SoundToggle />
      </header>

      {error && <ErrorState error={error} onRetry={load} />}
      {!files && !error && <Loading label="OPENING THE DRAWER" />}
      {files && (
        <div className="desk__folders">
          {files.map((f, i) => (
            <button key={f.id} type="button" className={`folder folder--${f.status}`} style={{ '--tilt': `${TILT[i % TILT.length]}deg` }}
              onClick={() => { playPaperRustle(); setOpen(f); }} aria-label={`Case ${f.id}, ${f.title}, ${f.crime}, ${STATUS[f.status]}`}>
              <span className="folder__tab t-label">#{f.id}</span>
              <span className="folder__body tex-paper">
                <span className="t-label folder__crime">{f.crime.toUpperCase()}</span>
                <span className="t-h2 folder__title">{f.title}</span>
                <span className="t-small folder__teaser">{f.teaser}</span>
                <span className="folder__foot">
                  <span className="t-label">{f.difficulty.toUpperCase()}</span>
                  <span className={`stamp ${f.status === 'closed' ? 'stamp--red' : f.status === 'in_progress' ? 'stamp--ink-solid' : 'stamp--ink'}`}>
                    {f.ending ? f.ending.stamp : STATUS[f.status]}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {open && <Brief file={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
