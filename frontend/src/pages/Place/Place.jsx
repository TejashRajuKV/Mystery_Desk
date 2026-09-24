import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import { useGo, Scene } from '../../components/Scene/Scene.jsx';
import { Loading, ErrorState, Button } from '../../components/ui/ui.jsx';
import Portrait from '../../components/Portrait/Portrait.jsx';
import ChoiceList from '../../components/ChoiceList/ChoiceList.jsx';
import InterviewScene from '../../components/InterviewScene/InterviewScene.jsx';
import { formatClock } from '../../utils/format.js';
import { playDenied, playPaperRustle, playPresent } from '../../utils/sound.js';
import './Place.css';

/** Somewhere the detective is standing in person: the people there, and the places worth searching. */
export default function Place() {
  const { locationId } = useParams();
  const [params, setParams] = useSearchParams();
  const { api, base, suspectById, investigation, travel, search } = useCase();
  const go = useGo();
  const [place, setPlace] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const talkTo = suspectById[params.get('talk')];
  const costs = investigation.clock?.costs ?? {};

  const load = useCallback(async () => {
    setStatus('loading'); setError(null);
    try {
      setPlace(await api.getPlace(locationId));
      setStatus('ready');
    } catch (e) {
      setError(e);
      setStatus(e.status === 422 ? 'away' : 'error');
    }
  }, [api, locationId]);
  useEffect(() => { load(); }, [load]);

  async function goHere() {
    setBusy(true);
    try {
      await travel(locationId);
      await load();
    } catch (e) {
      setError(e); playDenied();
    } finally {
      setBusy(false);
    }
  }

  async function look(choice) {
    setBusy(true); setError(null);
    try {
      const r = await search(locationId, choice.id);
      setPlace(r.place);
      setFound({ ...r.spot, fresh: r.effects.unlockedEvidence.map((e) => e.id) });
      if (r.effects.unlockedEvidence.length) playPresent(); else playPaperRustle();
    } catch (e) {
      setError(e); playDenied();
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') return <Loading label="WALKING IN" />;
  if (status === 'error') return <ErrorState error={error} onRetry={load} />;
  if (status === 'away') {
    return (
      <Scene className="place place--away">
        <p className="t-display place__kicker" data-reveal>You aren't there.</p>
        <p className="t-body secondary" data-reveal>To search a place or talk to anyone in it, you have to go there in person.</p>
        <div className="place__row" data-reveal>
          <Button onClick={goHere} disabled={busy || investigation.clock?.timeUp}>{busy ? 'ON YOUR WAY…' : `GO THERE${costs.travel ? ` · ${costs.travel} MIN` : ''}`}</Button>
          <Button variant="secondary" onClick={() => go(`${base}/map`)}>BACK TO THE MAP</Button>
        </div>
      </Scene>
    );
  }

  const spots = place.spots.map((s) => ({ id: s.id, label: `${s.label}${s.searched ? ' (searched)' : costs.search ? ` · ${costs.search} min` : ''}`, asked: s.searched }));

  return (
    <Scene className="place">
      <header className="place__head" data-reveal>
        <span className="t-label place__where">{place.floor} · {formatClock(investigation.clock?.now)}</span>
        <h1 className="t-display place__title">{place.name}</h1>
        {place.arrival && <p className="t-body place__arrival">{place.arrival}</p>}
      </header>

      <div className="place__layout">
        <section className="place__people" data-reveal aria-labelledby="people-here">
          <h2 id="people-here" className="t-label muted">PEOPLE HERE</h2>
          {place.people.length === 0 ? (
            <p className="t-small muted place__empty">Nobody here but you.</p>
          ) : (
            <ul className="place__faces">
              {place.people.map((p) => {
                const s = suspectById[p.id];
                const leads = investigation.interviewLeads[p.id];
                return (
                  <li key={p.id}>
                    <button type="button" className="face" onClick={() => { playPaperRustle(); setParams({ talk: p.id }); }}>
                      <Portrait suspect={s} className="face__portrait" />
                      <span className="face__name t-h3">{p.name}</span>
                      <span className="t-mono muted">{p.role}</span>
                      <span className="t-label face__talk">{investigation.interviewedSuspects.includes(p.id) ? (leads ? 'MORE TO ASK →' : 'TALK AGAIN →') : 'QUESTION THEM →'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="place__search" data-reveal aria-labelledby="look-around">
          <h2 id="look-around" className="t-label muted">LOOK AROUND</h2>
          <p className="t-small secondary">{place.description}</p>
          {spots.length === 0 ? <p className="t-small muted">There's nothing obvious to search.</p> : (
            <ChoiceList choices={spots} onChoose={look} disabled={busy} hotkeys={!talkTo} label="Search" />
          )}
          {found && (
            <div className="note-found tex-paper" key={`${found.id}:${found.fresh.join()}`} role="status">
              <span className="t-label">{found.label.toUpperCase()}</span>
              <p className="t-body">{found.text}</p>
              {found.turnedUp.length > 0 && (
                <div className="note-found__clips">
                  {found.turnedUp.map((e) => (
                    <Link key={e.id} to={`${base}/evidence?select=${e.id}`} className={found.fresh.includes(e.id) ? 'stamp stamp--red' : 'stamp stamp--ink'}>
                      {found.fresh.includes(e.id) ? 'NEW · ' : ''}{e.id} · {e.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && <p className="t-small place__error" role="alert">{error.message}</p>}
        </section>
      </div>

      <div className="place__row" data-reveal>
        <Button variant="secondary" onClick={() => go(`${base}/map`)}>← BACK TO THE MAP</Button>
      </div>

      {talkTo && <InterviewScene key={`talk-${talkTo.id}`} suspect={talkTo} onExit={() => setParams({}, { replace: true })} />}
    </Scene>
  );
}
