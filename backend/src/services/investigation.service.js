import * as cases from '../models/case.model.js';
import * as inv from '../models/investigation.model.js';
import { interviewSummary } from './dialogue.rules.js';
import { HttpError } from '../middleware/errorHandler.js';
import { TIME_COST } from '../config/index.js';
import { addMinutes, hhmm } from '../utils/time.js';

const VIEW_TYPES = ['evidence', 'suspect', 'event'];
const RELATIONSHIPS = ['linked_to'];
const PLACES_INSIDE = new Set(['enter', 'vehicle_exit', 'present']);
const ACTION_PHRASE = {
  enter: 'entering', exit: 'leaving', vehicle_exit: 'driving out', present: 'being present',
  leave_post: 'leaving their post', return_post: 'returning to their post',
  filed_request: 'filing a request', remote_login: 'connecting remotely', knows_of: 'knowing of it', took_key: 'signing out a key', handled: 'handling it',
};

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const inCaseFile = (id) => Boolean(cases.getEvidence(id)) && inv.listUnlocked().includes(id);

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

/** Timeline events the detective knows about: those with no exhibit behind them, or one they hold. */
export function knownTimeline() {
  const unlocked = new Set(inv.listUnlocked());
  return cases.listTimeline().filter((t) => t.evidenceIds.length === 0 || t.evidenceIds.some((id) => unlocked.has(id)));
}

export function getTimelineBetween(from, to) {
  return knownTimeline().filter((t) => t.timestamp >= from && t.timestamp <= to);
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

export const claimExists = (id) => cases.listStatements().some((s) => s.assertions.some((a) => a.id === id));

// Board nodes: evidence, suspects, events, locations, and the claims inside statements (ST02-A).
function entityExists(id) {
  if (id.startsWith('ST')) return claimExists(id);
  switch (id[0]) {
    case 'E': return inCaseFile(id);
    case 'S': return Boolean(cases.getSuspect(id));
    case 'T': return knownTimeline().some((t) => t.id === id);
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

/** The case clock: when the detective started, how long they have used, and the deadline. */
export function clockState() {
  const { clock } = cases.getCase();
  const { minutesUsed } = inv.getRow();
  const total = clock.hours * 60;
  return {
    start: clock.start,
    deadline: addMinutes(clock.start, total),
    now: addMinutes(clock.start, Math.min(minutesUsed, total)),
    minutesUsed,
    minutesLeft: Math.max(0, total - minutesUsed),
    timeUp: minutesUsed >= total,
    costs: TIME_COST,
  };
}

/** Legwork costs time on the clock. Once it has run out, or the case is closed, only the accusation is left. */
export function assertOpen() {
  if (inv.getRow().conclusion) throw new HttpError(422, 'This case is closed.');
}

export function spendTime(action) {
  assertOpen();
  const { timeUp, minutesLeft } = clockState();
  if (timeUp) throw new HttpError(422, 'Time is up. The District Attorney wants a name.');
  inv.addMinutes(Math.min(TIME_COST[action], minutesLeft));
}

export function getInvestigation() {
  const row = inv.getRow();
  const derived = findContradictions();
  const unlocked = inv.listUnlocked();
  const viewed = Object.fromEntries(VIEW_TYPES.map((t) => [t, inv.listViewed(t)]));
  const contradictionsFound = inv.listFound()
    .map((p) => derived.find((d) => d.assertionId === p.assertionId && d.evidenceId === p.evidenceId))
    .filter(Boolean)
    .map(({ severity, mitigatedBy, ...rest }) => ({ ...rest, mitigatedBy: mitigatedBy.filter((id) => unlocked.includes(id)) }));
  return {
    evidenceViewed: viewed.evidence,
    suspectsViewed: viewed.suspect,
    eventsViewed: viewed.event,
    connections: inv.listConnections(),
    contradictionsFound,
    unlockedEvidence: unlocked,
    ...interviewSummary(),
    storyFlags: inv.getFlags(),
    clock: clockState(),
    locationId: row.locationId,
    pagesRead: inv.listViewed('page'),
    placesVisited: inv.listViewed('place'),
    spotsSearched: inv.listViewed('spot'),
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
  const known = { evidence: () => inCaseFile(id), suspect: () => cases.getSuspect(id), event: () => knownTimeline().some((t) => t.id === id) };
  if (!known[type]()) throw new HttpError(404, 'Nothing with that id in this case');
  inv.addViewed(type, id);
  return getInvestigation();
}

/** A new investigation: every piece of player state goes, the starting exhibits come back. */
export function resetInvestigation() {
  inv.resetAll();
  return getInvestigation();
}

export function saveTheory(body) {
  const text = body?.text;
  if (typeof text !== 'string' || text.length > 5000) throw new HttpError(400, 'Expected { text } of at most 5000 characters');
  assertOpen();
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
  if (!claimExists(assertionId) || !inCaseFile(evidenceId)) throw new HttpError(404, 'Unknown statement or exhibit');

  const hit = findContradictions().find((d) => d.assertionId === assertionId && d.evidenceId === evidenceId);
  if (!hit) throw new HttpError(422, 'That exhibit doesn\'t contradict that statement.');
  inv.addFound(assertionId, evidenceId);
  const { severity, mitigatedBy, ...recorded } = hit;
  return { ...recorded, mitigatedBy: mitigatedBy.filter(inCaseFile) };
}

// ---------------------------------------------------------------- conclusion

/**
 * Checks an accusation is well-formed and refers to things in the case file. It does not say
 * whether it is right: every valid accusation is accepted and ending.service decides the ending.
 * `suspectId: null` is the explicit "cannot determine", which needs no evidence.
 */
export function validateConclusion(body) {
  const { suspectId, evidenceIds = [] } = body ?? {};
  const undecided = suspectId === null;
  const idsOk = Array.isArray(evidenceIds) && evidenceIds.every((e) => typeof e === 'string');
  if ((!undecided && typeof suspectId !== 'string') || !idsOk || (!undecided && evidenceIds.length === 0)) {
    throw new HttpError(400, 'Expected { suspectId, evidenceIds: [...] } with at least one exhibit, or { suspectId: null }');
  }
  if (inv.getRow().conclusion) throw new HttpError(422, 'This case is closed. The accusation on file is final.');
  const cited = [...new Set(evidenceIds)];
  if (!undecided && !cases.getSuspect(suspectId)) throw new HttpError(422, 'That suspect isn\'t in this case.');
  if (!cited.every(inCaseFile)) throw new HttpError(422, 'One of the cited exhibits isn\'t in this case.');
  return { suspectId, evidenceIds: cited };
}
