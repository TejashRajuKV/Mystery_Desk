import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useCase } from '../../hooks/useCase.jsx';
import { useGo, Scene } from '../../components/Scene/Scene.jsx';
import { Loading, ErrorState } from '../../components/ui/ui.jsx';
import CityPlan, { buildPlan, W, H } from '../../components/CityPlan/CityPlan.jsx';
import MapIcon from '../../components/CityPlan/MapIcon.jsx';
import { formatClock } from '../../utils/format.js';
import { prefersReducedMotion } from '../../utils/motion.js';
import { playDenied, playPin } from '../../utils/sound.js';
import './CityMap.css';

function Route({ from, to }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const len = el.getTotalLength();
    gsap.fromTo(el, { strokeDashoffset: len, strokeDasharray: `${len}` }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' });
  }, [from, to]);
  if (!from || !to) return null;
  const mid = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 70];
  return <path ref={ref} className="map__route" d={`M${from[0]} ${from[1]} Q${mid[0]} ${mid[1]} ${to[0]} ${to[1]}`} />;
}

/** The city: every place in the case, and the choice of where to go next. Going anywhere costs time. */
export default function CityMap() {
  const { api, base, caseInfo, investigation, travel } = useCase();
  const go = useGo();
  const [places, setPlaces] = useState(null);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const cost = investigation.clock?.costs?.travel;

  const load = useCallback(() => {
    setError(null);
    api.listPlaces().then(setPlaces).catch(setError);
  }, [api]);
  useEffect(load, [load, investigation.locationId]);

  const plan = useMemo(() => places && buildPlan(caseInfo.id, caseInfo.city, places.filter((p) => p.map).map((p) => [p.map.x, p.map.y])), [caseInfo, places]);
  const pos = (i) => {
    const m = places[i].map;
    return m ? plan.at(m.x, m.y) : [W / 2, H / 2];
  };
  const hereIndex = places?.findIndex((p) => p.here) ?? -1;
  const pickedIndex = places?.findIndex((p) => p.id === picked) ?? -1;
  const place = pickedIndex >= 0 ? places[pickedIndex] : null;

  async function goThere(p) {
    if (p.here) { go(`${base}/place/${p.id}`); return; }
    setBusy(true); setError(null);
    try {
      const r = await travel(p.id);
      go(`${base}/place/${p.id}`, { kicker: 'ARRIVING AT', title: p.name, sub: `${p.district ?? ''} · ${formatClock(r.investigation.clock.now)}`.replace(/^ · /, '') });
    } catch (e) {
      setError(e); playDenied(); setBusy(false);
    }
  }

  return (
    <Scene className="map">
      <header className="map__head" data-reveal>
        <p className="t-display map__kicker">Where do you go next?</p>
        <h1 className="t-h1">{caseInfo.city?.district ?? caseInfo.site}</h1>
      </header>

      {error && !places && <ErrorState error={error} onRetry={load} />}
      {!places && !error && <Loading label="UNFOLDING THE MAP" />}
      {places && (
        <div className="map__layout">
          <div className="map__paper" data-reveal>
            <CityPlan plan={plan}>
              {hereIndex >= 0 && pickedIndex >= 0 && pickedIndex !== hereIndex && <Route from={pos(hereIndex)} to={pos(pickedIndex)} />}
            </CityPlan>
            {places.map((p, i) => (
              <button key={p.id} type="button" className={['pin', p.here && 'pin--here', p.visited && 'pin--visited', p.id === picked && 'pin--on'].filter(Boolean).join(' ')}
                style={{ left: `${(pos(i)[0] / W) * 100}%`, top: `${(pos(i)[1] / H) * 100}%` }} onClick={() => { setPicked(p.id); playPin(); }}
                aria-pressed={p.id === picked} aria-label={`${p.name}${p.here ? ', you are here' : ''}`}>
                <span className="pin__badge"><MapIcon kind={p.map?.kind} /></span>
                <span className="pin__label">
                  {(p.here || p.visited) && <span className="t-label pin__state">{p.here ? 'YOU ARE HERE' : 'VISITED'}</span>}
                  <span className="pin__name">{p.name}</span>
                </span>
              </button>
            ))}
          </div>

          <aside className="map__card" data-reveal aria-live="polite">
            {!place ? (
              <div className="map__hint">
                <p className="t-h3">Pick a place on the map.</p>
                <p className="t-small secondary">{hereIndex >= 0 ? `You're at ${places[hereIndex].name}.` : 'You haven’t gone anywhere yet.'} Every trip across town takes time.</p>
              </div>
            ) : (
              <div className="map__detail" key={place.id}>
                <span className="t-label map__district">{place.district}{place.floor ? ` · ${place.floor}` : ''}</span>
                <h2 className="t-h1">{place.name}</h2>
                <p className="t-small secondary">{place.description}</p>
                <span className="t-label muted">WHO YOU'LL FIND THERE</span>
                {place.people.length === 0 ? <p className="t-small muted">Nobody. Just whatever they left behind.</p> : (
                  <ul className="map__people">{place.people.map((s) => <li key={s.id} className="t-small">{s.name} <span className="muted">· {s.role}</span></li>)}</ul>
                )}
                <button type="button" className="map__go" onClick={() => goThere(place)} disabled={busy || (!place.here && investigation.clock?.timeUp)}>
                  {busy ? 'ON YOUR WAY…' : place.here ? '[ WALK BACK IN ]' : `[ GO THERE${cost ? ` · ${cost} MIN` : ''} ]`}
                </button>
                {error && <p className="t-small map__error" role="alert">{error.message}</p>}
              </div>
            )}
          </aside>
        </div>
      )}
    </Scene>
  );
}
