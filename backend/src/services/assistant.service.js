import * as cases from '../models/case.model.js';
import * as investigation from './investigation.service.js';
import { unlockedEvidenceIds } from './case.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { addDays, datePart, datesBetween, dayLabel, hhmm, toTimestamp } from '../utils/time.js';

const CONTRADICTION_WORDS = /contradict|conflict|inconsisten|\blie[sd]?\b|lying|alibi|statement|claim/i;
const MAX_RELATED = 6;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (q, word) => new RegExp(`\\b${escape(word)}\\b`, 'i').test(q);
const words = (name) => name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4);

function mentionedSuspects(q, suspects) {
  return suspects.filter((s) => s.name.split(' ')
    .map((t) => t.replace(/\.$/, ''))
    .filter((t) => t.length > 2)
    .some((t) => hasWord(q, t)));
}

// A location is mentioned when the question uses a word that appears in no other location's name.
function mentionedLocations(q, locations) {
  return locations.filter((loc) => {
    const others = new Set(locations.filter((l) => l.id !== loc.id).flatMap((l) => words(l.name)));
    return words(loc.name).filter((w) => !others.has(w)).some((w) => hasWord(q, w));
  });
}

const findClockTimes = (q) => [...q.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)].map((m) => `${m[1]}:${m[2]}`);

function unique(list) {
  return [...new Set(list)];
}

export function answerContradictions(suspects, pairs) {
  const scoped = suspects.length ? pairs.filter((p) => suspects.some((s) => s.id === p.suspectId)) : pairs;
  if (scoped.length === 0) {
    const who = suspects.length ? suspects.map((s) => s.name).join(' and ') : 'any suspect';
    return { answer: `I found no statement from ${who} that conflicts with the records.`, confidence: 'medium', contradiction: false, evidence: [], suspectIds: suspects.map((s) => s.id), pairs: [] };
  }
  const major = scoped.filter((p) => p.severity === 'major');
  const groups = new Map();
  for (const p of [...major, ...scoped.filter((p) => p.severity !== 'major')]) {
    if (!groups.has(p.assertionId)) groups.set(p.assertionId, []);
    groups.get(p.assertionId).push(p);
  }
  const shown = [...groups.values()].slice(0, 4);
  const sentences = shown.map((g) => {
    const others = g.slice(1).map((p) => p.evidenceId);
    const softener = g[0].mitigatedBy.length ? ` ${g[0].mitigatedBy.join(', ')} may explain it.` : '';
    return `${g[0].explanation}${others.length ? ` It is also contradicted by ${others.join(', ')}.` : ''}${softener}`;
  });
  const more = groups.size > shown.length ? ` ${groups.size - shown.length} more conflicts are on file.` : '';
  return {
    answer: sentences.join(' ') + more,
    confidence: major.length ? 'high' : 'medium',
    contradiction: true,
    evidence: unique(scoped.map((p) => p.evidenceId)),
    suspectIds: unique(scoped.map((p) => p.suspectId)),
    pairs: scoped.map((p) => ({ assertionId: p.assertionId, evidenceId: p.evidenceId })),
  };
}

/**
 * Two clock times from a typed question, as real spans on every day of the incident window.
 * "23:30 to 00:30" crosses midnight when that reading is 12 hours or less; otherwise a reversed
 * pair is just swapped ("21:14 to 21:00" means 21:00–21:14). Null when a time is malformed.
 */
export function clockSpans([a, b]) {
  const { from, to } = cases.getCase().incidentWindow;
  if (!toTimestamp(datePart(from), a) || !toTimestamp(datePart(from), b)) return null;
  return datesBetween(datePart(from), datePart(to)).map((date) => {
    const start = toTimestamp(date, a);
    const end = toTimestamp(date, b);
    if (end >= start) return { from: start, to: end };
    const overnight = toTimestamp(addDays(date, 1), b);
    const hours = (new Date(`${overnight}Z`) - new Date(`${start}Z`)) / 3600000;
    return hours <= 12 ? { from: start, to: overnight } : { from: end, to: start };
  });
}

