import { Link } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import { Button, Stamp, EmptyState } from '../../components/ui/ui.jsx';
import { formatDateTime, formatWhen } from '../../utils/format.js';
import './Dashboard.css';

function Stat({ value, label, ratio }) {
  const ticks = 10;
  const on = Math.round(Math.min(1, Math.max(0, ratio)) * ticks);
  return (
    <div className="panel stat">
      <span className="t-h1 stat__value">{value}</span>
      <span className="t-label muted">{label}</span>
      {ratio != null && (
        <div className="stat__ticks" aria-hidden="true">
          {Array.from({ length: ticks }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
        </div>
      )}
    </div>
  );
}

const ratio = (a, b) => (b ? a / b : 0);

export default function Dashboard() {
  const { caseInfo, progress: p, investigation, connections, evidenceById } = useCase();

  // The case supplies the objective wording, in this order.
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
    <div className="page dash">
      <div className="dash__row">
        <section className="panel--paper dash__brief">
          <div className="dash__brief-head t-label">
            <span>CASE FILE · OPENED {formatDateTime(caseInfo.openedAt).toUpperCase()}</span>
            <Stamp variant="ink">{caseInfo.status.toUpperCase()}</Stamp>
          </div>
          <h2 className="t-h1">{caseInfo.title}</h2>
          <hr className="rule" />
          {caseInfo.briefing.map((para, i) => <p key={i} className="t-body">{para}</p>)}
        </section>

        <section className="panel dash__objectives" aria-label="Objectives">
          <span className="t-label muted">OBJECTIVES</span>
          <ul>
            {objectives.map((o) => (
              <li key={o.text} className={o.done ? 't-small muted done' : 't-small'}>
                <i aria-hidden="true" className="check" />{o.text}
                <span className="sr-only">{o.done ? ' (done)' : ' (to do)'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="dash__stats">
        <Stat value={`${p.evidenceViewed} / ${p.evidenceTotal}`} label="EVIDENCE EXAMINED" ratio={ratio(p.evidenceViewed, p.evidenceTotal)} />
        <Stat value={`${p.suspectsViewed} / ${p.suspectsTotal}`} label="SUSPECTS PROFILED" ratio={ratio(p.suspectsViewed, p.suspectsTotal)} />
        <Stat value={`${p.eventsViewed} / ${p.eventsTotal}`} label="TIMELINE EVENTS" ratio={ratio(p.eventsViewed, p.eventsTotal)} />
        <Stat value={p.contradictions} label="CONTRADICTIONS LOGGED" />
      </div>

      <div className="dash__row">
        <section className="panel dash__leads">
          <span className="t-label muted">LATEST LEADS</span>
          {leads.length === 0 ? (
            <EmptyState title="No leads yet">Open an exhibit in the Evidence Room and it will show up here.</EmptyState>
          ) : (
            <ul>
              {leads.map((e) => (
                <li key={e.id}>
                  <span className="t-h3 lead__time">{formatWhen(e.timestamp)}</span>
                  <Link to={`/evidence?select=${e.id}`} className="t-small secondary">{e.title} ({e.id}). {e.summary}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel dash__next">
          <span className="t-label muted">NEXT STEPS</span>
          <Button to="/evidence" block>ENTER EVIDENCE ROOM</Button>
          <Button to="/board" variant="secondary" block>OPEN THE BOARD</Button>
          <Button to="/assistant" variant="secondary" block>ASK THE ASSISTANT</Button>
        </section>
      </div>
    </div>
  );
}
