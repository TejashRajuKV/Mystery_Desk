import * as cases from '../models/case.model.js';
import { HttpError } from '../middleware/errorHandler.js';
import { hhmm } from '../utils/time.js';

const nameOf = (list) => Object.fromEntries(list.map((x) => [x.id, x.name]));

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

export function getCase() {
  const c = cases.getCase();
  return {
    ...c,
    suspectCount: cases.listSuspects().length,
    evidenceCount: cases.listEvidence().length,
    locationCount: cases.listLocations().length,
    eventCount: cases.listTimeline().length,
    locations: cases.listLocations(),
  };
}

export function listEvidence() {
  const locations = nameOf(cases.listLocations());
  const suspects = nameOf(cases.listSuspects());
  return cases.listEvidence().map((e) => shapeEvidence(e, locations, suspects));
}

export function getEvidence(id) {
  const e = cases.getEvidence(id);
  if (!e) throw new HttpError(404, 'Evidence not found');
  const shaped = shapeEvidence(e, nameOf(cases.listLocations()), nameOf(cases.listSuspects()));
  return { ...shaped, details: e.details, source: e.source, relatedEvidenceIds: e.relatedEvidenceIds };
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
  return cases.listTimeline().map((t) => ({
    id: t.id,
    timestamp: t.timestamp,
    time: hhmm(t.timestamp),
    title: t.title,
    description: t.description,
    locationId: t.locationId,
    location: locations[t.locationId] ?? null,
    personIds: t.personIds,
    evidenceIds: t.evidenceIds,
  }));
}
