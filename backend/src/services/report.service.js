import * as cases from '../models/case.model.js';
import * as caseService from './case.service.js';
import * as investigation from './investigation.service.js';
import { describeEnding } from './ending.service.js';
import { currentCase } from '../database/caseScope.js';
import { HttpError } from '../middleware/errorHandler.js';

/** Built entirely from what the player did. */
export function getReport() {
  const state = investigation.getInvestigation();
  if (!state.conclusion) throw new HttpError(422, 'No conclusion has been accepted yet.');

  const suspects = Object.fromEntries(cases.listSuspects().map((s) => [s.id, s]));
  const evidence = Object.fromEntries(caseService.listEvidence().map((e) => [e.id, e]));
  const primary = suspects[state.conclusion.suspectId];

  return {
    case: currentCase(),
    title: cases.getCase().title,
    primarySuspect: primary ? { id: primary.id, name: primary.name } : null,
    ending: describeEnding(state.conclusion),
    theory: state.theory,
    supportingEvidence: state.conclusion.evidenceIds.map((id) => {
      const e = evidence[id];
      return { id, title: e.title, time: e.time, location: e.location, summary: e.summary };
    }),
    timeline: state.eventsViewed
      .map((id) => caseService.listTimeline().find((t) => t.id === id))
      .filter(Boolean)
      .map((t) => ({ id: t.id, timestamp: t.timestamp, time: t.time, title: t.title, description: t.description })),
    contradictions: state.contradictionsFound.map((c) => ({
      assertionId: c.assertionId,
      suspectName: suspects[c.suspectId].name,
      claim: c.claim,
      evidenceId: c.evidenceId,
      explanation: c.explanation,
    })),
    connections: state.connections.map(({ source, target, relationship }) => ({ source, target, relationship })),
  };
}
