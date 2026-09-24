import * as cases from '../models/case.model.js';
import * as inv from '../models/investigation.model.js';
import * as investigation from './investigation.service.js';
import { meets, playerContext } from './dialogue.rules.js';
import { transaction } from '../database/db.js';
import { HttpError } from '../middleware/errorHandler.js';

// Legwork: reading the case file, going places in person, and searching them.
// Every step costs time on the case clock (investigation.spendTime).

const titleOf = (id) => cases.getEvidence(id)?.title ?? id;

// ---------------------------------------------------------------- the case file

/** The file's pages. A page's text is only handed over once it has been read. */
export function getFile() {
  const read = new Set(inv.listViewed('page'));
  return cases.getCase().file.map((p) => ({
    id: p.id,
    title: p.title,
    read: read.has(p.id),
    body: read.has(p.id) ? p.body : null,
    attachments: read.has(p.id) ? (p.attachments ?? []).map((id) => ({ id, title: titleOf(id) })) : [],
  }));
}

/**
 * Reads one page: costs time the first time, sets `file.<pageId>` for the interviews to check,
 * and puts the page's paperwork (exhibits with no place of their own) into the evidence.
 */
export function readPage(pageId) {
  const page = cases.getCase().file.find((p) => p.id === pageId);
  if (!page) throw new HttpError(404, 'There is no such page in the file');
  investigation.assertOpen();
  const found = [];
  if (!inv.listViewed('page').includes(pageId)) {
    transaction(() => {
      investigation.spendTime('readPage');
      inv.addViewed('page', pageId);
      inv.setFlag(`file.${pageId}`, true);
      for (const id of page.attachments ?? []) if (inv.unlockEvidence(id)) found.push({ id, title: titleOf(id) });
    });
  }
  return { page: getFile().find((p) => p.id === pageId), investigation: investigation.getInvestigation(), effects: { unlockedEvidence: found } };
}

// ---------------------------------------------------------------- places

const suspectCard = (id) => {
  const s = cases.getSuspect(id);
  return { id: s.id, name: s.name, role: s.role, alias: s.alias };
};

/** The map: every place in the case, who can be found there, and where the detective is. */
export function listPlaces() {
  const { locationId } = inv.getRow();
  const visited = new Set(inv.listViewed('place'));
  return cases.listLocations().map((l) => ({
    id: l.id, name: l.name, floor: l.floor, district: l.district ?? null, description: l.description, map: l.map ?? null,
    people: (l.people ?? []).map(suspectCard),
    visited: visited.has(l.id),
    here: l.id === locationId,
  }));
}

function placeOr404(locationId) {
  const place = cases.listLocations().find((l) => l.id === locationId);
  if (!place) throw new HttpError(404, 'There is no such place in this case');
  return place;
}

/** The scene at the place the detective is standing in: its people and the spots worth searching. */
export function getPlace(locationId) {
  const place = placeOr404(locationId);
  if (inv.getRow().locationId !== locationId) throw new HttpError(422, 'You aren\'t there. Go there first.');
  const searched = new Set(inv.listViewed('spot'));
  const ctx = playerContext();
  return {
    id: place.id, name: place.name, floor: place.floor, description: place.description, arrival: place.arrival ?? null,
    people: (place.people ?? []).map(suspectCard),
    spots: (place.spots ?? []).filter((s) => meets(s.requires, ctx)).map((s) => ({ id: s.id, label: s.label, searched: searched.has(s.id) })),
  };
}

/** Goes somewhere in person. Staying put is free; going anywhere else costs time. */
export function travel(body) {
  const locationId = body?.locationId;
  if (typeof locationId !== 'string') throw new HttpError(400, 'Expected { locationId }');
  placeOr404(locationId);
  investigation.assertOpen();
  if (inv.getRow().locationId !== locationId) {
    transaction(() => {
      investigation.spendTime('travel');
      inv.setLocation(locationId);
      inv.addViewed('place', locationId);
    });
  }
  return { place: getPlace(locationId), investigation: investigation.getInvestigation() };
}

/** Searches one spot where the detective is standing. What it turns up is only described once searched. */
export function search(locationId, body) {
  const spotId = body?.spotId;
  if (typeof spotId !== 'string') throw new HttpError(400, 'Expected { spotId }');
  const place = placeOr404(locationId);
  investigation.assertOpen();
  if (inv.getRow().locationId !== locationId) throw new HttpError(422, 'You aren\'t there. Go there first.');
  const spot = (place.spots ?? []).find((s) => s.id === spotId);
  if (!spot || !meets(spot.requires, playerContext())) throw new HttpError(404, 'There is nothing like that to search here');

  const found = [];
  if (!inv.listViewed('spot').includes(spotId)) {
    transaction(() => {
      investigation.spendTime('search');
      inv.addViewed('spot', spotId);
      for (const q of spot.consequences ?? []) {
        if (q.type === 'unlock_evidence' && inv.unlockEvidence(q.evidenceId)) found.push({ id: q.evidenceId, title: titleOf(q.evidenceId) });
        if (q.type === 'set_flag') inv.setFlag(q.key, q.value);
      }
    });
  }
  const turnedUp = (spot.consequences ?? []).filter((q) => q.type === 'unlock_evidence').map((q) => ({ id: q.evidenceId, title: titleOf(q.evidenceId) }));
  return {
    spot: { id: spot.id, label: spot.label, text: spot.text, turnedUp },
    effects: { unlockedEvidence: found },
    place: getPlace(locationId),
    investigation: investigation.getInvestigation(),
  };
}
