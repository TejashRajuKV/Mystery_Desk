import { db } from '../database/db.js';
import { currentCase } from '../database/caseScope.js';

const parse = (row) => (row ? JSON.parse(row.data) : null);
const all = (sql) => db.prepare(sql).all(currentCase()).map(parse);

export const listCases = () => db.prepare('SELECT data FROM cases ORDER BY id').all().map(parse);
export const caseExists = (id) => Boolean(db.prepare('SELECT 1 FROM cases WHERE id = ?').get(id));
export const listDefaultUnlocked = () =>
  db.prepare('SELECT evidence_id FROM default_unlocked WHERE case_id = ? ORDER BY evidence_id').all(currentCase()).map((r) => r.evidence_id);

export const getCase = () => parse(db.prepare('SELECT data FROM cases WHERE id = ?').get(currentCase()));
export const listLocations = () => all('SELECT data FROM locations WHERE case_id = ? ORDER BY id');
export const listSuspects = () => all('SELECT data FROM suspects WHERE case_id = ? ORDER BY id');
export const listEvidence = () => all('SELECT data FROM evidence WHERE case_id = ? ORDER BY id');
export const listTimeline = () => all('SELECT data FROM timeline_events WHERE case_id = ? ORDER BY timestamp, id');
export const listStatements = () => all('SELECT data FROM statements WHERE case_id = ? ORDER BY id');

export const getSuspect = (id) => parse(db.prepare('SELECT data FROM suspects WHERE id = ? AND case_id = ?').get(id, currentCase()));
export const getEvidence = (id) => parse(db.prepare('SELECT data FROM evidence WHERE id = ? AND case_id = ?').get(id, currentCase()));
export const getInterview = (suspectId) => parse(db.prepare('SELECT data FROM dialogues WHERE suspect_id = ? AND case_id = ?').get(suspectId, currentCase()));
export const getEnding = (id) => parse(db.prepare('SELECT data FROM endings WHERE id = ? AND case_id = ?').get(id, currentCase()));
