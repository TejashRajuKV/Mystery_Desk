import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useCase } from '../../hooks/useCase.jsx';
import { useGo, Scene } from '../../components/Scene/Scene.jsx';
import { Loading, ErrorState } from '../../components/ui/ui.jsx';
import { formatClock } from '../../utils/format.js';
import { prefersReducedMotion } from '../../utils/motion.js';
import { playDenied, playPaperRustle, playTypewriterKey } from '../../utils/sound.js';
import './CaseFile.css';

function Page({ page, fresh }) {
  const { base } = useCase();
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!fresh || prefersReducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.from('[data-type]', { autoAlpha: 0, y: 6, duration: 0.5, stagger: 0.35, onStart: playTypewriterKey });
      gsap.from('.clip', { autoAlpha: 0, rotate: 8, y: -20, duration: 0.5, stagger: 0.15, delay: 0.3 + page.body.length * 0.35, ease: 'back.out(1.6)' });
    }, ref);
    return () => ctx.revert();
  }, [fresh, page.body.length]);
  return (
    <div ref={ref} className="file__text">
      {page.body.map((para, i) => <p key={i} className="t-body" data-type>{para}</p>)}
      {page.attachments.length > 0 && (
        <div className="file__clips">
          {page.attachments.map((a) => (
            <Link key={a.id} to={`${base}/evidence?select=${a.id}`} className="clip">
              <span className="clip__pin" aria-hidden="true" />
              <span className="t-label">ATTACHED · {a.id}</span>
              <span className="t-h3">{a.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** The case file: pages that cost time to read, and are worth it. */
export default function CaseFile() {
  const { api, base, caseInfo, investigation, readPage } = useCase();
  const go = useGo();
  const [pages, setPages] = useState(null);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);
  const [fresh, setFresh] = useState(null);
  const [busy, setBusy] = useState(false);
  const cost = investigation.clock?.costs?.readPage;

  const load = useCallback(() => {
    setError(null);
    api.getFile().then((p) => { setPages(p); setCurrent((c) => c ?? p[0]?.id); }).catch(setError);
  }, [api]);
  useEffect(load, [load]);

  async function read(id) {
    setBusy(true); setError(null);
    try {
      const r = await readPage(id);
      setPages((prev) => prev.map((p) => (p.id === id ? r.page : p)));
      setFresh(id);
    } catch (e) {
      setError(e); playDenied();
    } finally {
      setBusy(false);
    }
  }

  const page = pages?.find((p) => p.id === current);

  return (
    <Scene className="file">
      <header className="file__head" data-reveal>
        <p className="t-display file__kicker">What does the file actually say?</p>
        <h1 className="t-h1">Case File #{caseInfo.id}</h1>
        <p className="t-label file__meta">{pages ? `${pages.filter((p) => p.read).length} OF ${pages.length} PAGES READ` : ''} · {investigation.clock && formatClock(investigation.clock.now)}</p>
      </header>

      {error && !pages && <ErrorState error={error} onRetry={load} />}
      {!pages && !error && <Loading label="UNTYING THE FILE" />}
      {pages && (
        <div className="file__dossier" data-reveal>
          <nav className="file__tabs" aria-label="Pages">
            {pages.map((p, i) => (
              <button key={p.id} type="button" className={['file__tab', p.id === current && 'file__tab--on', p.read && 'file__tab--read'].filter(Boolean).join(' ')}
                onClick={() => { setCurrent(p.id); setFresh(null); playPaperRustle(); }} aria-current={p.id === current ? 'page' : undefined}>
                <span className="t-label">{String(i + 1).padStart(2, '0')}</span>
                <span className="file__tab-title">{p.title}</span>
                {p.read && <span className="file__tick" aria-label="read">✓</span>}
              </button>
            ))}
          </nav>

          <article className="file__page tex-paper" key={page?.id}>
            <span className="t-label file__page-id">{caseInfo.classification} · PAGE {page?.id}</span>
            <h2 className="t-h1 file__page-title">{page?.title}</h2>
            <hr className="rule" />
            {page?.read ? <Page page={page} fresh={fresh === page.id} /> : (
              <div className="file__unread">
                <p className="t-body">The page is face down. Reading it properly will take time off the clock.</p>
                <button type="button" className="file__read" onClick={() => read(page.id)} disabled={busy || investigation.clock?.timeUp}>
                  {busy ? 'READING…' : `[ READ IT${cost ? ` · ${cost} MIN` : ''} ]`}
                </button>
              </div>
            )}
            {error && pages && <p className="t-small file__error" role="alert">{error.message}</p>}
          </article>
        </div>
      )}

      <div className="file__leave" data-reveal>
        <button type="button" className="file__out" onClick={() => go(`${base}/map`, { kicker: caseInfo.site.toUpperCase(), title: 'Out into the city', sub: formatClock(investigation.clock?.now) })}>
          CLOSE THE FILE AND GO OUT →
        </button>
      </div>
    </Scene>
  );
}
