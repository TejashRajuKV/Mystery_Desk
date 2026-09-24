import * as cases from '../models/case.model.js';
import * as inv from '../models/investigation.model.js';
import { getSolution } from '../models/solution.model.js';
import * as investigation from './investigation.service.js';
import { hhmm } from '../utils/time.js';

// An innocent suspect accused with at least this much behind it (cited exhibits naming them,
// contradictions found against them, board links to them) is a reasoned but wrong case.
const REASONED_CASE = 2;
const SOLVED = new Set(['perfect_investigation', 'true_criminal']);

const pairKey = (c) => `${c.assertionId}:${c.evidenceId}`;
const touches = (link, id) => link.source === id || link.target === id;
const linked = (links, [a, b]) => links.some((c) => (c.source === a && c.target === b) || (c.source === b && c.target === a));

/**
 * The only reader of the answer key. Decides which of the five endings an accepted
 * accusation earns, from what the player has actually done.
 */
export function evaluateEnding({ suspectId, evidenceIds }) {
  if (!suspectId) return 'criminal_escapes';

  const solution = getSolution();
  const links = inv.listConnections();
  const found = new Set(inv.listFound().map(pairKey));
  const against = investigation.findContradictions().filter((c) => c.suspectId === suspectId);

  if (suspectId === solution.culprit) {
    const holds = solution.requiredEvidence.every((id) => evidenceIds.includes(id))
      && solution.requiredConnections.every((pair) => linked(links, pair));
    if (!holds) return 'criminal_escapes';
    return against.every((c) => found.has(pairKey(c))) ? 'perfect_investigation' : 'true_criminal';
  }

  const support = evidenceIds.filter((id) => cases.getEvidence(id)?.personIds.includes(suspectId)).length
    + against.filter((c) => found.has(pairKey(c))).length
    + links.filter((c) => touches(c, suspectId)).length;
  return support >= REASONED_CASE ? 'wrong_suspect' : 'innocent_accused';
}

/** Accepts any valid accusation, once. The ending is fixed at the moment it is filed. */
export function submitConclusion(body) {
  const conclusion = investigation.validateConclusion(body);
  const saved = { ...conclusion, ending: evaluateEnding(conclusion) };
  inv.setConclusion(saved);
  return saved;
}

/**
 * How it was done, rebuilt from the timeline: every event involving the culprit or resting on an
 * exhibit that proves the case, in order. Only ever built once the culprit has been named.
 */
function reconstruct(culpritId) {
  const solution = getSolution();
  const proving = new Set([
    ...solution.requiredEvidence,
    ...investigation.findContradictions().filter((c) => c.suspectId === culpritId).map((c) => c.evidenceId),
  ]);
  const titles = Object.fromEntries(cases.listEvidence().map((e) => [e.id, e.title]));
  return cases.listTimeline()
    .filter((t) => t.personIds.includes(culpritId) || t.evidenceIds.some((id) => proving.has(id)))
    .map((t) => ({
      id: t.id, timestamp: t.timestamp, time: hhmm(t.timestamp), title: t.title, description: t.description,
      evidence: t.evidenceIds.filter((id) => proving.has(id)).map((id) => ({ id, title: titles[id] })),
    }));
}

/**
 * The ending's copy with the accused's name filled in. Only the two endings that named the
 * culprit also carry `whatHappened`; every other ending says nothing about who it really was.
 */
export function describeEnding(conclusion) {
  const id = conclusion.ending ?? evaluateEnding(conclusion);
  const copy = cases.getEnding(id);
  const accused = conclusion.suspectId ? cases.getSuspect(conclusion.suspectId)?.name : null;
  const fill = (s) => s.replaceAll('{accused}', accused ?? 'the accused');
  return {
    id, title: copy.title, stamp: copy.stamp, verdict: fill(copy.verdict), narrative: copy.narrative.map(fill),
    whatHappened: SOLVED.has(id) ? reconstruct(conclusion.suspectId) : null,
  };
}
