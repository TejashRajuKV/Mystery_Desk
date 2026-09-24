import { Link } from 'react-router-dom';
import { Stamp, Button } from '../ui/ui.jsx';
import InvestigationNode from '../InvestigationNode/InvestigationNode.jsx';
import { useCase } from '../../hooks/useCase.jsx';
import './AssistantPanel.css';

/** One chat turn. Assistant turns turn the structured API response into interactive UI. */
export default function AssistantMessage({ message, lookups, onLogContradiction, logged }) {
  const { base } = useCase();
  if (message.role === 'user') {
    return (
      <div className="msg msg--user">
        <span className="t-label">YOU</span>
        <p className="t-body">{message.text}</p>
      </div>
    );
  }

  const r = message.response;
  const { evidenceById = {}, suspectById = {}, eventById = {} } = lookups ?? {};
  const evidence = (r?.relatedEvidence ?? []).filter((id) => evidenceById[id]);
  const suspects = (r?.relatedSuspects ?? []).filter((id) => suspectById[id]);
  const events = (r?.relatedEvents ?? []).filter((id) => eventById[id]);

  return (
    <div className={message.error ? 'msg msg--assistant msg--error' : 'msg msg--assistant'}>
      <div className="msg__head t-label">
        <span>{message.error ? 'ANALYST OFFLINE' : message.author ?? 'ANALYST'}</span>
        {r?.confidence && <span className="muted">CONFIDENCE: {String(r.confidence).toUpperCase()}</span>}
      </div>
      <p className="t-body msg__text">{message.text}</p>

      {r?.contradiction && <Stamp variant="alert">CONTRADICTION FOUND</Stamp>}

      {evidence.length > 0 && (
        <div className="msg__group">
          <span className="t-label muted">RELATED EVIDENCE</span>
          <div className="msg__nodes">
            {evidence.map((id) => (
              <Link key={id} to={`${base}/evidence?select=${id}`} className="msg__node-link">
                <InvestigationNode kind="evidence" id={id} title={evidenceById[id].title} as="span" />
                <span className="t-label msg__view">VIEW EVIDENCE →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(suspects.length > 0 || events.length > 0) && (
        <div className="msg__chips">
          {suspects.map((id) => (
            <Link key={id} to={`${base}/people?select=${id}`} className="stamp">{id} · {suspectById[id].name}</Link>
          ))}
          {events.map((id) => (
            <Link key={id} to={`${base}/timeline?select=${id}`} className="stamp">{id} · {eventById[id].time}</Link>
          ))}
        </div>
      )}

      {(r?.contradictions ?? []).length > 0 && (
        <div className="msg__actions">
          {r.contradictions.map((c) => {
            const key = `${c.assertionId}:${c.evidenceId}`;
            const done = logged?.has(key);
            return (
              <Button key={key} small variant={done ? 'secondary' : 'primary'} disabled={done} onClick={() => onLogContradiction?.(c)}>
                {done ? `LOGGED ${c.evidenceId} · ${c.assertionId}` : `LOG ${c.evidenceId} vs ${c.assertionId}`}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
