import * as cases from '../models/case.model.js';
import * as inv from '../models/investigation.model.js';
import { getSolution } from '../models/solution.model.js';
import { HttpError } from '../middleware/errorHandler.js';
import { hhmm } from '../utils/time.js';

const VIEW_TYPES = ['evidence', 'suspect', 'event'];
const RELATIONSHIPS = ['linked_to'];
const PLACES_INSIDE = new Set(['enter', 'vehicle_exit', 'present']);
const ACTION_PHRASE = {
  enter: 'entering', exit: 'leaving', vehicle_exit: 'driving out', present: 'being present',
  leave_post: 'leaving their post', return_post: 'returning to their post',
  filed_request: 'filing a request', remote_login: 'connecting remotely', knows_of: 'knowing of it',
};

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

// ---------------------------------------------------------------- contradictions

/** Returns the fact in `evidence` that contradicts the claim, or null. */
function matchClaim(a, suspectId, evidence, allFacts) {
  const mine = evidence.facts.filter((f) => f.personId === suspectId);
  switch (a.kind) {
    case 'departed_by':
      return mine.find((f) => PLACES_INSIDE.has(f.action) && f.timestamp > a.time) ?? null;
    case 'present_until': {
      const left = mine.find((f) => f.action === 'exit' && f.timestamp < a.time);
      if (!left) return null;
      const returned = allFacts.some((f) => f.personId === suspectId && PLACES_INSIDE.has(f.action) && f.timestamp > left.timestamp && f.timestamp < a.time);
      return returned ? null : left;
    }
    case 'stayed_at_post':
      return mine.find((f) => f.action === 'leave_post' && f.target === a.target && f.timestamp >= a.from && f.timestamp <= a.to) ?? null;
    case 'did_not_perform':
      return mine.find((f) => a.actions.includes(f.action)
        && (!a.target || f.target === a.target)
        && (!a.from || f.timestamp >= a.from)
        && (!a.to || f.timestamp <= a.to)) ?? null;
    default:
      return null;
  }
}