/** What happened inside one or more spans of real time, in order. */
export function answerWindow(spans) {
  if (!spans?.length) return null;
  const seen = new Map();
  for (const { from, to } of spans) {
    for (const e of investigation.getTimelineBetween(from, to)) seen.set(e.id, e);
  }
  const events = [...seen.values()].sort((x, y) => x.timestamp.localeCompare(y.timestamp) || x.id.localeCompare(y.id));
  const label = `${hhmm(spans[0].from)} and ${hhmm(spans[0].to)}`;
  if (events.length === 0) {
    return { answer: `Nothing is recorded between ${label}.`, confidence: 'low', contradiction: false, evidence: [], suspectIds: [], events: [], pairs: [] };
  }
  const incidentDate = datePart(cases.getCase().incidentWindow.from);
  const dated = events.some((e) => datePart(e.timestamp) !== incidentDate);
  const stamp = (e) => (dated ? `${dayLabel(e.timestamp)} ${hhmm(e.timestamp)}` : hhmm(e.timestamp));
  return {
    answer: `Between ${label}: ${events.map((e) => `${stamp(e)} ${e.title}`).join('; ')}.`,
    confidence: 'high',
    contradiction: false,
    evidence: unique(events.flatMap((e) => e.evidenceIds)),
    suspectIds: unique(events.flatMap((e) => e.personIds)),
    events: events.map((e) => e.id),
    pairs: [],
  };
}

export function answerConnection(suspect, location, unlocked) {
  const items = investigation.findSuspectConnections(suspect.id, location.id).filter((e) => unlocked.has(e.id));
  const ids = items.map((e) => e.id);
  if (items.length === 0) {
    return { answer: `No exhibit places ${suspect.name} at ${location.name}.`, confidence: 'medium', contradiction: false, evidence: [], suspectIds: [suspect.id], events: [], pairs: [] };
  }
  return {
    answer: `${items.length === 1 ? 'One exhibit ties' : `${items.length} exhibits tie`} ${suspect.name} to ${location.name}: ${items.map((e) => `${e.title} (${e.id})`).join('; ')}.`,
    confidence: 'high',
    contradiction: false,
    evidence: ids,
    suspectIds: [suspect.id],
    events: cases.listTimeline().filter((t) => t.locationId === location.id && t.evidenceIds.some((id) => ids.includes(id))).map((t) => t.id),
    pairs: [],
  };
}

/** Contradictions the detective can see: the exhibit has been opened, not just unlocked. */
export function examinedContradictions() {
  const unlocked = unlockedEvidenceIds();
  const viewed = new Set(investigation.getInvestigation().evidenceViewed.filter((id) => unlocked.has(id)));
  return investigation.findContradictions()
    .filter((p) => viewed.has(p.evidenceId))
    .map((p) => ({ ...p, mitigatedBy: p.mitigatedBy.filter((id) => unlocked.has(id)) }));
}

const HELP = 'I can compare a suspect\'s statement with the records, walk through what happened between two times, or show what ties a suspect to a place. Try one of those.';

/** Rule-based analyst: classifies the question, then answers from the derived case data. */
export function query(body) {
  const question = body?.question;
  if (typeof question !== 'string' || !question.trim() || question.length > 500) {
    throw new HttpError(400, 'Expected { question } of 1–500 characters');
  }

  const suspects = mentionedSuspects(question, cases.listSuspects());
  const locations = mentionedLocations(question, cases.listLocations());
  const times = findClockTimes(question);
  // The analyst only knows what is in the player's case file: locked exhibits don't exist yet.
  const unlocked = unlockedEvidenceIds();

  let result = null;
  if (times.length >= 2) result = answerWindow(clockSpans(times));
  else if (suspects.length && locations.length) result = answerConnection(suspects[0], locations[0], unlocked);
  else if (suspects.length || CONTRADICTION_WORDS.test(question)) result = answerContradictions(suspects, examinedContradictions());

  if (!result) {
    return { answer: HELP, confidence: 'low', relatedEvidence: [], relatedSuspects: [], relatedEvents: [], contradiction: false };
  }

  return shapeAnswer(result, unlocked);
}

/** The fixed reply shape, with every id checked against the case and the player's case file. */
export function shapeAnswer(result, unlocked) {
  const evidenceIds = unlocked;
  const suspectIds = new Set(cases.listSuspects().map((s) => s.id));
  const timeline = cases.listTimeline();
  const events = result.events ?? timeline.filter((t) => t.evidenceIds.some((id) => result.evidence.includes(id))).map((t) => t.id);
  const eventIds = new Set(timeline.map((t) => t.id));

  const response = {
    answer: result.answer,
    confidence: result.confidence,
    relatedEvidence: result.evidence.filter((id) => evidenceIds.has(id)).slice(0, MAX_RELATED),
    relatedSuspects: result.suspectIds.filter((id) => suspectIds.has(id)),
    relatedEvents: events.filter((id) => eventIds.has(id)).slice(0, MAX_RELATED),
    contradiction: result.contradiction,
  };
  if (result.pairs.length) response.contradictions = result.pairs;
  return response;
}
