import * as cases from '../models/case.model.js';
import * as inv from '../models/investigation.model.js';
import { inCase } from '../database/caseScope.js';
import { HttpError } from '../middleware/errorHandler.js';
import { hhmm } from '../utils/time.js';
import { knownTimeline } from './investigation.service.js';

const nameOf = (list) => Object.fromEntries(list.map((x) => [x.id, x.name]));

/** Evidence the player has in the case file. Locked exhibits are treated as not existing yet. */
export const unlockedEvidenceIds = () => new Set(inv.listUnlocked());

function shapeEvidence(e, locations, suspects) {
  return {
    id: e.id,
    type: e.type,
    title: e.title,
    timestamp: e.timestamp,
    time: hhmm(e.timestamp),
    locationId: e.locationId,
    location: e.locationId ? locations[e.locationId] ?? null : null,
    personIds: e.personIds,
    people: e.personIds.map((id) => suspects[id]).filter(Boolean),
    summary: e.summary,
  };
}

/** The desk of case folders: what each case is, and how far the detective has got. Never the answer. */
export function listCases() {
  const status = Object.fromEntries(inv.listCaseStatus().map((s) => [s.caseId, s]));
  return cases.listCases().map((c) => inCase(c.id, () => {
    const s = status[c.id];
    const conclusion = s?.conclusion ? JSON.parse(s.conclusion) : null;
    const started = Boolean(s?.minutesUsed) || inv.listViewed('page').length > 0;
    const ending = conclusion?.ending ? cases.getEnding(conclusion.ending) : null;
    return {
      id: c.id, title: c.title, crime: c.crime, difficulty: c.difficulty, teaser: c.teaser, summary: c.summary, openedAt: c.openedAt, site: c.site,
      deadlineNote: c.clock.deadlineNote,
      suspectCount: cases.listSuspects().length, evidenceCount: cases.listEvidence().length, locationCount: cases.listLocations().length,
      clockHours: c.clock.hours,
      status: conclusion ? 'closed' : started ? 'in_progress' : 'new',
      ending: ending && { id: conclusion.ending, title: ending.title, stamp: ending.stamp },
    };
  }));
}

// The file's pages are read one at a time through the field service (reading costs time), so the case omits them.
export function getCase() {
  const { file, ...c } = cases.getCase();
  return {
    ...c,
    filePages: file.length,
    suspectCount: cases.listSuspects().length,
    evidenceCount: cases.listEvidence().length,
    locationCount: cases.listLocations().length,
    eventCount: cases.listTimeline().length,
    locations: cases.listLocations().map(({ id, name, floor, district, description, map }) => ({ id, name, floor, district, description, map })),
  };
}

export function listEvidence() {
  const locations = nameOf(cases.listLocations());
  const suspects = nameOf(cases.listSuspects());
  const unlocked = unlockedEvidenceIds();
  return cases.listEvidence().filter((e) => unlocked.has(e.id)).map((e) => shapeEvidence(e, locations, suspects));
}

export function getEvidence(id) {
  const unlocked = unlockedEvidenceIds();
  const e = unlocked.has(id) ? cases.getEvidence(id) : null;
  if (!e) throw new HttpError(404, 'Evidence not found');
  const shaped = shapeEvidence(e, nameOf(cases.listLocations()), nameOf(cases.listSuspects()));
  return { ...shaped, details: e.details, source: e.source, relatedEvidenceIds: e.relatedEvidenceIds.filter((r) => unlocked.has(r)) };
}

export const listSuspects = () => cases.listSuspects();

export function getSuspect(id) {
  const s = cases.getSuspect(id);
  if (!s) throw new HttpError(404, 'Suspect not found');
  return s;
}

// Claims expose only their id and text; kind, parameters and narrative fields stay in the backend.
export function listStatements() {
  return cases.listStatements().map((s) => ({
    id: s.id,
    suspectId: s.suspectId,
    takenAt: s.takenAt,
    text: s.text,
    assertions: s.assertions.map((a) => ({ id: a.id, claim: a.claim })),
  }));
}

export function listTimeline() {
  const locations = nameOf(cases.listLocations());
  const unlocked = unlockedEvidenceIds();
  return knownTimeline().map((t) => ({
    id: t.id,
    timestamp: t.timestamp,
    time: hhmm(t.timestamp),
    title: t.title,
    description: t.description,
    locationId: t.locationId,
    location: locations[t.locationId] ?? null,
    personIds: t.personIds,
    evidenceIds: t.evidenceIds.filter((id) => unlocked.has(id)),
  }));
}