/** Every claim/evidence pair that conflicts. Never stored: recomputed from the seed data. */
export function findContradictions() {
  const suspects = byId(cases.listSuspects());
  const evidence = cases.listEvidence();
  const allFacts = evidence.flatMap((e) => e.facts);
  const found = [];
  for (const statement of cases.listStatements()) {
    for (const a of statement.assertions) {
      for (const e of evidence) {
        const fact = matchClaim(a, statement.suspectId, e, allFacts);
        if (!fact) continue;
        found.push({
          assertionId: a.id,
          evidenceId: e.id,
          suspectId: statement.suspectId,
          claim: a.claim,
          explanation: `${suspects[statement.suspectId].name} said "${a.claim}", but ${e.title} (${e.id}) records ${ACTION_PHRASE[fact.action] ?? fact.action} at ${hhmm(fact.timestamp)}.`,
          mitigatedBy: a.mitigatedBy ?? [],
          severity: a.severity,
        });
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------- lookups

export function getTimelineBetween(from, to) {
  return cases.listTimeline().filter((t) => t.timestamp >= from && t.timestamp <= to);
}

/** Evidence tied to any E, S, T or L id. */
export function findRelatedEvidence(id) {
  const evidence = cases.listEvidence();
  switch (id[0]) {
    case 'E': return evidence.filter((e) => cases.getEvidence(id)?.relatedEvidenceIds.includes(e.id));
    case 'S': return evidence.filter((e) => e.personIds.includes(id));
    case 'L': return evidence.filter((e) => e.locationId === id);
    case 'T': {
      const event = cases.listTimeline().find((t) => t.id === id);
      return evidence.filter((e) => event?.evidenceIds.includes(e.id));
    }
    default: return [];
  }
}

/** Evidence that ties a suspect to a location, by placement or by a fact recorded there. */
export function findSuspectConnections(suspectId, locationId) {
  return cases.listEvidence().filter((e) => e.personIds.includes(suspectId)
    && (e.locationId === locationId || e.facts.some((f) => f.personId === suspectId && f.target === locationId)));
}

// ---------------------------------------------------------------- state

function entityExists(id) {
  switch (id[0]) {
    case 'E': return Boolean(cases.getEvidence(id));
    case 'S': return Boolean(cases.getSuspect(id));
    case 'T': return cases.listTimeline().some((t) => t.id === id);
    case 'L': return cases.listLocations().some((l) => l.id === id);
    default: return false;
  }
}

export function calculateProgress(viewed, foundCount, derivedCount) {
  const ratio = (n, d) => (d ? Math.min(1, n / d) : 0);
  const parts = [
    ratio(viewed.evidence.length, cases.listEvidence().length),
    ratio(viewed.suspect.length, cases.listSuspects().length),
    ratio(viewed.event.length, cases.listTimeline().length),
    ratio(foundCount, derivedCount),
  ];
  return Math.round((100 * parts.reduce((a, b) => a + b, 0)) / parts.length);
}

export function getInvestigation() {
  const row = inv.getRow();
  const derived = findContradictions();
  const viewed = Object.fromEntries(VIEW_TYPES.map((t) => [t, inv.listViewed(t)]));
  const contradictionsFound = inv.listFound()
    .map((p) => derived.find((d) => d.assertionId === p.assertionId && d.evidenceId === p.evidenceId))
    .filter(Boolean)
    .map(({ severity, ...rest }) => rest);
  return {
    evidenceViewed: viewed.evidence,
    suspectsViewed: viewed.suspect,
    eventsViewed: viewed.event,
    connections: inv.listConnections(),
    contradictionsFound,
    theory: row.theory,
    conclusion: row.conclusion ? JSON.parse(row.conclusion) : null,
    progress: calculateProgress(viewed, contradictionsFound.length, derived.length),
  };
}

export function recordViewed(body) {
  const { type, id } = body ?? {};
  if (!VIEW_TYPES.includes(type) || typeof id !== 'string') {
    throw new HttpError(400, 'Expected { type: "evidence" | "suspect" | "event", id }');
  }
  const known = { evidence: () => cases.getEvidence(id), suspect: () => cases.getSuspect(id), event: () => cases.listTimeline().some((t) => t.id === id) };
  if (!known[type]()) throw new HttpError(404, 'Nothing with that id in this case');
  inv.addViewed(type, id);
  return getInvestigation();
}

export function saveTheory(body) {
  const text = body?.text;
  if (typeof text !== 'string' || text.length > 5000) throw new HttpError(400, 'Expected { text } of at most 5000 characters');
  inv.setTheory(text);
  return getInvestigation();
}

// ---------------------------------------------------------------- connections

export function validateConnection({ source, target, relationship }) {
  if (!RELATIONSHIPS.includes(relationship)) throw new HttpError(422, 'That kind of link isn\'t supported.');
  if (!entityExists(source) || !entityExists(target)) throw new HttpError(422, 'One of those items isn\'t in this case.');
  if (source === target) throw new HttpError(422, 'An item can\'t be linked to itself.');
  const duplicate = inv.listConnections().some((c) => (c.source === source && c.target === target) || (c.source === target && c.target === source));
  if (duplicate) throw new HttpError(422, 'Those two are already linked.');
}

export function createConnection(body) {
  const { source, target } = body ?? {};
  const relationship = body?.relationship ?? 'linked_to';
  if (typeof source !== 'string' || typeof target !== 'string' || typeof relationship !== 'string') {
    throw new HttpError(400, 'Expected { source, target, relationship }');
  }
  validateConnection({ source, target, relationship });
  return inv.insertConnection({ source, target, relationship });
}

export const listConnections = () => inv.listConnections();

export function deleteConnection(id) {
  if (!inv.deleteConnection(id)) throw new HttpError(404, 'Connection not found');
}

// ---------------------------------------------------------------- contradictions

export function flagContradiction(body) {
  const { assertionId, evidenceId } = body ?? {};
  if (typeof assertionId !== 'string' || typeof evidenceId !== 'string') {
    throw new HttpError(400, 'Expected { assertionId, evidenceId }');
  }
  const claimExists = cases.listStatements().some((s) => s.assertions.some((a) => a.id === assertionId));
  if (!claimExists || !cases.getEvidence(evidenceId)) throw new HttpError(404, 'Unknown statement or exhibit');

  const hit = findContradictions().find((d) => d.assertionId === assertionId && d.evidenceId === evidenceId);
  if (!hit) throw new HttpError(422, 'That exhibit doesn\'t contradict that statement.');
  inv.addFound(assertionId, evidenceId);
  const { severity, ...recorded } = hit;
  return recorded;
}

// ---------------------------------------------------------------- conclusion

export function validateConclusion(body) {
  const { suspectId, evidenceIds } = body ?? {};
  if (typeof suspectId !== 'string' || !Array.isArray(evidenceIds) || evidenceIds.length === 0 || !evidenceIds.every((e) => typeof e === 'string')) {
    throw new HttpError(400, 'Expected { suspectId, evidenceIds: [...] } with at least one exhibit');
  }
  const cited = [...new Set(evidenceIds)];
  if (!cases.getSuspect(suspectId)) throw new HttpError(422, 'That suspect isn\'t in this case.');
  if (!cited.every((id) => cases.getEvidence(id))) throw new HttpError(422, 'One of the cited exhibits isn\'t in this case.');

  const solution = getSolution();
  const covered = solution.requiredEvidence.every((id) => cited.includes(id));
  if (suspectId !== solution.culprit || !covered) {
    throw new HttpError(422, 'There isn\'t enough evidence linked to this suspect.');
  }
  const links = inv.listConnections();
  const made = solution.requiredConnections.every(([a, b]) => links.some((c) => (c.source === a && c.target === b) || (c.source === b && c.target === a)));
  if (!made) throw new HttpError(422, 'Your board doesn\'t yet connect the evidence to this suspect.');
  return { suspectId, evidenceIds: cited };
}

export function submitConclusion(body) {
  const conclusion = validateConclusion(body);
  inv.setConclusion(conclusion);
  return conclusion;
}
