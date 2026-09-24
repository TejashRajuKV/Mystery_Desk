import { useEffect, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { CaseProvider, useCase } from '../../hooks/useCase.jsx';
import { useGo } from '../Scene/Scene.jsx';
import { Button, Loading, ErrorState, SoundToggle } from '../ui/ui.jsx';
import GameNotice from '../GameNotice/GameNotice.jsx';
import Tutorial from '../Tutorial/Tutorial.jsx';
import { formatClock, timeLeft } from '../../utils/format.js';
import { playClick } from '../../utils/sound.js';
import './Layout.css';

// The detective's kit, as tabs on a notebook. Paths are relative to the case.
const DOCK = [
  { to: 'file', label: 'Case File', key: 'F' },
  { to: 'map', label: 'The City', key: 'M' },
  { to: 'people', label: 'People', key: 'P' },
  { to: 'evidence', label: 'Evidence', key: 'E' },
  { to: 'timeline', label: 'Timeline', key: 'T' },
  { to: 'board', label: 'Case Board', key: 'B' },
  { to: 'notes', label: 'Notes', key: 'N' },
  { to: 'accuse', label: 'Accuse', key: 'A' },
];

function Clock() {
  const { investigation, caseInfo } = useCase();
  const c = investigation.clock;
  if (!c) return null;
  const total = c.minutesUsed + c.minutesLeft;
  const left = total ? c.minutesLeft / total : 0;
  return (
    <div className={c.timeUp ? 'hud__clock hud__clock--out' : left < 0.2 ? 'hud__clock hud__clock--low' : 'hud__clock'} title={caseInfo?.clock?.deadlineNote}>
      <span className="t-label">{formatClock(c.now)}</span>
      <span className="hud__bar" aria-hidden="true"><i style={{ transform: `scaleX(${left})` }} /></span>
      <span className="t-label hud__left">{c.timeUp ? 'TIME IS UP' : `${timeLeft(c.minutesLeft)} LEFT`}</span>
    </div>
  );
}

function PauseMenu({ onClose, onHelp }) {
  const { base } = useCase();
  const go = useGo();
  const leave = (to) => { onClose(); go(to); };
  return (
    <div className="pause" role="dialog" aria-modal="true" aria-label="Paused" onClick={onClose}>
      <div className="pause__card tex-paper" onClick={(e) => e.stopPropagation()}>
        <span className="t-label">PAUSED</span>
        <h2 className="t-display pause__title">Take a breath, Detective.</h2>
        <div className="pause__list">
          <Button onClick={onClose} block>RESUME</Button>
          <Button variant="ink" onClick={onHelp} block>HOW TO PLAY</Button>
          <Button variant="ink" onClick={() => leave(`${base}/file`)} block>READ THE CASE FILE</Button>
          <Button variant="ink" onClick={() => leave('/cases')} block>BACK TO THE CASE FILES</Button>
          <Button variant="ink" onClick={() => leave('/')} block>MAIN MENU</Button>
        </div>
        <p className="t-small">Your investigation is saved as you go.</p>
      </div>
    </div>
  );
}

function Shell() {
  const { status, error, reload, caseInfo, base, investigation, locationById } = useCase();
  const go = useGo();
  const { pathname } = useLocation();
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const section = pathname.slice(base.length + 1).split('/')[0];
  const active = section === 'place' ? 'map' : section;
  const here = locationById?.[investigation.locationId];
  const closed = Boolean(investigation.conclusion);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('.scene[role=dialog], .tut')) return;
      setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="game">
      <header className="hud">
        <button type="button" className="hud__case" onClick={() => { playClick(); setPaused(true); }} aria-label="Pause menu">
          <span className="hud__menu" aria-hidden="true">≡</span>
          <span className="t-label">CASE #{caseInfo?.id}</span>
          <span className="t-h3 hud__title">{caseInfo?.title}</span>
        </button>
        <span className="t-label hud__where">{here ? `AT ${here.name.toUpperCase()}` : 'AT YOUR DESK'}</span>
        <Clock />
        <SoundToggle className="hud__sound" />
      </header>

      {investigation.clock?.timeUp && !closed && section !== 'accuse' && (
        <div className="timeup" role="alert">
          <span className="t-label">TIME IS UP. {caseInfo?.clock?.deadlineNote?.toUpperCase()}</span>
          <Button small onClick={() => go(`${base}/accuse`)}>MAKE THE ACCUSATION</Button>
        </div>
      )}

      <main className="game__stage">
        {status === 'loading' && <Loading label="PULLING THE FILE" />}
        {status === 'error' && <ErrorState error={error} onRetry={reload} />}
        {status === 'ready' && <Outlet />}
      </main>

      {section && (
        <nav className="dock tex-wood" aria-label="Your kit">
          {DOCK.map((d) => (
            <button key={d.to} type="button" className={active === d.to ? 'dock__tab dock__tab--on' : 'dock__tab'}
              onClick={() => { playClick(); if (section !== d.to) go(`${base}/${d.to}`); }} aria-current={active === d.to ? 'page' : undefined}>
              <span className="t-label dock__key" aria-hidden="true">{d.key}</span>
              <span className="dock__label">{d.label}</span>
            </button>
          ))}
        </nav>
      )}

      {paused && <PauseMenu onClose={() => setPaused(false)} onHelp={() => { setPaused(false); setHelp(true); }} />}
      {help && <Tutorial onClose={() => setHelp(false)} />}
      <GameNotice />
    </div>
  );
}

/** The case's frame: HUD, stage and kit. Everything inside it is one case. */
export default function Layout() {
  const { caseId } = useParams();
  return (
    <CaseProvider key={caseId} caseId={caseId}>
      <Shell />
    </CaseProvider>
  );
}
