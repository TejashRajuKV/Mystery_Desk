import * as cases from '../models/case.model.js';
import * as investigation from './investigation.service.js';
import { answerContradictions, answerWindow, shapeAnswer } from './assistant.service.js';
import { unlockedEvidenceIds } from './case.service.js';
import { datePart, hhmm } from '../utils/time.js';
import { HttpError } from '../middleware/errorHandler.js';

// Detective's Notes: the rule-based analyst, driven by predefined prompts instead of typed questions.
// It only works from what the detective has actually examined, and it never says who did it.

const FACT_TEXT = {
  enter: 'Entered', exit: 'Left by', vehicle_exit: 'Drove out of', present: 'Was at',
  leave_post: 'Left the post at', return_post: 'Returned to the post at',
  filed_request: 'Filed a request concerning', remote_login: 'Connected remotely to', knows_of: 'Knew of', took_key: 'Signed out the', handled: 'Handled the',
};
const WINDOW_MINUTES = 30;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const incidentDate = () => datePart(cases.getCase().incidentWindow.from);
const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function when(ts) {
  if (datePart(ts) === incidentDate()) return `at ${hhmm(ts)}`;
  const d = new Date(`${datePart(ts)}T00:00:00Z`);
  return `on ${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function examined() {
  const state = investigation.getInvestigation();
  const unlocked = unlockedEvidenceIds();
  return { state, unlocked, viewed: new Set(state.evidenceViewed.filter((id) => unlocked.has(id))) };
}

function describe(id) {
  if (id.startsWith('ST')) {
    const claim = cases.listStatements().flatMap((s) => s.assertions).find((a) => a.id === id);
    return claim ? `the claim “${claim.claim}”` : null;
  }
  switch (id[0]) {
    case 'E': return cases.getEvidence(id)?.title ?? null;
    case 'S': return cases.getSuspect(id)?.name ?? null;
    case 'L': return cases.listLocations().find((l) => l.id === id)?.name ?? null;
    case 'T': return investigation.knownTimeline().find((t) => t.id === id)?.title ?? null;
    default: return null;
  }
}

/** What the player has established about one suspect: ✓ for facts on record, ? for claims still standing. */
export function discoveredFacts(suspectId) {
  const suspect = cases.getSuspect(suspectId);
  if (!suspect) throw new HttpError(404, 'Suspect not found');
  const { state, viewed } = examined();
  const locations = Object.fromEntries(cases.listLocations().map((l) => [l.id, l.name]));
  const titles = Object.fromEntries(cases.listEvidence().map((e) => [e.id, e.title]));
  const lines = [];

  for (const e of cases.listEvidence()) {
    if (!viewed.has(e.id) || !e.personIds.includes(suspectId)) continue;
    const mine = e.facts.filter((f) => f.personId === suspectId);
    if (mine.length === 0) lines.push({ mark: '✓', text: `Named in ${e.title}`, evidenceId: e.id });
    for (const f of mine) {
      lines.push({ mark: '✓', text: `${FACT_TEXT[f.action] ?? titleCase(f.action)} ${locations[f.target] ?? titleCase(f.target)} ${when(f.timestamp)}`, evidenceId: e.id });
    }
  }
  const contradicted = new Set();
  for (const c of state.contradictionsFound.filter((x) => x.suspectId === suspectId)) {
    contradicted.add(c.assertionId);
    lines.push({ mark: '✓', text: `Said “${c.claim}”, but ${titles[c.evidenceId]} disagrees`, evidenceId: c.evidenceId, assertionId: c.assertionId });
    for (const m of c.mitigatedBy) lines.push({ mark: '✓', text: `A possible innocent explanation is in ${titles[m]}`, evidenceId: m });
  }
  const statement = cases.listStatements().find((s) => s.suspectId === suspectId);
  for (const a of statement?.assertions ?? []) {
    if (!contradicted.has(a.id)) lines.push({ mark: '?', text: `Not yet disproved: “${a.claim}”`, assertionId: a.id });
  }
  return { suspectId, name: suspect.name, lines };
}

/** Half-hour windows of the incident night that have something on the timeline. */
function timeWindows() {
  const date = incidentDate();
  const starts = new Set();
  for (const t of investigation.knownTimeline()) {
    if (datePart(t.timestamp) !== date) continue;
    const [h, m] = hhmm(t.timestamp).split(':').map(Number);
    starts.add(h * 60 + Math.floor(m / WINDOW_MINUTES) * WINDOW_MINUTES);
  }
  const clock = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  return [...starts].sort((a, b) => a - b).map((s) => ({ from: clock(s), to: clock(s + WINDOW_MINUTES) }));
}

/** The prompts the detective can consult, built from the case. */
export function listPrompts() {
  return [
    { id: 'contradictions', label: 'What doesn’t add up?' },
    ...cases.listSuspects().map((s) => ({ id: `statement:${s.id}`, label: `Review ${s.name}’s statement` })),
    ...timeWindows().map((w) => ({ id: `window:${w.from}-${w.to}`, label: `Review the ${w.from}–${w.to} timeline` })),
    { id: 'connect', label: 'What connects these two clues?', picks: 2 },
    { id: 'theory', label: 'Review my current theory' },
  ];
}

function relatedEvidence(id, found) {
  if (id.startsWith('ST')) return new Set(found.filter((c) => c.assertionId === id).map((c) => c.evidenceId));
  const evidence = cases.listEvidence();
  switch (id[0]) {
    case 'E': return new Set([id, ...(cases.getEvidence(id)?.relatedEvidenceIds ?? [])]);
    case 'S': return new Set(evidence.filter((e) => e.personIds.includes(id)).map((e) => e.id));
    case 'L': return new Set(evidence.filter((e) => e.locationId === id || e.facts.some((f) => f.target === id)).map((e) => e.id));
    case 'T': return new Set(cases.listTimeline().find((t) => t.id === id)?.evidenceIds ?? []);
    default: return new Set();
  }
}

function answerLinks(a, b, state, unlocked) {
  const common = [...relatedEvidence(a, state.contradictionsFound)]
    .filter((id) => relatedEvidence(b, state.contradictionsFound).has(id) && unlocked.has(id));
  const suspectIds = [a, b].filter((id) => id[0] === 'S' && !id.startsWith('ST'));
  const [nameA, nameB] = [describe(a), describe(b)];
  if (common.length === 0) {
    return { answer: `Nothing in the case file connects ${nameA} and ${nameB} yet.`, confidence: 'low', contradiction: false, evidence: [], suspectIds, events: [a, b].filter((id) => id[0] === 'T'), pairs: [] };
  }
  const titles = common.map((id) => `${cases.getEvidence(id).title} (${id})`);
  return {
    answer: `${common.length === 1 ? 'One exhibit connects' : `${common.length} exhibits connect`} ${nameA} and ${nameB}: ${titles.join('; ')}.`,
    confidence: 'medium', contradiction: false, evidence: common, suspectIds, pairs: [],
  };
}

function answerTheory(state) {
  const links = state.connections;
  const onBoard = [...new Set(links.flatMap((c) => [c.source, c.target]).filter((id) => id[0] === 'S' && !id.startsWith('ST')))];
  const people = onBoard.length ? onBoard : state.interviewedSuspects;
  const names = people.map((id) => cases.getSuspect(id).name);
  const theory = state.theory.trim();
  const answer = [
    links.length ? `Your board holds ${links.length} link${links.length === 1 ? '' : 's'}${names.length ? `, touching ${names.join(', ')}` : ''}.` : 'Your board has no links yet.',
    theory ? `Your working theory: “${theory}”` : 'You haven’t written down a theory yet.',
    'Below is only what you have established. Whether it adds up is your call.',
  ].join(' ');
  return {
    result: { answer, confidence: links.length || theory ? 'medium' : 'low', contradiction: false, evidence: links.flatMap((c) => [c.source, c.target]).filter((id) => id[0] === 'E'), suspectIds: people, pairs: [] },
    facts: people.map(discoveredFacts),
  };
}

/** One consulted prompt, answered in the assistant's fixed shape plus a heading and any facts. */
export function consult(body) {
  const { promptId, items } = body ?? {};
  if (typeof promptId !== 'string') throw new HttpError(400, 'Expected { promptId, items? }');
  const { state, unlocked, viewed } = examined();
  const pairs = investigation.findContradictions()
    .filter((p) => viewed.has(p.evidenceId))
    .map((p) => ({ ...p, mitigatedBy: p.mitigatedBy.filter((id) => unlocked.has(id)) }));
  const prompt = listPrompts().find((p) => p.id === promptId);
  if (!prompt) throw new HttpError(404, 'There is no such note');

  let result;
  let facts;
  if (promptId === 'contradictions') {
    result = answerContradictions([], pairs);
    if (!result.contradiction) Object.assign(result, { answer: 'Nothing you have examined so far conflicts with anyone’s statement. Examine more of the case file.', confidence: 'low' });
  } else if (promptId.startsWith('statement:')) {
    const suspect = cases.getSuspect(promptId.slice('statement:'.length));
    result = answerContradictions([suspect], pairs);
    if (!result.contradiction) Object.assign(result, { answer: `Nothing you have examined so far conflicts with ${suspect.name}’s statement.`, confidence: 'low' });
    facts = [discoveredFacts(suspect.id)];
  } else if (promptId.startsWith('window:')) {
    const [from, to] = promptId.slice('window:'.length).split('-');
    result = answerWindow([from, to]);
  } else if (promptId === 'connect') {
    const ok = Array.isArray(items) && items.length === 2 && items[0] !== items[1]
      && items.every((id) => typeof id === 'string' && describe(id) && (id[0] !== 'E' || unlocked.has(id)));
    if (!ok) throw new HttpError(400, 'Expected two different clues from the case file in items');
    result = answerLinks(items[0], items[1], state, unlocked);
  } else {
    ({ result, facts } = answerTheory(state));
  }

  return { promptId, title: prompt.label, ...shapeAnswer(result, unlocked), ...(facts && { facts }) };
}
